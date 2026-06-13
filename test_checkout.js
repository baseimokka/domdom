// test_checkout.js — end-to-end checkout test
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'test_screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

async function getProductId() {
  const res  = await fetch('http://localhost:3000/api/products?limit=20');
  const data = await res.json();
  const p    = (data.products || []).find(x => x.stock > 0 && x.active);
  return p ? String(p._id) : null;
}

(async () => {
  const productId = await getProductId();
  if (!productId) { console.error('No in-stock product found'); process.exit(1); }
  console.log('Using product:', productId);

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();

  // Inject cart with a real product ID
  await page.goto('http://localhost:3000/pages/checkout.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((pid) => {
    localStorage.setItem('dd_cart', JSON.stringify([
      { id: pid, name: 'Test Product', emoji: '💄', price: 120, quantity: 1, colorName: '', photo: null }
    ]));
  }, productId);
  await page.reload({ waitUntil: 'networkidle' });
  await shot(page, '01_checkout_loaded');
  console.log('\n[1] Checkout loaded');

  // 1. Verify initial state: COD selected, proof box hidden
  const codSelected = await page.$eval('[data-method="COD"]', el => el.classList.contains('selected'));
  const proofHidden = await page.$eval('#proof-upload-box', el => getComputedStyle(el).display === 'none');
  console.log('    COD selected:', codSelected, '| proof hidden:', proofHidden);

  // 2. Switch to InstaPay — check details + proof appear
  await page.click('[data-method="InstaPay"]');
  await page.waitForTimeout(500);
  await shot(page, '02_instapay_selected');
  console.log('\n[2] InstaPay selected');

  const iPayTitle   = await page.$eval('#pay-details-title',   el => el.textContent.trim());
  const iPayContent = await page.$eval('#pay-details-content', el => el.innerText.replace(/\n/g, ' | '));
  const iPayBtnTxt  = await page.$eval('#place-order-btn',     el => el.textContent.trim());
  const detailsVis  = await page.$eval('#payment-details-box', el => el.style.display !== 'none');
  const proofVis    = await page.$eval('#proof-upload-box',    el => el.style.display !== 'none');
  console.log('    Title:', iPayTitle);
  console.log('    Account details:', iPayContent.trim());
  console.log('    Proof visible:', proofVis, '| Details visible:', detailsVis);
  console.log('    Button:', iPayBtnTxt);

  // 3. Switch to Vodafone Cash
  await page.click('[data-method="VodafoneCash"]');
  await page.waitForTimeout(500);
  await shot(page, '03_vodafonecash_selected');
  const vcTitle   = await page.$eval('#pay-details-title',   el => el.textContent.trim());
  const vcContent = await page.$eval('#pay-details-content', el => el.innerText.replace(/\n/g, ' | '));
  const vcBtn     = await page.$eval('#place-order-btn',     el => el.textContent.trim());
  console.log('\n[3] Vodafone Cash selected');
  console.log('    Title:', vcTitle);
  console.log('    Account details:', vcContent.trim());
  console.log('    Button:', vcBtn);

  // 4. Try placing InstaPay order without proof → expect error toast
  await page.click('[data-method="InstaPay"]');
  await page.waitForTimeout(300);
  await page.fill('#ship-name',    'Fatima Hassan');
  await page.fill('#ship-phone',   '01098765432');
  await page.fill('#ship-email',   'fatima@test.com');
  await page.selectOption('#ship-city', { index: 1 });
  await page.fill('#ship-address', '45 Tahrir Square, Cairo');
  await page.waitForTimeout(200);
  await page.click('#place-order-btn');
  await page.waitForTimeout(1000);
  await shot(page, '04_no_proof_validation');
  const toastText4 = await page.$$eval('.toast', els => els.map(e => e.textContent.trim()).join(' | '));
  console.log('\n[4] No-proof validation toast:', toastText4 || '(no toast shown)');

  // 5. Switch to COD and place real order
  await page.click('[data-method="COD"]');
  await page.waitForTimeout(300);
  await page.click('#place-order-btn');
  try {
    await page.waitForSelector('#order-success', { state: 'visible', timeout: 8000 });
    // success screen uses CSS class display:none, JS sets inline display:block
    await page.waitForFunction(() => document.getElementById('order-success').style.display === 'block', { timeout: 8000 });
  } catch {}
  await shot(page, '05_cod_order_success');

  const successShown = await page.$eval('#order-success', el => el.style.display === 'block');
  console.log('\n[5] COD order placed — success screen visible:', successShown);

  if (successShown) {
    const orderNum = await page.$eval('#success-order-number', el => el.textContent.trim());
    const subtitle = await page.$eval('#success-subtitle',     el => el.textContent.trim());
    const payInfo  = await page.$eval('#success-payment-info', el => el.innerText.trim());
    console.log('    Order number:', orderNum);
    console.log('    Subtitle:', subtitle);
    console.log('    Payment info:', payInfo);
  } else {
    const errors = await page.$$eval('.toast', els => els.map(e => e.textContent.trim()));
    console.log('    Errors:', errors);
  }

  // 6. Test admin settings API
  console.log('\n[6] Settings API smoke test');
  const settingsRes = await fetch('http://localhost:3000/api/settings');
  const settings    = await settingsRes.json();
  console.log('    GET /api/settings:', JSON.stringify(settings.settings));

  await browser.close();
  console.log('\nAll screenshots saved to:', SHOTS);
  console.log('TESTS COMPLETE');
})().catch(e => { console.error('\nFATAL ERROR:', e.message, e.stack); process.exit(1); });
