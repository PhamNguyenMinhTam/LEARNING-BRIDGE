const { withLockRetry } = require('../repositories/mysql');
const { parseId, requireFields } = require('../validators/input');
const { reviewFilters, reviewNote, withdrawalReason } = require('../validators/review');
const { evaluatePublicationEligibility } = require('./publication.service');
const { ApiError } = require('../utils/api-error');

function notFound(label) {
  return new ApiError(404, 'NOT_FOUND', label + ' not found');
}

function conflict(code, message) {
  return new ApiError(409, code, message);
}

function forbidden() {
  return new ApiError(403, 'FORBIDDEN', 'Review permission is unavailable');
}

function scopeMatches(actor, resource) {
  if (actor.role === 'government') return resource.review_scope === 'government' && resource.review_school_id === null;
  return actor.role === 'school_admin' && resource.review_scope === 'school' && resource.review_school_id === actor.school_id;
}

function decisionTransaction(pool, work) {
  return withLockRetry(pool, work, () => conflict('REVIEW_BUSY', 'Concurrent changes are in progress. Retry the request.'));
}

function createReviewService(pool, repository, storage, maxSize = 10485760) {
  async function schoolAccess(actor, mustBeActive) {
    if (actor.role === 'government') return;
    if (actor.role !== 'school_admin' || !actor.school_id) throw forbidden();
    const school = await repository.school(actor.school_id);
    if (!school || (mustBeActive && school.status !== 'active')) throw forbidden();
  }

  async function currentActor(db, actor) {
    // Writers use Resource → School → user → Version → Review, as in Teacher submission.
    if (actor.role === 'school_admin') {
      const school = await repository.school(actor.school_id, db, true);
      if (school?.status !== 'active') throw forbidden();
    }
    const current = await repository.lockActor(db, actor.id);
    if (current?.status !== 'active') throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required');
    if (current.role !== actor.role || current.school_id !== actor.school_id) throw forbidden();
    return current;
  }

  async function locate(actor, id) {
    parseId(id);
    const record = await repository.detail(actor, id);
    if (record?.edit_state !== 'submitted') throw notFound('Review');
    return record;
  }

  async function visible(actor, id) {
    const record = await locate(actor, id);
    await schoolAccess(actor, record.decision === 'pending');
    return record;
  }

  return {
    async schoolProfile(actor) {
      if (actor.role !== 'school_admin' || !actor.school_id) throw forbidden();
      const school = await repository.school(actor.school_id);
      if (!school) throw notFound('School');
      return { id: actor.id, full_name: actor.full_name, school };
    },
    async list(actor, query, history) {
      const { page, limit, ...filters } = reviewFilters(query, history);
      await schoolAccess(actor, !history);
      const { data, total } = await repository.list(actor, { ...filters, limit }, history);
      return { data, pagination: { page, limit, total } };
    },
    async detail(actor, id) {
      const { file_path, ...record } = await visible(actor, id);
      return { ...record, has_file: file_path != null, history: await repository.history(record.resource_id) };
    },
    async preview(actor, id) {
      const record = await visible(actor, id);
      const pdf = record.resource_type !== 'external_link' && record.file_path
        ? await storage.openPdf(record.file_path) : null;
      if (!pdf) throw notFound('PDF');
      return pdf;
    },
    async decide(actor, id, decision, body) {
      const note = reviewNote(body, decision);
      const initial = await visible(actor, id);
      const hasFile = decision === 'approved' && initial.file_path ? await storage.hasPublicPdf(initial.file_path, maxSize) : false;

      return decisionTransaction(pool, async db => {
        const resource = await repository.lockResource(db, initial.resource_id);
        if (!resource || !scopeMatches(actor, resource)) throw notFound('Review');
        const current = await currentActor(db, actor);
        if (!scopeMatches(current, resource)) throw notFound('Review');
        const version = await repository.lockVersion(db, resource.id, initial.version_id);
        const review = version && await repository.lockReview(db, id, version.id);
        if (!review) throw notFound('Review');
        if (version.edit_state !== 'submitted' || review.decision !== 'pending') {
          throw conflict('REVIEW_NOT_PENDING', 'Review is already final or its Version is not submitted');
        }

        let reason = 'REJECTED';
        if (decision === 'approved') {
          const withheld = resource.administrative_status !== 'normal';
          reason = evaluatePublicationEligibility(resource, version, { ...review, decision }, {
            hasFile: hasFile && initial.file_path === version.file_path, withheld
          });
          if (!reason && resource.published_version_id) {
            const old = await repository.approvedPointer(db, resource.id, resource.published_version_id);
            if (!old) reason = 'PUBLISHED_POINTER_UNCONFIRMED';
            else if (old.version_number >= version.version_number) reason = 'NEWER_VERSION_ALREADY_PUBLISHED';
          }
        }

        if (!await repository.finish(db, id, current.id, decision, note)) {
          throw conflict('REVIEW_NOT_PENDING', 'Review is already final');
        }
        if (!reason) await repository.publish(db, resource.id, version.id);
        const updated = await repository.lockReview(db, id, version.id);
        return {
          review_id: id, resource_id: resource.id, version_id: version.id,
          decision, review_note: note, reviewer_id: current.id, reviewed_at: updated.reviewed_at,
          publication_occurred: !reason, publication_reason: reason,
          publication_status: reason ? resource.publication_status : 'published',
          published_version_id: reason ? resource.published_version_id : version.id
        };
      });
    },
    withdraw(actor, id, body) {
      parseId(id);
      const reason = withdrawalReason(body);
      if (actor.role !== 'government') throw forbidden();

      return decisionTransaction(pool, async db => {
        const resource = await repository.lockResource(db, id);
        if (!resource) throw notFound('Resource');
        await currentActor(db, actor);
        if (resource.publication_status !== 'published' || !resource.published_version_id) {
          throw conflict('NOT_PUBLISHED', 'Resource is not published');
        }
        await repository.withdraw(db, id, actor.id, reason);
        return {
          resource_id: id, publication_status: 'hidden', published_version_id: resource.published_version_id,
          administrative_status: 'withdrawn',
          withdrawn_version_id: resource.published_version_id, reason_recorded: true
        };
      });
    },
    async reinstate(actor, id, body) {
      parseId(id);
      if (actor.role !== 'government') throw forbidden();
      requireFields(body, ['version_id']);
      const versionId = parseId(body.version_id);
      const candidate = await repository.candidate(id, versionId);
      if (!candidate) throw notFound('Version');
      const hasFile = candidate.file_path ? await storage.hasPublicPdf(candidate.file_path, maxSize) : false;

      return decisionTransaction(pool, async db => {
        const resource = await repository.lockResource(db, id);
        if (!resource) throw notFound('Resource');
        const current = await currentActor(db, actor);
        if (resource.administrative_status === 'normal') throw conflict('NOT_WITHDRAWN', 'Resource is not on administrative hold');
        const version = await repository.lockVersion(db, id, versionId);
        const review = version && await repository.versionReview(db, versionId);
        const failure = evaluatePublicationEligibility(resource, version, review, {
          hasFile: hasFile && candidate.file_path === version?.file_path
        });
        if (failure) throw conflict(failure, 'Selected Version is not eligible for publication');
        await repository.reinstate(db, id, versionId, current.id);
        return { resource_id: id, published_version_id: versionId, publication_status: 'published', administrative_status: 'normal' };
      });
    }
  };
}

module.exports = { createReviewService };
