import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/CompuShop/nodejs/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const XLSX = require(path.join(ROOT, 'node_modules', 'xlsx'));

const PASSWORD = '2na2smiMohanned';
// Full international number — react-phone-number-input auto-detects Egypt (+20)
// Do NOT manipulate the country select; just type the full E.164 number
const FULL_PHONE = '+201011011096';

const TARGETS = [
  { locationEn: 'New Capital', locationAr: 'العاصمة الإدارية', typeEn: 'Residential', typeAr: 'سكني' },
  { locationEn: 'New Capital', locationAr: 'العاصمة الإدارية', typeEn: 'Commercial',  typeAr: 'تجاري' },
  { locationEn: 'New Cairo',   locationAr: 'القاهرة الجديدة',  typeEn: 'Residential', typeAr: 'سكني' },
  { locationEn: 'New Cairo',   locationAr: 'القاهرة الجديدة',  typeEn: 'Commercial',  typeAr: 'تجاري' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryClick(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible()) && (await el.isEnabled())) {
        await el.click();
        return sel;
      }
    } catch {}
  }
  return null;
}

async function extractListings(page, locationEn, typeEn) {
  return page.evaluate(({ locationEn, typeEn }) => {
    const cardSels = [
      '[class*="card"]','[class*="listing"]','[class*="property"]',
      '[class*="project"]','[class*="unit"]','[class*="compound"]',
      'article','[data-id]','[class*="item"]',
    ];
    let cards = [];
    for (const sel of cardSels) {
      const found = [...document.querySelectorAll(sel)].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 80 && r.height > 60;
      });
      if (found.length >= 2) { cards = found; break; }
    }
    const get = (p, sels) => {
      for (const s of sels) {
        const el = p.querySelector(s);
        if (el && el.innerText.trim()) return el.innerText.trim();
      }
      return '';
    };
    return cards.map(card => ({
      location:  locationEn, type: typeEn,
      name:      get(card, ['h1','h2','h3','h4','[class*="title"]','[class*="name"]','[class*="project"]']),
      price:     get(card, ['[class*="price"]','[class*="cost"]','[class*="amount"]']),
      area:      get(card, ['[class*="area"]','[class*="size"]','[class*="space"]','[class*="sqm"]']),
      developer: get(card, ['[class*="developer"]','[class*="company"]','[class*="builder"]']),
      unit_type: get(card, ['[class*="unit-type"]','[class*="property-type"]']),
      bedrooms:  get(card, ['[class*="bedroom"]','[class*="room"]','[class*="bed"]']),
      floor:     get(card, ['[class*="floor"]','[class*="level"]']),
      finishing: get(card, ['[class*="finish"]']),
      delivery:  get(card, ['[class*="deliver"]','[class*="handover"]']),
      phone:     get(card, ['[class*="phone"]','[class*="mobile"]','[class*="contact"]']),
      link:      (card.querySelector('a[href]') || {}).href || '',
      raw:       card.innerText.replace(/\s+/g, ' ').trim().slice(0, 800),
    }));
  }, { locationEn, typeEn });
}

// ═══════════════════════════════════════════════════════════════
const browser = await chromium.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await context.newPage();
page.setDefaultTimeout(60000);

// Intercept API responses
const capturedApiData = {};
page.on('response', async (response) => {
  try {
    if (response.status() !== 200) return;
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    const json = await response.json();
    const arr = Array.isArray(json) ? json
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.results) ? json.results
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.units) ? json.units
      : Array.isArray(json?.properties) ? json.properties
      : null;
    if (arr && arr.length > 0) {
      const short = response.url().split('masterv.net')[1] || response.url();
      console.log(`[API] ${short} → ${arr.length} items`);
      capturedApiData[response.url()] = arr;
    }
  } catch {}
});

// ── STEP 1: Load page ──────────────────────────────────────────
console.log('Opening masterv.net...');
await page.goto('https://masterv.net', { waitUntil: 'networkidle', timeout: 60000 });
await sleep(3000);
console.log('Title:', await page.title(), '| URL:', page.url());

// ── STEP 2: Dismiss mandatory "Update Available" toast ─────────
// This toast BLOCKS login — must be clicked before credentials are filled
console.log('\nWaiting for "Update Available" notice...');
try {
  // Wait up to 8 seconds for it to appear
  await page.waitForFunction(
    () => document.body.innerText.includes('Click Here To Update'),
    { timeout: 8000 }
  );
  console.log('Update notice found — clicking "Click Here To Update"...');

  const updateBtn = page.locator('button, a').filter({ hasText: 'Click Here To Update' }).first();
  await updateBtn.click();

  // The click may trigger a page reload (service worker update)
  try {
    await page.waitForNavigation({ timeout: 10000 });
    console.log('Page navigated after update click');
  } catch {
    console.log('No navigation after update click — waiting...');
  }
  await sleep(4000);
  console.log('After update URL:', page.url());
} catch {
  console.log('No update notice appeared — continuing with login');
}

// Re-wait for page to be ready after possible reload
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await sleep(2000);

// ── STEP 3: Login ──────────────────────────────────────────────
console.log('\n── Logging in...');

// Fill the FULL international number — react-phone-number-input auto-detects country
// Do NOT touch the country select; typing "+20..." causes the library to pick Egypt itself
const phoneInput = page.locator('input[name="Method"]');
await phoneInput.click({ clickCount: 3 }); // select all existing text
await phoneInput.fill(FULL_PHONE);
console.log('Phone:', FULL_PHONE);

// Fill password
await page.fill('input[name="Password"]', PASSWORD);
console.log('Password filled');

// Screenshot before submit
await page.screenshot({ path: path.join(ROOT, 'scripts', 'before-submit.png') });
console.log('Screenshot: scripts/before-submit.png');

// Submit
await page.click('button[type="submit"]');
console.log('Submitted — waiting...');
await sleep(6000);

// Check result
const postPage = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('\nPage after login attempt:\n', postPage);

const passwordGone = (await page.locator('input[name="Password"]').count()) === 0;
console.log('Password field gone:', passwordGone);

await page.screenshot({ path: path.join(ROOT, 'scripts', 'post-login.png'), fullPage: false });
console.log('Screenshot: scripts/post-login.png');

if (!passwordGone) {
  // Check for error text
  const errText = await page.evaluate(() => {
    for (const s of ['[class*="error"]','[role="alert"]','[class*="toast"]','[class*="alert"]:not([class*="update"])']) {
      const el = document.querySelector(s);
      if (el && el.innerText.trim()) return el.innerText.trim().slice(0, 200);
    }
    return '';
  });
  console.log('Error on page:', errText || '(none detected)');
  console.log('\nLogin did not complete. Browser stays open for 90 seconds for manual login.');
  await sleep(90000);
}

// ── Dump post-login navigation ─────────────────────────────────
const navEls = await page.evaluate(() =>
  [...document.querySelectorAll('a[href], button, [role="menuitem"], [class*="nav-item"]')]
    .filter(el => el.offsetParent && el.innerText.trim())
    .map(el => ({ tag: el.tagName, text: el.innerText.trim().slice(0, 80), href: el.getAttribute('href') || '' }))
    .slice(0, 50)
);
console.log('\nPost-login elements:', JSON.stringify(navEls, null, 2));

// ── STEP 4: Scrape ─────────────────────────────────────────────
const workbook = XLSX.utils.book_new();
const allData = {};

for (const target of TARGETS) {
  const sheetName = `${target.locationEn} - ${target.typeEn}`;
  console.log(`\n══════ ${sheetName} ══════`);
  const records = [];
  const locSlug  = target.locationEn === 'New Capital' ? 'new-capital' : 'new-cairo';
  const typeSlug = target.typeEn === 'Residential' ? 'residential' : 'commercial';

  Object.keys(capturedApiData).forEach(k => delete capturedApiData[k]);

  let navigated = false;
  for (const url of [
    `https://masterv.net/properties?location=${locSlug}&type=${typeSlug}`,
    `https://masterv.net/properties/${locSlug}/${typeSlug}`,
    `https://masterv.net/projects?location=${locSlug}&category=${typeSlug}`,
    `https://masterv.net/units?location=${locSlug}&type=${typeSlug}`,
    `https://masterv.net/search?area=${locSlug}&property_type=${typeSlug}`,
    `https://masterv.net/listings/${locSlug}/${typeSlug}`,
    `https://masterv.net/dashboard/properties?location=${locSlug}&type=${typeSlug}`,
  ]) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await sleep(2500);
      const body = await page.evaluate(() => document.body.innerText.slice(0, 200));
      if (!body.match(/404|not found|page not found/i)) {
        console.log('Navigated to:', url);
        navigated = true;
        break;
      }
    } catch {}
  }

  if (!navigated) {
    console.log('URL patterns failed — using home + filters...');
    await page.goto('https://masterv.net', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    for (const sel of await page.$$('select')) {
      try {
        const opts = await sel.evaluate(s => [...s.options].map(o => ({ t: o.text.trim(), v: o.value })));
        const match = opts.find(o =>
          [target.locationEn, target.locationAr, locSlug.replace(/-/g,' ')]
            .some(t => o.t.toLowerCase().includes(t.toLowerCase()))
        );
        if (match) { await sel.selectOption(match.v); await sleep(1000); break; }
      } catch {}
    }
    for (const term of [target.typeEn, target.typeAr])
      await tryClick(page, [`button:has-text("${term}")`,`a:has-text("${term}")`]);
    await tryClick(page, ['button[type="submit"]','button:has-text("Search")','button:has-text("بحث")']);
    await sleep(3000);
    navigated = true;
  }

  let pageNum = 1, hasMore = true;
  while (hasMore) {
    console.log(`  Page ${pageNum} — ${page.url()}`);
    await sleep(1500);

    const domRecords = await extractListings(page, target.locationEn, target.typeEn);
    const apiKeys = Object.keys(capturedApiData);

    if (apiKeys.length > 0) {
      for (const key of apiKeys) {
        const items = capturedApiData[key];
        console.log(`  [API] ${items.length} items`);
        records.push(...items.map(i => ({ location: target.locationEn, type: target.typeEn, ...i })));
      }
    } else if (domRecords.length > 0) {
      console.log(`  [DOM] ${domRecords.length} items`);
      records.push(...domRecords);
    } else {
      const snippet = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ').trim().slice(0, 500));
      console.log('  No items. Snippet:', snippet);
    }

    const prevH = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
    const newH = await page.evaluate(() => document.body.scrollHeight);

    const nextClicked = await tryClick(page, [
      'a[rel="next"]', `a[href*="page=${pageNum+1}"]`,
      'button:has-text("Next")', 'a:has-text("Next")',
      'button:has-text("التالي")', 'a:has-text("التالي")',
      '[class*="next-page"]:not([disabled])', '[aria-label="Next page"]',
    ]);

    if (nextClicked) { await sleep(2500); pageNum++; }
    else if (newH > prevH && pageNum === 1) { pageNum++; }
    else { hasMore = false; }
    if (pageNum > 200) hasMore = false;
  }

  console.log(`Total "${sheetName}": ${records.length} records`);
  allData[sheetName] = records;
  const ws = XLSX.utils.json_to_sheet(
    records.length > 0 ? records
      : [{ note: 'No records', location: target.locationEn, type: target.typeEn }]
  );
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  XLSX.writeFile(workbook, path.join(ROOT, 'masterv-data.xlsx'));
  console.log(`Saved "${sheetName}"`);
}

writeFileSync(path.join(ROOT, 'masterv-data.json'), JSON.stringify(allData, null, 2), 'utf8');
console.log('\nAll done!  masterv-data.xlsx + masterv-data.json');
await browser.close();
