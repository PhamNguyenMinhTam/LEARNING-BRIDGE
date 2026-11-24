async function one(db, sql, values) {
  const [[row]] = await db.execute(sql, values);
  return row;
}

async function withTransaction(pool, work, { readOnlySnapshot = false } = {}) {
  const connection = await pool.getConnection();
  let started = false;
  try {
    if (readOnlySnapshot) await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await connection.beginTransaction();
    started = true;
    const result = await work(connection);
    try {
      await connection.commit();
    } catch (cause) {
      throw new CommitOutcomeUnknown(cause);
    }
    return result;
  } catch (error) {
    try {
      if (!started && readOnlySnapshot) connection.destroy();
      else await connection.rollback();
    } catch {
      connection.destroy();
    }
    throw error;
  } finally {
    connection.release();
  }
}

class CommitOutcomeUnknown extends Error {
  constructor(cause) {
    super('Could not confirm database commit', { cause });
  }
}

async function withLockRetry(pool, work, busyError) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await withTransaction(pool, work);
    } catch (error) {
      if (!['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw error;
      if (attempt === 1) throw busyError();
    }
  }
}

function isDatabaseUnavailable(error) {
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ER_SERVER_SHUTDOWN'].includes(error?.code) ||
    error?.message === 'No connections available.';
}

module.exports = { one, withTransaction, withLockRetry, CommitOutcomeUnknown, isDatabaseUnavailable };
