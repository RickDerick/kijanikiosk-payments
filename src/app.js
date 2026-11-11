'use strict';

const http = require('http');
const { randomUUID } = require('crypto');
const { validatePayment } = require('./payments');
const log = require('./logger');

const MAX_BODY_BYTES = 10 * 1024;
// Deployed tag baked into the image (e.g. 1.0.0-abc1234); falls back to package.json locally
const VERSION = process.env.APP_VERSION || require('../package.json').version;

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
    // Correlation ID: reuse the caller's X-Request-Id or create one, return it,
    // and put it on every log line for this request.
    const requestId = req.headers['x-request-id'] || randomUUID();
    const started = Date.now();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      log.info('request', {
        requestId,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Date.now() - started,
      });
    });

    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, {
        service: 'kk-payments',
        status: 'ok',
        version: VERSION,
        environment: process.env.APP_ENV || 'local',
      });
    }

    if (req.method === 'POST' && req.url === '/payments') {
      let body;
      try {
        body = await readJson(req);
      } catch {
        log.warn('payment rejected: invalid body', { requestId });
        return sendJson(res, 400, { status: 'rejected', errors: ['body must be valid JSON under 10 KB'] });
      }
      const result = validatePayment(body);
      if (!result.valid) {
        log.warn('payment rejected', { requestId, errors: result.errors });
        return sendJson(res, 400, { status: 'rejected', errors: result.errors });
      }
      log.info('payment accepted', { requestId });
      return sendJson(res, 202, { status: 'accepted', payment: result.payment });
    }

    return sendJson(res, 404, { status: 'not_found' });
  });
}

module.exports = { createApp, VERSION };
