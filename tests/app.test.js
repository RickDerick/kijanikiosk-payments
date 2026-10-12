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

const postPayment = (body) =>
  fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('GET /health reports ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ service: 'kk-payments', status: 'ok' });
});

test('POST /payments accepts a valid payment', async () => {
  const res = await postPayment({
    amount: 250.5,
    currency: 'KES',
    phone: '+254712345678',
    reference: 'ORDER-2002',
  });
  expect(res.status).toBe(202);
  const body = await res.json();
  expect(body.status).toBe('accepted');
  expect(body.payment.amountCents).toBe(25050);
});

test('POST /payments rejects an invalid payment with reasons', async () => {
  const res = await postPayment({ amount: -1, currency: 'KES', phone: '0712345678', reference: 'X' });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.status).toBe('rejected');
  expect(body.errors).toContain('amount must be greater than zero');
});

test('POST /payments rejects malformed JSON', async () => {
  const res = await postPayment('{not json');
  expect(res.status).toBe(400);
});

test('unknown routes return 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  expect(res.status).toBe(404);
});
