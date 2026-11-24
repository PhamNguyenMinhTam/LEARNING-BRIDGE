const mysql = require('mysql2/promise');

function createDatabasePool(settings) {
  return mysql.createPool({
    ...settings,
    charset: 'UTF8MB4_UNICODE_CI',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 5,
    waitForConnections: false,
    connectTimeout: 3000
  });
}

module.exports = { createDatabasePool };
