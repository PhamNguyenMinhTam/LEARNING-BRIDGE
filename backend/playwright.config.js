const { defineConfig } = require('@playwright/test');
const { loadConfig } = require('./src/config/env');

const config = loadConfig();
if (process.env.RUN_BROWSER_E2E !== '1' || config.database.host !== '127.0.0.1' ||
    !/^learning_bridge_(?:auth|e2e)_test(?:_[a-z0-9]+)?$/.test(config.database.database)) {
  throw new Error('Browser tests require RUN_BROWSER_E2E=1 and a fresh isolated loopback test schema.');
}

if (!process.env.E2E_UPLOAD_DIRECTORY) throw new Error('Set E2E_UPLOAD_DIRECTORY to a dedicated temporary folder.');

const port = Number(process.env.E2E_PORT || 3107);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid E2E_PORT');
const origin = 'http://127.0.0.1:' + port;

module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    channel: process.env.E2E_BROWSER_CHANNEL || 'chrome',
    baseURL: origin,
    actionTimeout: 10000,
    navigationTimeout: 15000,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'node src/server.js',
    url: origin + '/api/health',
    timeout: 15000,
    env: { NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), AUTH_ORIGINS: origin }
  }
});
