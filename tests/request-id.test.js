'use strict';

const { createApp } = require('../src/app');

let server;
let baseUrl;

beforeAll((done) => {
  server = createApp().listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

test('echoes the caller X-Request-Id', async () => {
  const res = await fetch(`${baseUrl}/health`, { headers: { 'X-Request-Id': 'demo-123' } });
  expect(res.headers.get('x-request-id')).toBe('demo-123');
});

test('generates an X-Request-Id when none is sent', async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
});

test('health reports the environment', async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect((await res.json()).environment).toBe('local');
});
