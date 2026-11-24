async function one(db, sql, values) {
  const [[row]] = await db.execute(sql, values);
  return row;
}

async function withTransaction(pool, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    try {
      await connection.commit();
    } catch (cause) {
      throw new CommitOutcomeUnknown(cause);
    }
    return result;
  } catch (error) {
    try {
      await connection.rollback();
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

function isDatabaseUnavailable(error) {
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ER_SERVER_SHUTDOWN'].includes(error?.code) ||
    error?.message === 'No connections available.';
}

module.exports = { one, withTransaction, CommitOutcomeUnknown, isDatabaseUnavailable };
