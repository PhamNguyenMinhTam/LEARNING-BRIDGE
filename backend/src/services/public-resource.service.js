const { ApiError } = require('../utils/api-error');
const { parseId, requireFields } = require('../validators/input');
const { publicFilters } = require('../validators/public-resource');
const { httpsUrl } = require('../validators/teacher');
const { evaluatePublicationEligibility } = require('./publication.service');

function unavailable() {
  return new ApiError(404, 'NOT_FOUND', 'Resource not found');
}

function publicMetadata(row) {
  const { id, title, description, author_name, category, education_level, resource_type, version_number, created_at } = row;
  return { id, title, description, author_name, category, education_level, resource_type, version_number, created_at };
}

function eligible(row, hasFile) {
  if (!row || row.publication_status !== 'published' || row.published_version_id !== row.version_id) return false;
  return evaluatePublicationEligibility(row, { ...row, id: row.version_id }, {
    version_id: row.reviewed_version_id, decision: row.decision
  }, { hasFile }) === null;
}

const collator = new Intl.Collator('vi', { sensitivity: 'base' });
function filterValues(values) {
  return [...values.values()].sort((a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0));
}

function addFilter(values, value) {
  if (typeof value !== 'string') return;
  const clean = value.trim();
  if (!/[^\p{White_Space}]/u.test(clean)) return;
  const key = clean.normalize('NFC').toLocaleLowerCase('vi');
  const existing = values.get(key);
  if (existing === undefined || clean < existing) values.set(key, clean);
}

function createPublicResourceService(repository, storage, maxSize) {
  // Validate DB-only conditions before touching disk. For file-required candidates,
  // simulate availability once so a malformed row cannot trigger file access.
  async function inspect(row) {
    if (!eligible(row, true)) return null;
    const hasFile = row.file_path != null && await storage.hasPublicPdf(row.file_path, maxSize);
    return eligible(row, hasFile) ? { row, hasFile } : null;
  }

  async function inspectBatch(rows, visit) {
    for (let index = 0; index < rows.length; index += 4) {
      const items = await Promise.all(rows.slice(index, index + 4).map(inspect));
      for (const item of items) if (item) visit(item.row);
    }
  }

  return {
    async list(query) {
      const filters = publicFilters(query);
      const { page, limit } = filters;
      const offset = (page - 1) * limit;
      let total = 0;
      const data = [];
      await repository.scan(filters, rows => inspectBatch(rows, row => {
        if (total >= offset && data.length < limit) data.push(publicMetadata(row));
        total++;
      }));
      return { data, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
    },
    async detail(id, query) {
      requireFields(query, []);
      const entry = await inspect(await repository.find(parseId(id)));
      if (!entry) throw unavailable();
      const { row, hasFile } = entry;
      const access_methods = row.resource_type === 'external_link' ? ['external']
        : hasFile ? ['download', 'preview'] : ['source_link'];
      return {
        ...publicMetadata(row), resource_id: row.id, rights_basis: row.rights_basis, access_methods,
        ...(access_methods[0] === 'source_link' ? { source_url: httpsUrl(row.source_url) } : {})
      };
    },
    async external(id, query) {
      requireFields(query, []);
      const row = await repository.find(parseId(id));
      if (row?.resource_type !== 'external_link' || !eligible(row, false)) throw unavailable();
      return { resource_id: row.id, resource_type: row.resource_type, url: httpsUrl(row.source_url), access_method: 'external' };
    },
    async file(id, query) {
      requireFields(query, []);
      const row = await repository.find(parseId(id));
      if (!row?.file_path || !eligible(row, true)) throw unavailable();
      const pdf = await storage.openPublicPdf(row.file_path, maxSize);
      if (!pdf) throw unavailable();
      try {
        // Opening verifies disk contents. Re-read publication before returning the already open handle.
        const current = await repository.find(id);
        if (!eligible(current, true) || current.published_version_id !== row.published_version_id ||
            current.file_path !== row.file_path) throw unavailable();
        return pdf;
      } catch (error) {
        await pdf.close();
        throw error;
      }
    },
    async filters(query) {
      requireFields(query, []);
      const categories = new Map();
      const levels = new Map();
      const types = new Map();
      await repository.scan({ sort: 'oldest' }, rows => inspectBatch(rows, row => {
        addFilter(categories, row.category);
        addFilter(levels, row.education_level);
        addFilter(types, row.resource_type);
      }));
      return { categories: filterValues(categories), education_levels: filterValues(levels), resource_types: filterValues(types) };
    }
  };
}

module.exports = { createPublicResourceService };
