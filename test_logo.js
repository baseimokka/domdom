const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const res = await fetch('http://localhost:3000/api/products?limit=20');
  const data = await res.json();
  const p = (data.products || []).find(x => x.stock > 0 && x.active);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });

  await page.goto('http://localhost:3000/pages/checkout.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((pid) => {
    localStorage.setItem('dd_cart', JSON.stringify([
      { id: pid, name: 'Test Product', emoji: '💄', price: 120, quantity: 1, colorName: '', photo: null }
    ]));
  }, String(p._id));
  await page.reload({ waitUntil: 'networkidle' });

  // Scroll to payment section
  await page.evaluate(() => document.querySelector('.payment-options').scrollIntoView());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'test_screenshots', 'logo_cod.png'), fullPage: false });

  // Click InstaPay
  await page.click('[data-method="InstaPay"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'test_screenshots', 'logo_instapay.png'), fullPage: false });

  await browser.close();
  console.log('Screenshots saved.');
})().catch(e => { console.error(e.message); process.exit(1); });
