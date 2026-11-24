const { one, withTransaction } = require('./mysql');

const joined = `FROM resource_reviews rv JOIN resource_versions v ON v.id = rv.version_id
  JOIN resources r ON r.id = v.resource_id JOIN users owner ON owner.id = r.owner_id`;
const summary = `rv.id AS review_id, r.id AS resource_id, v.id AS version_id, v.title, v.version_number,
  owner.full_name AS owner_name, rv.submitted_at, rv.reviewed_at, rv.decision, r.review_scope, r.review_school_id`;
const scopeSql = {
  government: "r.review_scope = 'government' AND r.review_school_id IS NULL",
  school_admin: "r.review_scope = 'school' AND r.review_school_id = CAST(? AS UNSIGNED)"
};

function scopeValues(actor) {
  return actor.role === 'school_admin' ? [actor.school_id] : [];
}

function createReviewRepository(pool) {
  return {
    list(actor, filters, history) {
      const timestamp = history ? 'rv.reviewed_at' : 'rv.submitted_at';
      const conditions = [scopeSql[actor.role], "v.edit_state = 'submitted'",
        history ? "rv.decision IN ('approved', 'rejected')" : "rv.decision = 'pending'"];
      const values = scopeValues(actor);
      if (filters.search) {
        conditions.push("v.title LIKE ? ESCAPE '!'");
        values.push('%' + filters.search.replace(/[!%_]/g, char => '!' + char) + '%');
      }
      if (filters.decision) {
        conditions.push('rv.decision = ?');
        values.push(filters.decision);
      }
      if (filters.from) {
        conditions.push(timestamp + ' >= ?');
        values.push(filters.from);
      }
      if (filters.to) {
        conditions.push(timestamp + ' < DATE_ADD(?, INTERVAL 1 DAY)');
        values.push(filters.to);
      }

      const where = joined + ' WHERE ' + conditions.join(' AND ');
      return withTransaction(pool, async db => {
        const count = await one(db, 'SELECT COUNT(*) AS total ' + where, values);
        const [data] = await db.execute(`SELECT ${summary} ${where}
          ORDER BY ${timestamp} DESC, rv.id DESC LIMIT ? OFFSET ?`, [...values, filters.limit, filters.offset]);
        return { data, total: Number(count.total) };
      });
    },
    detail(actor, id) {
      return one(pool, `SELECT ${summary}, v.description, v.author_name, v.category, v.education_level,
        v.resource_type, v.file_path, v.source_url, v.rights_basis, v.access_level, v.edit_state,
        rv.review_note, reviewer.full_name AS reviewer_name, r.publication_status, r.published_version_id,
        s.school_name, s.status AS school_status
        ${joined} LEFT JOIN users reviewer ON reviewer.id = rv.reviewer_id
        LEFT JOIN schools s ON s.id = r.review_school_id
        WHERE rv.id = CAST(? AS UNSIGNED) AND ${scopeSql[actor.role]}`, [id, ...scopeValues(actor)]);
    },
    async history(resourceId) {
      const [rows] = await pool.execute(`SELECT rv.id AS review_id, v.id AS version_id, v.version_number,
        rv.decision, rv.reviewed_at FROM resource_reviews rv JOIN resource_versions v ON v.id = rv.version_id
        WHERE v.resource_id = CAST(? AS UNSIGNED) AND v.edit_state = 'submitted'
        AND rv.decision IN ('approved', 'rejected') ORDER BY v.version_number DESC LIMIT 20`, [resourceId]);
      return rows;
    },
    school(id, db = pool, lock = false) {
      return one(db, 'SELECT id, status FROM schools WHERE id = CAST(? AS UNSIGNED)' + (lock ? ' FOR UPDATE' : ''), [id]);
    },
    lockActor(db, id) {
      return one(db, 'SELECT id, role, status, school_id FROM users WHERE id = CAST(? AS UNSIGNED) FOR UPDATE', [id]);
    },
    lockResource(db, id) {
      return one(db, 'SELECT * FROM resources WHERE id = CAST(? AS UNSIGNED) FOR UPDATE', [id]);
    },
    lockVersion(db, resourceId, versionId) {
      return one(db, `SELECT * FROM resource_versions WHERE resource_id = CAST(? AS UNSIGNED)
        AND id = CAST(? AS UNSIGNED) FOR UPDATE`, [resourceId, versionId]);
    },
    lockReview(db, reviewId, versionId) {
      return one(db, `SELECT * FROM resource_reviews WHERE id = CAST(? AS UNSIGNED)
        AND version_id = CAST(? AS UNSIGNED) FOR UPDATE`, [reviewId, versionId]);
    },
    priorApproval(db, id, reviewId) {
      return one(db, `SELECT rv.id FROM resource_versions v STRAIGHT_JOIN resource_reviews rv
        FORCE INDEX (uq_resource_reviews_version) ON rv.version_id = v.id
        WHERE v.resource_id = CAST(? AS UNSIGNED) AND rv.decision = 'approved'
        AND rv.id <> CAST(? AS UNSIGNED) LIMIT 1 FOR SHARE`, [id, reviewId]);
    },
    approvedPointer(db, id, versionId) {
      return one(db, `SELECT v.version_number FROM resource_versions v JOIN resource_reviews rv ON rv.version_id = v.id
        WHERE v.resource_id = CAST(? AS UNSIGNED) AND v.id = CAST(? AS UNSIGNED)
        AND v.edit_state = 'submitted' AND rv.decision = 'approved' FOR SHARE`, [id, versionId]);
    },
    async finish(db, id, actorId, decision, note) {
      const [result] = await db.execute(`UPDATE resource_reviews SET decision = ?, reviewer_id = CAST(? AS UNSIGNED),
        review_note = ?, reviewed_at = GREATEST(UTC_TIMESTAMP(), submitted_at)
        WHERE id = CAST(? AS UNSIGNED) AND decision = 'pending'`, [decision, actorId, note, id]);
      return result.affectedRows === 1;
    },
    async publish(db, resourceId, versionId) {
      await db.execute(`UPDATE resources SET publication_status = 'published', published_version_id = CAST(? AS UNSIGNED)
        WHERE id = CAST(? AS UNSIGNED)`, [versionId, resourceId]);
    },
    async withdraw(db, resourceId) {
      await db.execute(`UPDATE resources SET publication_status = 'hidden', published_version_id = NULL
        WHERE id = CAST(? AS UNSIGNED)`, [resourceId]);
    }
  };
}

module.exports = { createReviewRepository };
