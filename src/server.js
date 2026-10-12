'use strict';

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3001;
const host = process.env.BIND_ADDRESS || '0.0.0.0';

createApp().listen(port, host, () => {
  console.log(`kk-payments listening on ${host}:${port}`);
});
