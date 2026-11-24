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

module.exports = { one, withTransaction, CommitOutcomeUnknown };
