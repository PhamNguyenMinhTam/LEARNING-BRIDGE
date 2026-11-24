const assert = require('node:assert/strict');
const { test } = require('node:test');
const { reviewFilters, reviewNote } = require('../src/validators/review');
const { evaluatePublicationEligibility } = require('../src/services/publication.service');
const { createReviewService } = require('../src/services/review.service');

const resource = { id: '1', review_scope: 'government', review_school_id: null, publication_status: 'hidden', published_version_id: null };
const version = {
  id: '2', resource_id: '1', edit_state: 'submitted', resource_type: 'external_link',
  rights_basis: 'official_link', access_level: 'public', source_url: 'https://example.invalid/book',
  file_path: null, version_number: 1
};
const review = { id: '3', version_id: '2', decision: 'approved' };

test('publication validates scope of Version and Review, content, rights, access and hold', () => {
  const evaluate = (patch = {}, options) =>
    evaluatePublicationEligibility(resource, { ...version, ...patch }, review, options);
  assert.equal(evaluate(), null);
  assert.equal(evaluate({ resource_id: 'another' }), 'VERSION_NOT_APPROVED');
  assert.equal(evaluate({ edit_state: 'draft' }), 'VERSION_NOT_APPROVED');
  assert.equal(evaluatePublicationEligibility(resource, version, { ...review, decision: 'pending' }), 'VERSION_NOT_APPROVED');
  assert.equal(evaluate({ access_level: 'restricted' }), 'ACCESS_RESTRICTED');
  assert.equal(evaluate({ rights_basis: 'unknown' }), 'RIGHTS_NOT_ELIGIBLE');
  assert.equal(evaluate({ resource_type: 'pdf' }), 'OFFICIAL_LINK_REQUIRED');
  assert.equal(evaluate({ source_url: 'file:///private/book.pdf' }), 'INVALID_SOURCE_URL');
  assert.equal(evaluate({ source_url: null }), 'CONTENT_UNAVAILABLE');
  assert.equal(evaluate({ resource_type: 'pdf', rights_basis: 'own_work', file_path: 'report.pdf' }), 'CONTENT_UNAVAILABLE');
  assert.equal(evaluate({ resource_type: 'pdf', rights_basis: 'own_work', file_path: 'report.pdf' }, { hasFile: true }), null);
  assert.equal(evaluate({}, { withheld: true }), 'HIDDEN_WITH_APPROVAL_HISTORY');
});

test('review input rejects abusive filters and blank rejection notes', () => {
  for (const query of [
    { school_id: '1' }, { from: '2026-02-30' }, { from: '2026-03-01', to: '2026-02-01' },
    { limit: '120' }, { page: ['1', '2'] }, { decision: 'pending' }
  ]) {
    assert.throws(() => reviewFilters(query, true), { status: 400 });
  }
  assert.deepEqual(reviewFilters({ from: '2024-02-29', limit: '3', page: '2' }, false), {
    from: '2024-02-29', to: undefined, limit: 3, page: 2, offset: 3, decision: undefined, search: undefined
  });
  assert.equal(reviewNote(undefined, 'approved'), null);
  assert.equal(reviewNote({ note: ' explanation ' }, 'rejected'), 'explanation');
  for (const body of [undefined, { note: '' }, { note: '  \n' }, { reviewer_id: '3', note: 'x' }]) {
    assert.throws(() => reviewNote(body, 'rejected'), { status: 400 });
  }
});

test('a lock error rolls back and retries the full decision, with no duplicate decision', async () => {
  const actor = { id: '4', role: 'government', school_id: null, status: 'active' };
  const events = [];
  let tries = 0;
  const pool = {
    async getConnection() {
      const attempt = ++tries;
      return {
        attempt, async beginTransaction() { events.push('begin'); },
        async rollback() { events.push('rollback'); }, async commit() { events.push('commit'); }, release() {}
      };
    }
  };
  let finished = 0;
  const repository = {
    detail: async () => ({ resource_id: '1', version_id: '2', edit_state: 'submitted', decision: 'pending' }),
    lockResource: async db => {
      if (db.attempt === 1) throw Object.assign(new Error('lock'), { code: 'ER_LOCK_DEADLOCK' });
      return resource;
    },
    lockActor: async () => actor, lockVersion: async () => version,
    lockReview: async () => ({ ...review, decision: 'pending', reviewed_at: '2026-01-01' }),
    finish: async () => { finished++; return true; }
  };
  const service = createReviewService(pool, repository, {});
  const result = await service.decide(actor, '3', 'rejected', { note: 'Explain' });
  assert.equal(result.decision, 'rejected');
  assert.equal(finished, 1);
  assert.deepEqual(events, ['begin', 'rollback', 'begin', 'commit']);
  repository.lockResource = async () => { throw Object.assign(new Error('lock'), { code: 'ER_LOCK_WAIT_TIMEOUT' }); };
  await assert.rejects(service.decide(actor, '3', 'rejected', { note: 'Explain' }), { code: 'REVIEW_BUSY', status: 409 });
  assert.equal(finished, 1);
});
