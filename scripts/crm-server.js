'use strict';
const http = require('http');
const { fetchStatusChanges, getMonthToDateRange } = require('./crm-export');

const PORT = process.env.PORT || 3001;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let busy = false;

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const json = (status, body) => {
    res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (req.url === '/health') {
    json(200, { ok: true, busy });
    return;
  }

  // ── POST /update ─────────────────────────────────────────────────────────────
  if (req.url === '/update' && req.method === 'POST') {
    if (busy) {
      json(429, { ok: false, error: 'An export is already running, please try again in a minute' });
      return;
    }

    // Read POST body for dateFrom / dateTo; fall back to month-to-date
    let body = {};
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      if (raw) body = JSON.parse(raw);
    } catch {
      // ignore parse errors; fall back to defaults
    }

    const defaults = getMonthToDateRange();
    const dateFrom = body.dateFrom || defaults.dateFrom;
    const dateTo   = body.dateTo   || defaults.dateTo;

    busy = true;
    try {
      console.log(`[${new Date().toISOString()}] /update — ${dateFrom} → ${dateTo}`);
      const { records } = await fetchStatusChanges(dateFrom, dateTo);
      json(200, { ok: true, count: records.length, dateFrom, dateTo, data: records });
    } catch (err) {
      console.error('Export error:', err.message);
      json(500, { ok: false, error: err.message });
    } finally {
      busy = false;
    }
    return;
  }

  json(404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\nCRM automation server running on http://localhost:${PORT}`);
  console.log('  POST /update  — fetch Status Changes from CRM (body: { dateFrom, dateTo })');
  console.log('  GET  /health  — liveness check\n');
});
