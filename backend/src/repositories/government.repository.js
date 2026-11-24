const { one, withTransaction } = require('./mysql');
const { ApiError } = require('../utils/api-error');

const schoolColumns = 'id, school_code, school_name, teacher_id_pattern, status, created_at';
const adminColumns = 'id, full_name, email, role, school_id, status, created_at';
const schoolId = 'id = CAST(? AS UNSIGNED)';
const adminId = "id = CAST(? AS UNSIGNED) AND role = 'school_admin'";
const schoolUpdates = {
  school_name: 'UPDATE schools SET school_name = ? WHERE ' + schoolId,
  teacher_id_pattern: 'UPDATE schools SET teacher_id_pattern = ? WHERE ' + schoolId,
  status: 'UPDATE schools SET status = ? WHERE ' + schoolId
};

async function insert(db, sql, values, duplicateCode, duplicateMessage) {
  try {
    const [result] = await db.execute(sql, values);
    return String(result.insertId);
  } catch (cause) {
    if (cause.code === 'ER_DUP_ENTRY') throw new ApiError(409, duplicateCode, duplicateMessage, cause);
    throw cause;
  }
}

function createGovernmentRepository(pool) {
  const selectSchool = 'SELECT ' + schoolColumns + ' FROM schools WHERE ' + schoolId;
  const selectAdmin = 'SELECT ' + adminColumns + ' FROM users WHERE ' + adminId;
  async function page(db, from, fields, values, { limit, offset }) {
    const count = await one(db, 'SELECT COUNT(*) AS total ' + from, values);
    const [data] = await db.execute('SELECT ' + fields + ' ' + from + ' ORDER BY id LIMIT ? OFFSET ?',
      [...values, limit, offset]);
    return { data, total: Number(count.total) };
  }

  return {
    listSchools(options) {
      const clauses = [];
      const values = [];
      if (options.status) {
        clauses.push('status = ?');
        values.push(options.status);
      }
      if (options.search) {
        const pattern = '%' + options.search.replace(/[!%_]/g, char => '!' + char) + '%';
        clauses.push("(school_code LIKE ? ESCAPE '!' OR school_name LIKE ? ESCAPE '!')");
        values.push(pattern, pattern);
      }
      const from = 'FROM schools' + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '');
      return withTransaction(pool, db => page(db, from, 'id, school_code, school_name, status', values, options));
    },
    findSchool(id) {
      return one(pool, selectSchool, [id]);
    },
    createSchool({ school_code, school_name, teacher_id_pattern, status }) {
      return withTransaction(pool, async db => {
        const id = await insert(db,
          'INSERT INTO schools (school_code, school_name, teacher_id_pattern, status) VALUES (?, ?, ?, ?)',
          [school_code, school_name, teacher_id_pattern, status], 'SCHOOL_CODE_IN_USE', 'School code already registered');
        return one(db, selectSchool, [id]);
      });
    },
    updateSchool(id, key, value) {
      return withTransaction(pool, async db => {
        await db.execute(schoolUpdates[key], [value, id]);
        return one(db, selectSchool, [id]);
      });
    },
    listAdmins(id, options) {
      return withTransaction(pool, async db => {
        if (!await one(db, selectSchool, [id])) return null;
        return page(db, "FROM users WHERE role = 'school_admin' AND school_id = CAST(? AS UNSIGNED)",
          adminColumns, [id], options);
      });
    },
    provisionAdmin(id, fields) {
      return withTransaction(pool, async db => {
        // Keep the School active from the status check through account creation.
        const school = await one(db, selectSchool + ' FOR UPDATE', [id]);
        if (!school) return null;
        if (school.status !== 'active') throw new ApiError(409, 'SCHOOL_SUSPENDED', 'School is suspended');

        const admin = await insert(db,
          "INSERT INTO users (full_name, email, password_hash, role, school_id) VALUES (?, ?, ?, 'school_admin', CAST(? AS UNSIGNED))",
          [fields.full_name, fields.email, fields.password_hash, school.id], 'EMAIL_IN_USE', 'Email already registered');
        return one(db, selectAdmin, [admin]);
      });
    },
    updateAdminStatus(id, status) {
      return withTransaction(pool, async db => {
        await db.execute('UPDATE users SET status = ? WHERE ' + adminId, [status, id]);
        return one(db, selectAdmin, [id]);
      });
    }
  };
}

module.exports = { createGovernmentRepository };
