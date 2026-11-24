const { Store } = require('express-session');

class MySqlSessionStore extends Store {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  get(id, callback) {
    this.pool.execute('SELECT data FROM auth_sessions WHERE session_id = ? AND expires_at > ?',
      [id, Date.now()]).then(([[row]]) => row?.data ?? null).then(
      data => callback(null, data), callback
    );
  }

  set(id, session, callback) {
    const data = JSON.stringify(session);
    const expires = new Date(session.cookie.expires).getTime();
    this.pool.execute(
      'INSERT INTO auth_sessions (session_id, expires_at, data) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE expires_at = ?, data = ?',
      [id, expires, data, expires, data]
    ).then(() => callback(), callback);
  }

  touch(id, session, callback) {
    const expires = new Date(session.cookie.expires).getTime();
    this.pool.execute(
      'UPDATE auth_sessions SET expires_at = GREATEST(expires_at, ?) WHERE session_id = ? AND expires_at > ?',
      [expires, id, Date.now()]
    ).then(() => callback(), callback);
  }

  destroy(id, callback) {
    this.pool.execute('DELETE FROM auth_sessions WHERE session_id = ?', [id])
      .then(() => callback(), callback);
  }

  async pruneExpired() {
    await this.pool.execute('DELETE FROM auth_sessions WHERE expires_at <= ? LIMIT 10000', [Date.now()]);
  }
}

module.exports = { MySqlSessionStore };
