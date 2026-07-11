import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/CompuShop/nodejs/node_modules/playwright');

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const TARGET_URL = 'https://www.skool.com/ai-automation-society/classroom/2f7c4aea?md=841dd5fdae024357adc890acf42a66df';

if (!EMAIL || !PASSWORD) {
  console.error('Usage: node scripts/skool-fetch.mjs <email> <password>');
  process.exit(1);
}

const browser = await chromium.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--start-minimized'],
});
const page = await browser.newPage();

page.setDefaultTimeout(60000);

console.log('Navigating to login...');
await page.goto('https://www.skool.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);

await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');

await page.waitForTimeout(5000);
console.log('Logged in, navigating to lesson...');

await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const content = await page.evaluate(() => {
  document.querySelectorAll('nav, script, style, header, footer').forEach(el => el.remove());

  const getText = (el) => el ? el.innerText.trim() : '';

  const title = getText(document.querySelector('h1, h2, [class*="title"]'));
  const body = getText(document.body);

  const links = [...document.querySelectorAll('a[href]')]
    .map(a => `${a.innerText.trim()} -> ${a.href}`)
    .filter(l => l.length > 5)
    .join('\n');

  const videos = [...document.querySelectorAll('iframe')]
    .map(f => f.src)
    .join('\n');

  return { title, body, links, videos };
});

console.log('\n========== LESSON CONTENT ==========');
console.log('TITLE:', content.title);
console.log('\nBODY:\n', content.body);
if (content.videos) {
  console.log('\nVIDEOS:\n', content.videos);
}
if (content.links) {
  console.log('\nLINKS:\n', content.links);
}

await browser.close();
