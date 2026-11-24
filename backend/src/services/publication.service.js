const { httpsUrl } = require('../validators/teacher');

const rights = ['own_work', 'open_license', 'authorized_distribution', 'official_link'];

function evaluatePublicationEligibility(resource, version, review, { hasFile = false, withheld = false } = {}) {
  if (!resource || !version || !review || version.resource_id !== resource.id ||
      review.version_id !== version.id || version.edit_state !== 'submitted' || review.decision !== 'approved') {
    return 'VERSION_NOT_APPROVED';
  }
  if (version.access_level !== 'public') return 'ACCESS_RESTRICTED';
  if (!rights.includes(version.rights_basis)) return 'RIGHTS_NOT_ELIGIBLE';
  if (!['external_link', 'pdf', 'authored_document'].includes(version.resource_type)) return 'UNSUPPORTED_RESOURCE_TYPE';
  if (version.rights_basis === 'official_link' && version.resource_type !== 'external_link') return 'OFFICIAL_LINK_REQUIRED';

  let url;
  try {
    url = httpsUrl(version.source_url);
  } catch {
    return 'INVALID_SOURCE_URL';
  }
  const availableFile = Boolean(version.file_path && hasFile);
  if ((version.resource_type === 'external_link' && (!url || version.file_path)) ||
      (version.resource_type === 'pdf' && !availableFile) ||
      (version.resource_type === 'authored_document' && (!availableFile && !url))) return 'CONTENT_UNAVAILABLE';
  if (withheld) return 'HIDDEN_WITH_APPROVAL_HISTORY';
  return null;
}

module.exports = { evaluatePublicationEligibility };
