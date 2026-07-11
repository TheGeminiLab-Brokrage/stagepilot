import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/CompuShop/nodejs/node_modules/playwright');
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const TARGET_URL = 'https://www.skool.com/ai-automation-society/classroom/2f7c4aea?md=841dd5fdae024357adc890acf42a66df';

const browser = await chromium.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--start-minimized'],
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);

console.log('Logging in...');
await page.goto('https://www.skool.com/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);

console.log('Navigating to lesson...');
await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// Get all anchor tags with their actual href
const resources = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href]')].map(a => ({
    text: a.innerText.trim(),
    href: a.href,
  }));
});

console.log('\n=== ALL LINKS ===');
resources.forEach(r => console.log(`${r.text} -> ${r.href}`));

// Try to find downloadable resource links
const downloadLinks = resources.filter(r =>
  r.href.includes('download') ||
  r.href.includes('storage') ||
  r.href.includes('cdn') ||
  r.href.includes('file') ||
  r.href.includes('asset') ||
  r.href.includes('.md') ||
  r.href.includes('.py') ||
  r.href.includes('.txt')
);

console.log('\n=== POTENTIAL RESOURCE LINKS ===');
downloadLinks.forEach(r => console.log(`${r.text} -> ${r.href}`));

await browser.close();
