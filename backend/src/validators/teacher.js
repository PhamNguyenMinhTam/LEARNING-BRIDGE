const { invalid, parseId, requireFields, text, pageNumber } = require('./input');

const decisions = ['pending', 'approved', 'rejected'];
const distributionRights = ['own_work', 'open_license', 'authorized_distribution'];
const metadata = ['title', 'description', 'author_name', 'category', 'education_level',
  'resource_type', 'source_url', 'rights_basis', 'access_level'];

function choice(value, values, field) {
  if (!values.includes(value)) throw invalid(field);
  return value;
}

function inputId(value) {
  return parseId(Number.isSafeInteger(value) ? String(value) : value);
}

function associationInput(body) {
  requireFields(body, ['school_id', 'teacher_code']);
  if (typeof body.teacher_code !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(body.teacher_code)) {
    throw invalid('teacher_code');
  }
  return { schoolId: inputId(body.school_id), code: body.teacher_code };
}

function associationStatus(body) {
  requireFields(body, ['status']);
  return choice(body.status, ['active', 'inactive'], 'status');
}

function resourceScope(body) {
  requireFields(body, ['review_scope', 'review_school_id', ...metadata]);
  const scope = choice(body.review_scope, ['school', 'government'], 'review_scope');
  if (scope === 'government' && body.review_school_id != null) throw invalid('review_school_id');
  return { scope, schoolId: scope === 'school' ? inputId(body.review_school_id) : null };
}

function httpsUrl(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > 2048 || /[\p{White_Space}\p{Control}\\]/u.test(value) ||
      !/^https:\/\//i.test(value)) throw invalid('source_url');
  const url = URL.parse(value);
  if (!url || !url.hostname || url.username || url.password || url.href.length > 2048) {
    throw invalid('source_url');
  }
  return url.href;
}

function versionMetadata(data, { submitting = false } = {}) {
  const result = {
    title: text(data.title, 255, 'title'),
    description: text(data.description, 16000, 'description', true),
    author_name: text(data.author_name, 200, 'author_name'),
    category: text(data.category, 100, 'category'),
    education_level: text(data.education_level, 100, 'education_level'),
    resource_type: choice(data.resource_type, ['pdf', 'external_link', 'authored_document'], 'resource_type'),
    source_url: httpsUrl(data.source_url),
    rights_basis: choice(data.rights_basis, [...distributionRights, 'official_link', 'unknown'], 'rights_basis'),
    access_level: choice(data.access_level, ['public', 'restricted'], 'access_level'),
    file_path: data.file_path ?? null
  };
  if (result.access_level === 'public' && result.rights_basis === 'unknown') throw invalid('rights_basis');
  if (result.rights_basis === 'official_link' && result.resource_type !== 'external_link') throw invalid('rights_basis');
  if (result.resource_type === 'external_link') {
    if (!result.source_url) throw invalid('source_url');
    result.file_path = null;
  }
  if (result.resource_type === 'pdf' && !result.file_path) throw invalid('PDF file');
  if (result.file_path && !distributionRights.includes(result.rights_basis)) throw invalid('file distribution rights');
  if (submitting && !result.file_path && !result.source_url) throw invalid('resource content');
  return result;
}

function initialVersion(body, author) {
  return versionMetadata({ rights_basis: 'unknown', access_level: 'restricted', author_name: author, ...body });
}

function patchVersion(current, body) {
  requireFields(body, metadata);
  if (!Object.keys(body).length) throw invalid('request body');
  return versionMetadata({ ...current, ...body });
}

function sourceVersion(body = {}) {
  requireFields(body, ['source_version_id']);
  return body.source_version_id === undefined ? null : inputId(body.source_version_id);
}

function listResources(query) {
  requireFields(query, ['review_scope', 'publication_status', 'decision', 'page', 'limit']);
  const rules = {
    review_scope: ['school', 'government'], publication_status: ['hidden', 'published'], decision: decisions
  };
  for (const [key, values] of Object.entries(rules)) {
    if (query[key] !== undefined) choice(query[key], values, key);
  }
  const page = pageNumber(query.page, 1, 1000000, 'page');
  const limit = pageNumber(query.limit, 20, 100, 'limit');
  return { ...query, page, limit, offset: (page - 1) * limit };
}

module.exports = {
  associationInput, associationStatus, resourceScope, initialVersion, patchVersion, sourceVersion,
  listResources, versionMetadata, httpsUrl
};
