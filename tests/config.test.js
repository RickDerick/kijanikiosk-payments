'use strict';

const { loadConfig } = require('../src/config');

test('local run needs no cluster settings', () => {
  const config = loadConfig({});
  expect(config.appEnv).toBe('local');
  expect(config.port).toBe(3001);
});

test('cluster run with DB_HOST loads it', () => {
  const config = loadConfig({ APP_ENV: 'staging', DB_HOST: 'postgres-staging' });
  expect(config.appEnv).toBe('staging');
  expect(config.dbHost).toBe('postgres-staging');
});

test('cluster run without DB_HOST fails fast', () => {
  expect(() => loadConfig({ APP_ENV: 'production' })).toThrow('DB_HOST');
});
