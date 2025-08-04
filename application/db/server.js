// server.js
const cds = require('@sap/cds');

cds.on('bootstrap', app => {
  const bodyParser = require('body-parser');

  // Increase request body size limits
  app.use(bodyParser.json({ limit: '25mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));
});

module.exports = cds.server;
