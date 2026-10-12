'use strict';

const http = require('http');
const { validatePayment } = require('./payments');

const MAX_BODY_BYTES = 10 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function createApp() {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, { service: 'kk-payments', status: 'ok' });
    }

    if (req.method === 'POST' && req.url === '/payments') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, 400, { status: 'rejected', errors: ['body must be valid JSON under 10 KB'] });
      }
      const result = validatePayment(body);
      if (!result.valid) {
        return sendJson(res, 400, { status: 'rejected', errors: result.errors });
      }
      return sendJson(res, 202, { status: 'accepted', payment: result.payment });
    }

    return sendJson(res, 404, { status: 'not_found' });
  });
}

module.exports = { createApp };
