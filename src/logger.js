'use strict';

// Structured JSON logs: one object per line on stdout, so the container
// runtime collects them and the error-rate monitor can parse them.
// Silent under Jest so test output stays readable.
const SILENT = process.env.NODE_ENV === 'test' || process.env.LOG_LEVEL === 'silent';

function write(level, msg, fields) {
  if (SILENT) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'kk-payments',
    env: process.env.APP_ENV || 'local',
    msg,
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = {
  info: (msg, fields = {}) => write('info', msg, fields),
  warn: (msg, fields = {}) => write('warn', msg, fields),
  error: (msg, fields = {}) => write('error', msg, fields),
};
