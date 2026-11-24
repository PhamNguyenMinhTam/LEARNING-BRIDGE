const { one } = require('./mysql');

const associationFields = `ts.id AS association_id, ts.school_id, s.school_name, ts.teacher_code,
  ts.status, s.status AS school_status, ts.pattern_checked_at`;

function createTeacherSchoolRepository(pool) {
  return {
    async available() {
      const [rows] = await pool.execute("SELECT id, school_code, school_name FROM schools WHERE status = 'active' ORDER BY id");
      return rows;
    },
    async list(teacherId) {
      const [rows] = await pool.execute(`SELECT ${associationFields} FROM teacher_schools ts
        JOIN schools s ON s.id = ts.school_id WHERE ts.teacher_id = CAST(? AS UNSIGNED) ORDER BY ts.id`, [teacherId]);
      return rows;
    },
    association(db, teacherId, id) {
      return one(db, `SELECT ${associationFields} FROM teacher_schools ts JOIN schools s ON s.id = ts.school_id
        WHERE ts.id = CAST(? AS UNSIGNED) AND ts.teacher_id = CAST(? AS UNSIGNED)`, [id, teacherId]);
    },
    schoolForUpdate(db, schoolId) {
      return one(db, 'SELECT id, status, teacher_id_pattern FROM schools WHERE id = CAST(? AS UNSIGNED) FOR UPDATE',
        [schoolId]);
    },
    pairForUpdate(db, teacherId, schoolId) {
      return one(db, `SELECT id, teacher_code, status FROM teacher_schools
        WHERE teacher_id = CAST(? AS UNSIGNED) AND school_id = CAST(? AS UNSIGNED) FOR UPDATE`, [teacherId, schoolId]);
    },
    async insert(db, teacherId, schoolId, code) {
      const [result] = await db.execute(`INSERT INTO teacher_schools (teacher_id, school_id, teacher_code, pattern_checked_at, created_at)
        VALUES (CAST(? AS UNSIGNED), CAST(? AS UNSIGNED), ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`, [teacherId, schoolId, code]);
      return String(result.insertId);
    },
    async activate(db, id, code) {
      await db.execute(`UPDATE teacher_schools SET teacher_code = ?, status = 'active',
        pattern_checked_at = UTC_TIMESTAMP() WHERE id = CAST(? AS UNSIGNED)`, [code, id]);
    },
    async inactivate(db, id) {
      await db.execute("UPDATE teacher_schools SET status = 'inactive' WHERE id = CAST(? AS UNSIGNED)", [id]);
    },
    async markChecked(db, id) {
      await db.execute('UPDATE teacher_schools SET pattern_checked_at = UTC_TIMESTAMP() WHERE id = CAST(? AS UNSIGNED)', [id]);
    }
  };
}

module.exports = { createTeacherSchoolRepository };
