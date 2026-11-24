const { one, withTransaction } = require('./mysql');
const { ApiError } = require('../utils/api-error');

const collation = 'utf8mb4_0900_ai_ci';
const select = `SELECT r.id, r.publication_status, r.published_version_id, r.created_at,
  CAST(r.created_at AS CHAR) AS created_cursor,
  v.id AS version_id, v.resource_id, v.title, v.description, v.author_name, v.category,
  v.education_level, v.resource_type, v.file_path, v.source_url, v.rights_basis, v.access_level,
  v.version_number, v.edit_state, rv.version_id AS reviewed_version_id, rv.decision
  FROM resources r JOIN resource_versions v ON v.resource_id = r.id AND v.id = r.published_version_id
  JOIN resource_reviews rv ON rv.version_id = v.id AND rv.decision = 'approved'
  WHERE r.publication_status = 'published' AND v.edit_state = 'submitted'
    AND v.access_level = 'public' AND v.rights_basis IN ('own_work', 'open_license', 'authorized_distribution', 'official_link')`;

const orderBy = {
  newest: { column: 'r.created_at', key: 'created_cursor', parameter: 'CAST(? AS DATETIME)', direction: 'DESC', op: '<' },
  oldest: { column: 'r.created_at', key: 'created_cursor', parameter: 'CAST(? AS DATETIME)', direction: 'ASC', op: '>' },
  title_asc: { column: 'v.title', key: 'title', parameter: 'CONVERT(? USING utf8mb4) COLLATE ' + collation, direction: 'ASC', op: '>' },
  title_desc: { column: 'v.title', key: 'title', parameter: 'CONVERT(? USING utf8mb4) COLLATE ' + collation, direction: 'DESC', op: '<' }
};

function queryConditions(filters) {
  const conditions = [];
  const values = [];
  if (filters.search !== undefined) {
    const pattern = '%' + filters.search.replace(/[!%_]/g, character => '!' + character) + '%';
    conditions.push(`(v.title COLLATE ${collation} LIKE ? ESCAPE '!'
      OR v.description COLLATE ${collation} LIKE ? ESCAPE '!'
      OR v.author_name COLLATE ${collation} LIKE ? ESCAPE '!')`);
    values.push(pattern, pattern, pattern);
  }
  for (const key of ['category', 'education_level', 'resource_type']) {
    if (filters[key] !== undefined) {
      conditions.push('v.' + key + ' = ?');
      values.push(filters[key]);
    }
  }
  return { where: conditions.length ? ' AND ' + conditions.join(' AND ') : '', values };
}

function createPublicResourceRepository(pool) {
  let activeScans = 0;
  return {
    find(id) {
      return one(pool, select + ' AND r.id = CAST(? AS UNSIGNED)', [id]);
    },
    async scan(filters, visit) {
      // Eligibility includes the local file. Scan bounded batches for exact eligible counts.
      if (activeScans >= 2) throw new ApiError(503, 'PUBLIC_SEARCH_BUSY', 'Public search is temporarily busy');
      activeScans++;
      try {
        const { where, values } = queryConditions(filters);
        const { column, key, direction, parameter, op } = orderBy[filters.sort];
        const batchSize = 64;
        await withTransaction(pool, async db => {
          let last;
          for (;;) {
            const cursor = last ? ` AND (${column} ${op} ${parameter}
              OR (${column} = ${parameter} AND r.id ${op} CAST(? AS UNSIGNED)))` : '';
            const cursorValues = last ? [last[key], last[key], last.id] : [];
            const [rows] = await db.execute(`${select}${where}${cursor}
              ORDER BY ${column} ${direction}, r.id ${direction} LIMIT ?`, [...values, ...cursorValues, batchSize]);
            if (!rows.length) break;
            await visit(rows);
            if (rows.length < batchSize) break;
            last = rows.at(-1);
          }
        }, { readOnlySnapshot: true });
      } finally {
        activeScans--;
      }
    }
  };
}

module.exports = { createPublicResourceRepository };
