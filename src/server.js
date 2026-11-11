'use strict';

const { createApp, VERSION } = require('./app');
const { loadConfig } = require('./config');
const log = require('./logger');

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  // Fail fast and loudly: a Pod that cannot start is caught by the rollout,
  // a Pod that starts with the wrong configuration is not.
  log.error('startup failed: invalid configuration', { error: err.message });
  process.exit(1);
}

const server = createApp().listen(config.port, config.host, () => {
  log.info('kk-payments listening', {
    host: config.host,
    port: config.port,
    version: VERSION,
    dbHost: config.dbHost,
  });
});

// node runs as PID 1 in the container, which ignores SIGTERM unless handled.
// Close the server so in-flight requests finish before the Pod is replaced.
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
});
