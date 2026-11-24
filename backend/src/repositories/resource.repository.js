const { one, withTransaction } = require('./mysql');

const versionFields = ['title', 'description', 'author_name', 'category', 'education_level',
  'resource_type', 'source_url', 'rights_basis', 'access_level', 'file_path'];
const resourceQuery = `SELECT r.id, r.owner_id, r.review_scope, r.review_school_id, r.publication_status,
  r.published_version_id, r.administrative_status, r.created_at, s.school_name, s.school_code, s.status AS school_status
  FROM resources r LEFT JOIN schools s ON s.id = r.review_school_id`;
const versionOwner = 'WHERE r.id = CAST(? AS UNSIGNED) AND r.owner_id = CAST(? AS UNSIGNED)';

function createResourceRepository(pool) {
  return {
    async list(teacherId, options) {
      const conditions = ['r.owner_id = CAST(? AS UNSIGNED)'];
      const values = [teacherId];
      for (const [key, column] of [['review_scope', 'r.review_scope'], ['publication_status', 'r.publication_status'],
        ['decision', 'latest_review.decision']]) {
        if (options[key] !== undefined) {
          conditions.push(column + ' = ?');
          values.push(options[key]);
        }
      }
      const from = `FROM resources r LEFT JOIN schools s ON s.id = r.review_school_id
        LEFT JOIN resource_versions latest ON latest.id = (SELECT v.id FROM resource_versions v
          WHERE v.resource_id = r.id ORDER BY v.version_number DESC LIMIT 1)
        LEFT JOIN resource_reviews latest_review ON latest_review.id = (
          SELECT rv.id FROM resource_versions v JOIN resource_reviews rv ON rv.version_id = v.id
          WHERE v.resource_id = r.id ORDER BY v.version_number DESC LIMIT 1)
        WHERE ${conditions.join(' AND ')}`;

      return withTransaction(pool, async db => {
        const count = await one(db, 'SELECT COUNT(*) AS total ' + from, values);
        const [data] = await db.execute(`SELECT r.id, latest.title, r.review_scope, r.review_school_id,
          s.school_name, r.publication_status, r.published_version_id, latest.version_number AS latest_version_number,
          latest_review.decision AS latest_review_decision, r.created_at ${from}
          ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...values, options.limit, options.offset]);
        return { data, total: Number(count.total) };
      });
    },
    resource(db, teacherId, resourceId) {
      return one(db, `${resourceQuery} ${versionOwner}`, [resourceId, teacherId]);
    },
    lockResource(db, teacherId, resourceId) {
      return one(db, `SELECT r.* FROM resources r ${versionOwner} FOR UPDATE`, [resourceId, teacherId]);
    },
    resourceForVersion(db, teacherId, versionId) {
      return one(db, `SELECT r.id FROM resource_versions v JOIN resources r ON r.id = v.resource_id
        WHERE v.id = CAST(? AS UNSIGNED) AND r.owner_id = CAST(? AS UNSIGNED)`, [versionId, teacherId]);
    },
    activeTeacher(db, id) {
      return one(db, `SELECT id FROM users WHERE id = CAST(? AS UNSIGNED)
        AND role = 'teacher' AND status = 'active' FOR UPDATE`, [id]);
    },
    async insertResource(db, teacherId, { scope, schoolId }) {
      const [result] = await db.execute(`INSERT INTO resources (owner_id, review_scope, review_school_id, created_at)
        VALUES (CAST(? AS UNSIGNED), ?, CAST(? AS UNSIGNED), UTC_TIMESTAMP())`, [teacherId, scope, schoolId]);
      return String(result.insertId);
    },
    async versions(db, resourceId) {
      const [rows] = await db.execute(`SELECT v.*, rv.id AS review_id, rv.decision
        FROM resource_versions v LEFT JOIN resource_reviews rv ON rv.version_id = v.id
        WHERE v.resource_id = CAST(? AS UNSIGNED) ORDER BY v.version_number DESC`, [resourceId]);
      return rows;
    },
    lockVersion(db, resourceId, id) {
      return one(db, `SELECT * FROM resource_versions WHERE resource_id = CAST(? AS UNSIGNED)
        AND id = CAST(? AS UNSIGNED) FOR UPDATE`, [resourceId, id]);
    },
    latestVersion(db, resourceId) {
      return one(db, `SELECT * FROM resource_versions WHERE resource_id = CAST(? AS UNSIGNED)
        ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [resourceId]);
    },
    draft(db, resourceId) {
      return one(db, `SELECT id FROM resource_versions WHERE resource_id = CAST(? AS UNSIGNED)
        AND edit_state = 'draft' LIMIT 1 FOR UPDATE`, [resourceId]);
    },
    pending(db, resourceId) {
      return one(db, `SELECT rv.id FROM resource_versions v STRAIGHT_JOIN resource_reviews rv
        FORCE INDEX (uq_resource_reviews_version) ON rv.version_id = v.id
        WHERE v.resource_id = CAST(? AS UNSIGNED) AND rv.decision = 'pending' LIMIT 1 FOR SHARE`, [resourceId]);
    },
    async insertVersion(db, resourceId, number, data) {
      const [result] = await db.execute(`INSERT INTO resource_versions (resource_id, version_number, ${versionFields.join(', ')}, created_at)
        VALUES (CAST(? AS UNSIGNED), ?, ${versionFields.map(() => '?').join(', ')}, UTC_TIMESTAMP())`,
      [resourceId, number, ...versionFields.map(field => data[field])]);
      return String(result.insertId);
    },
    async updateVersion(db, id, data) {
      await db.execute(`UPDATE resource_versions SET ${versionFields.map(field => field + ' = ?').join(', ')}
        WHERE id = CAST(? AS UNSIGNED) AND edit_state = 'draft'`, [...versionFields.map(field => data[field]), id]);
    },
    async submit(db, versionId) {
      const [changed] = await db.execute(`UPDATE resource_versions SET edit_state = 'submitted'
        WHERE id = CAST(? AS UNSIGNED) AND edit_state = 'draft'`, [versionId]);
      if (changed.affectedRows !== 1) throw new Error('Draft transition failed');
      const [result] = await db.execute("INSERT INTO resource_reviews (version_id, decision, submitted_at) VALUES (CAST(? AS UNSIGNED), 'pending', UTC_TIMESTAMP())",
        [versionId]);
      return String(result.insertId);
    },
    async reviews(db, resourceId) {
      const [rows] = await db.execute(`SELECT v.id AS version_id, v.version_number, rv.id AS review_id,
        rv.decision, rv.review_note, rv.submitted_at, rv.reviewed_at, u.full_name AS reviewer_name
        FROM resource_versions v JOIN resource_reviews rv ON rv.version_id = v.id
        LEFT JOIN users u ON u.id = rv.reviewer_id WHERE v.resource_id = CAST(? AS UNSIGNED)
        ORDER BY v.version_number DESC`, [resourceId]);
      return rows;
    }
  };
}

module.exports = { createResourceRepository };
