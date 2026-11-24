const { withTransaction, CommitOutcomeUnknown } = require('../repositories/mysql');
const { parseId } = require('../validators/input');
const input = require('../validators/teacher');
const { ApiError } = require('../utils/api-error');

function found(value, label) {
  if (!value) throw new ApiError(404, 'NOT_FOUND', label + ' not found');
  return value;
}

function conflict(code, message) {
  return new ApiError(409, code, message);
}

function requireDraft(version, resource) {
  if (version.edit_state !== 'draft' || resource.published_version_id === version.id) {
    throw conflict('VERSION_IMMUTABLE', 'Only an unpublished Draft Version may be changed');
  }
}

function safeVersion(version, resource) {
  const { file_path, ...profile } = version;
  const published = resource.publication_status === 'published' && resource.published_version_id === version.id;
  return { ...profile, has_file: file_path != null, published };
}

function createResourceService(pool, resources, schools, associations, storage) {
  async function lockVersionContext(db, teacherId, versionId) {
    const locator = found(await resources.resourceForVersion(db, teacherId, versionId), 'Version');
    return found(await resources.lockResource(db, teacherId, locator.id), 'Version');
  }

  function changeVersion(teacherId, versionId, work) {
    parseId(versionId);
    return withTransaction(pool, async db => {
      const resource = await lockVersionContext(db, teacherId, versionId);
      const version = found(await resources.lockVersion(db, resource.id, versionId), 'Version');
      requireDraft(version, resource);
      return work(db, resource, version);
    });
  }

  async function validateScope(db, teacherId, { review_scope, review_school_id }) {
    if (review_scope === 'school') return schools.eligible(db, teacherId, review_school_id);
    if (review_scope !== 'government' || review_school_id !== null) {
      throw conflict('INVALID_SCOPE', 'Invalid Resource review scope');
    }
    await schools.activeTeacher(db, teacherId);
    return null;
  }

  return {
    async list(teacherId, query) {
      const options = input.listResources(query);
      const { data, total } = await resources.list(teacherId, options);
      return { data, pagination: { page: options.page, limit: options.limit, total } };
    },
    create(teacher, body) {
      const scope = input.resourceScope(body);
      const data = input.initialVersion(body, teacher.full_name);
      return withTransaction(pool, async db => {
        await validateScope(db, teacher.id, { review_scope: scope.scope, review_school_id: scope.schoolId });
        const resourceId = await resources.insertResource(db, teacher.id, scope);
        const versionId = await resources.insertVersion(db, resourceId, 1, data);
        return { resource_id: resourceId, version_id: versionId, version_number: 1, publication_status: 'hidden', edit_state: 'draft' };
      });
    },
    detail(teacherId, id) {
      parseId(id);
      return withTransaction(pool, async db => {
        const resource = found(await resources.resource(db, teacherId, id), 'Resource');
        const versions = await resources.versions(db, id);
        return { ...resource, versions: versions.map(version => safeVersion(version, resource)) };
      });
    },
    reviews(teacherId, id) {
      parseId(id);
      return withTransaction(pool, async db => {
        const resource = found(await resources.resource(db, teacherId, id), 'Resource');
        const reviews = await resources.reviews(db, id);
        return reviews.map(review => ({
          ...review,
          published: resource.publication_status === 'published' && resource.published_version_id === review.version_id
        }));
      });
    },
    patch(teacherId, id, body) {
      return changeVersion(teacherId, id, async (db, resource, version) => {
        const data = input.patchVersion(version, body);
        await resources.updateVersion(db, id, data);
        return safeVersion({ ...version, ...data }, resource);
      });
    },
    copy(teacherId, resourceId, body) {
      parseId(resourceId);
      const sourceId = input.sourceVersion(body);
      return withTransaction(pool, async db => {
        found(await resources.lockResource(db, teacherId, resourceId), 'Resource');
        if (await resources.draft(db, resourceId) || await resources.pending(db, resourceId)) {
          throw conflict('ACTIVE_VERSION_EXISTS', 'Resource already has a Draft or Pending Version');
        }
        const latest = found(await resources.latestVersion(db, resourceId), 'Version');
        const source = sourceId ? found(await resources.lockVersion(db, resourceId, sourceId), 'Version') : latest;
        if (latest.version_number >= 4294967295) throw conflict('VERSION_LIMIT', 'Version number limit reached');
        const versionNumber = latest.version_number + 1;
        const versionId = await resources.insertVersion(db, resourceId, versionNumber, source);
        return { resource_id: resourceId, version_id: versionId, version_number: versionNumber, edit_state: 'draft' };
      });
    },
    async checkUpload(teacherId, id) {
      await changeVersion(teacherId, id, (_db, _resource, version) => {
        if (version.resource_type === 'external_link') throw conflict('EXTERNAL_LINK_VERSION', 'External Link Versions cannot receive uploads');
      });
    },
    upload(teacherId, id, buffer) {
      let reference;
      return changeVersion(teacherId, id, async (db, resource, version) => {
        if (version.resource_type === 'external_link') throw conflict('EXTERNAL_LINK_VERSION', 'External Link Versions cannot receive uploads');
        const data = input.versionMetadata({ ...version, resource_type: 'pdf', file_path: 'pending' });
        reference = await storage.save(buffer);
        data.file_path = reference;
        await resources.updateVersion(db, id, data);
        return safeVersion({ ...version, ...data }, resource);
      }).catch(async error => {
        if (reference) {
          try {
            // A lost COMMIT response can leave the write committed.
            if (error instanceof CommitOutcomeUnknown) console.error('Teacher upload cleanup deferred');
            else await storage.remove(reference);
          } catch {
            console.error('Teacher upload cleanup deferred');
          }
        }
        throw error;
      });
    },
    submit(teacherId, versionId) {
      parseId(versionId);
      return withTransaction(pool, async db => {
        const resource = await lockVersionContext(db, teacherId, versionId);
        const association = await validateScope(db, teacherId, resource);
        const version = found(await resources.lockVersion(db, resource.id, versionId), 'Version');
        requireDraft(version, resource);
        const data = input.versionMetadata(version, { submitting: true });
        if (data.file_path && !await storage.exists(data.file_path)) {
          throw conflict('FILE_UNAVAILABLE', 'The draft PDF is unavailable');
        }
        if (await resources.pending(db, resource.id)) {
          throw conflict('PENDING_REVIEW_EXISTS', 'Resource already has a Pending Review');
        }
        if (association) await associations.markChecked(db, association.id);
        const reviewId = await resources.submit(db, versionId);
        return {
          resource_id: resource.id, version_id: versionId, review_id: reviewId,
          decision: 'pending', message: 'Resource version submitted for review'
        };
      });
    }
  };
}

module.exports = { createResourceService };
