'use strict';

// Settings that must come from the environment's ConfigMap when running in a
// cluster (APP_ENV set). Locally and in tests (APP_ENV unset) nothing is required.
const REQUIRED_IN_CLUSTER = ['DB_HOST'];

function loadConfig(env) {
  const appEnv = env.APP_ENV || 'local';
  if (appEnv !== 'local') {
    const missing = REQUIRED_IN_CLUSTER.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`missing required environment variable(s): ${missing.join(', ')}`);
    }
  }
  return {
    appEnv,
    dbHost: env.DB_HOST || 'none',
    port: Number(env.PORT) || 3001,
    host: env.BIND_ADDRESS || '0.0.0.0',
  };
}

module.exports = { loadConfig, REQUIRED_IN_CLUSTER };
