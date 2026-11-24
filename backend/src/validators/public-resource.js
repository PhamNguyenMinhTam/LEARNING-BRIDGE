const { invalid, requireFields, text, pageNumber } = require('./input');

const resourceTypes = Object.freeze(['external_link', 'pdf', 'authored_document']);
const sorts = Object.freeze(['newest', 'oldest', 'title_asc', 'title_desc']);

function publicFilters(query) {
  requireFields(query, ['search', 'category', 'education_level', 'resource_type', 'page', 'limit', 'sort']);
  const page = pageNumber(query.page, 1, 1000000, 'page');
  const limit = pageNumber(query.limit, 12, 50, 'limit');
  const sort = query.sort === undefined ? 'newest' : query.sort;
  if (!sorts.includes(sort)) throw invalid('sort');
  if (query.resource_type !== undefined && !resourceTypes.includes(query.resource_type)) throw invalid('resource_type');
  const result = { page, limit, sort, resource_type: query.resource_type };
  for (const field of ['search', 'category', 'education_level']) {
    if (query[field] !== undefined) result[field] = text(query[field], 100, field);
  }
  return result;
}

module.exports = { publicFilters };
