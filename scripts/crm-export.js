'use strict';
const { chromium } = require('playwright');
const https = require('https');
const XLSX  = require('xlsx');

const CRM_UI   = 'https://geminilab.8xcrm.net';
const EMAIL    = 'seifsameh@thegeminilab.com';
const PASSWORD = '1234567';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

function getMonthToDateRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: dateStr(start), dateTo: dateStr(now) };
}

// ─── API helper (Bearer token, backend domain, auto-retry on transient errors) ─

async function apiCall(path, method, token, body, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = https.request(
          {
            hostname: 'geminilab.8xcrm.com',
            path, method,
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-localization': 'en',
              'Connection': 'close',
              'Referer': `${CRM_UI}/`,
              'User-Agent': 'Mozilla/5.0',
              ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
          },
          res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
              try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
              catch { resolve(null); }
            });
            res.on('error', reject);
          }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        if (payload) req.write(payload);
        req.end();
      });
      return result;
    } catch (err) {
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message === 'Request timeout';
      if (isTransient && attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ─── Main export function ─────────────────────────────────────────────────────

async function fetchStatusChanges(dateFrom, dateTo) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  let bearerToken   = null;
  let exportJobId   = null;
  let exportTriggerTime = null;

  try {
    const page = await browser.newPage();

    // ── 1. Login — capture Bearer token from login response ───────────────────
    page.on('response', async resp => {
      if (resp.url().includes('/api/v2/auth/login')) {
        const b = await resp.json().catch(() => null);
        if (b?.data?.token) bearerToken = b.data.token;
      }
    });

    console.log('Opening CRM...');
    await page.goto(CRM_UI, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
    await page.locator('input[id*="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(url => !url.href.includes('/login') && !url.href.includes('/auth'), { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    if (!bearerToken) throw new Error('Login failed: Bearer token not captured');
    console.log('Logged in');

    // ── 2. Navigate to Status Changes report ──────────────────────────────────
    const gotIt = page.locator('text=Got it').first();
    if (await gotIt.isVisible({ timeout: 2000 }).catch(() => false)) await gotIt.click();

    console.log('Opening Status Changes report...');
    await page.goto(`${CRM_UI}/reports/smart/status-changes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // ── 3. Open filter panel (Export button lives inside it) ──────────────────
    const filterBtn = page.locator('button').filter({ hasText: /filter/i }).first();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(800);
    }

    // ── 4. Wait for any pending Status Changes exports to clear ───────────────
    console.log('Checking export queue...');
    for (let i = 0; i < 30; i++) {
      const jobs = await apiCall('/api/v2/exports/exports-requests', 'GET', bearerToken);
      const running = (jobs?.data?.data ?? []).filter(j =>
        (j.status?.toLowerCase() === 'running' || j.status?.toLowerCase() === 'pending') &&
        j.export_type?.toLowerCase().includes('status')
      );
      if (running.length < 2) break;
      console.log(`${running.length} Status Changes export(s) pending, waiting 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      if (i === 29) throw new Error('Export queue is full (>2 running Status Changes exports for >150s)');
    }

    // ── 5. Snapshot job IDs BEFORE clicking Export (to detect newly created job)
    const preSnapshot = await apiCall('/api/v2/exports/exports-requests', 'GET', bearerToken);
    const maxIdBefore = Math.max(0, ...(preSnapshot?.data?.data ?? []).map(j => j.id ?? 0));
    console.log(`Export queue snapshot: max job ID before trigger = ${maxIdBefore}`);

    // ── 6. Click Export button ────────────────────────────────────────────────
    page.on('request', req => {
      if (req.url().includes('export-smart-status-changes')) {
        exportTriggerTime = exportTriggerTime ?? Date.now();
        console.log('Export request fired →', req.url());
      }
    });
    page.on('response', async resp => {
      if (resp.url().includes('export-smart-status-changes')) {
        const b = await resp.json().catch(() => null);
        if (b?.data?.id) exportJobId = b.data.id;
        console.log('Export response:', JSON.stringify(b));
      }
    });

    const allBtns = await page.locator('button').all();
    let clicked = false;
    for (const btn of allBtns) {
      const text = await btn.textContent().catch(() => '');
      if (text?.trim().toLowerCase() === 'export' && await btn.isVisible().catch(() => false)) {
        console.log('Clicking Export...');
        await btn.click();
        clicked = true;
        await page.waitForTimeout(3000);
        break;
      }
    }
    if (!clicked) throw new Error('Export button not found on the page');

    exportTriggerTime = exportTriggerTime ?? Date.now();

    console.log('Polling for export completion...');
    const deadline = Date.now() + 240_000; // 4 minutes
    let downloadUrl = null;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      const jobs = await apiCall('/api/v2/exports/exports-requests', 'GET', bearerToken);
      const list = jobs?.data?.data ?? [];

      const job = exportJobId
        ? list.find(j => j.id === exportJobId)
        : list
            .filter(j =>
              j.export_type?.toLowerCase().includes('status') &&
              j.id > maxIdBefore
            )
            .sort((a, b) => b.id - a.id)[0];

      if (!job) {
        process.stdout.write('.');
        continue;
      }

      const status = job.status?.toLowerCase();
      console.log(`\nJob #${job.id} status: ${job.status}`);

      if (status === 'failed') throw new Error(`Export job #${job.id} failed on server`);

      if (status === 'completed') {
        console.log(`Job #${job.id} complete — fetching download link...`);
        const linkResp = await apiCall(
          '/api/v2/exports/exports/generate-download-link',
          'POST', bearerToken,
          { id: job.id }
        );
        console.log('Link response:', JSON.stringify(linkResp));
        downloadUrl = linkResp?.data?.download_url ?? linkResp?.data?.url ?? null;
        if (downloadUrl) break;
        console.log('Download URL not found in response, retrying...');
      }
    }
    console.log('');

    if (!downloadUrl) throw new Error('Export did not complete within 4 minutes');

    // ── 7. Download file using Playwright's request API (uses browser session) ──
    console.log('Downloading Excel via browser request API...');
    const dlResponse = await page.request.get(downloadUrl);
    if (!dlResponse.ok()) throw new Error(`Download failed: HTTP ${dlResponse.status()}`);
    const buffer = await dlResponse.body();

    // ── 8. Parse Excel and filter to requested date range ─────────────────────
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const allRows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const fromMs = new Date(dateFrom + 'T00:00:00Z').getTime();
    const toMs   = new Date(dateTo   + 'T23:59:59Z').getTime();

    const records = allRows.filter(row => {
      const raw = row['CREATED_AT'] ?? row['Created At'] ?? row['created_at'] ?? '';
      if (!raw) return true;
      const ts = new Date(raw).getTime();
      return !isNaN(ts) && ts >= fromMs && ts <= toMs;
    });

    console.log(`Done — ${records.length} records from ${allRows.length} total`);
    return { records, dateFrom, dateTo };

  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { fetchStatusChanges, getMonthToDateRange };
