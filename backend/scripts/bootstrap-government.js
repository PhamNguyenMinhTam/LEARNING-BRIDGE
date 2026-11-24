const { text } = require('node:stream/consumers');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { createUserRepository } = require('../src/repositories/user.repository');
const { registrationFields, hashPassword } = require('../src/services/credentials');

async function main() {
  const [email, full_name, ...extra] = process.argv.slice(2);
  if (!email || !full_name || extra.length || process.stdin.isTTY) {
    throw new Error('Provide email and full name as arguments, and pipe the password on stdin.');
  }
  const password = (await text(process.stdin)).replace(/\r?\n$/, '');
  const fields = registrationFields({ email, full_name, password });
  const pool = createDatabasePool(loadConfig().database);
  try {
    const password_hash = await hashPassword(fields.password);
    await createUserRepository(pool).create({
      full_name: fields.full_name, email: fields.email, password_hash
    }, 'government');
    console.log('Government account created.');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  if (error.code === 'EMAIL_IN_USE') {
    console.error('An account with that email already exists.');
  } else {
    console.error('Bootstrap failed. Check the arguments, password rules and database configuration.');
  }
  process.exitCode = 1;
});
