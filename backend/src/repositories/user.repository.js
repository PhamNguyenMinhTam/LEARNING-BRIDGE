const { ApiError } = require('../utils/api-error');

const profile = 'id, full_name, email, role, status, school_id';

function createUserRepository(pool) {
  async function query(sql, values) {
    try {
      const [result] = await pool.execute(sql, values);
      return result;
    } catch (cause) {
      if (cause.code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'EMAIL_IN_USE', 'Email already registered', cause);
      }
      if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
        'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ER_SERVER_SHUTDOWN'].includes(cause.code) ||
        cause.message === 'No connections available.') {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable', cause);
      }
      throw cause;
    }
  }

  return {
    async findByEmail(email) {
      const [user] = await query(`SELECT ${profile}, password_hash FROM users WHERE email = ?`, [email]);
      return user;
    },
    async findById(id) {
      const [user] = await query(`SELECT ${profile} FROM users WHERE id = CAST(? AS UNSIGNED)`, [id]);
      return user;
    },
    async create({ full_name, email, password_hash }, role) {
      const { insertId } = await query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [full_name, email, password_hash, role]
      );
      return { id: String(insertId), full_name, email, role, status: 'active', school_id: null };
    },
    async findSchoolById(id) {
      const [school] = await query('SELECT id, status FROM schools WHERE id = CAST(? AS UNSIGNED)', [id]);
      return school;
    }
  };
}

module.exports = { createUserRepository };
