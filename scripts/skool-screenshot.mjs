import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/CompuShop/nodejs/node_modules/playwright');

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const TARGET_URL = 'https://www.skool.com/ai-automation-society/classroom/2f7c4aea?md=841dd5fdae024357adc890acf42a66df';

const browser = await chromium.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto('https://www.skool.com/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);

await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

await page.screenshot({ path: 'scripts/skool-lesson.png', fullPage: true });
console.log('Screenshot saved to scripts/skool-lesson.png');

// Dump inner HTML of main content area
const html = await page.evaluate(() => {
  // Find the main content div
  const main = document.querySelector('main, [class*="content"], [class*="lesson"], [class*="post"]');
  return main ? main.innerHTML : document.body.innerHTML.substring(0, 5000);
});

console.log('\n=== PAGE HTML SNIPPET ===\n', html.substring(0, 3000));

await browser.close();
