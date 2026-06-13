const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ── TEST 1: Customer orders page
  // Log in first via localStorage injection
  await page.goto('http://localhost:3000/frontend/pages/orders.html');
  await page.evaluate(() => {
    localStorage.setItem('dd_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMDRmMzA3MzhlZjM4ZjFiMTU4MWQxNCIsIm5hbWUiOiJBZG1pbiIsImVtYWlsIjoiYWRtaW5AZG9tZG9tLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4MTAxMDM4OCwiZXhwIjoxNzgxNjE1MTg4fQ.4qg1x25mIwXZUaLX92RjEIqRkGOfSx3W-tYBk0sPFMs');
  });
  await page.reload();
  await page.waitForTimeout(2000);

  const emojis = await page.$$eval('.order-item-thumb', els =>
    els.map(el => ({
      hasImg: !!el.querySelector('img'),
      hasSpan: !!el.querySelector('span'),
      text: el.innerText.trim()
    }))
  );
  console.log('CUSTOMER thumbs:', JSON.stringify(emojis));

  // ── TEST 2: Admin orders modal
  await page.goto('http://localhost:3000/frontend/pages/admin.html');
  await page.evaluate(() => {
    localStorage.setItem('dd_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMDRmMzA3MzhlZjM4ZjFiMTU4MWQxNCIsIm5hbWUiOiJBZG1pbiIsImVtYWlsIjoiYWRtaW5AZG9tZG9tLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4MTAxMDM4OCwiZXhwIjoxNzgxNjE1MTg4fQ.4qg1x25mIwXZUaLX92RjEIqRkGOfSx3W-tYBk0sPFMs');
  });
  await page.reload();
  await page.waitForTimeout(2000);

  // Click Orders tab
  await page.click('[data-tab="orders"]');
  await page.waitForTimeout(1500);

  // Click first View button
  const viewBtn = await page.$('.btn-view');
  if (viewBtn) {
    await viewBtn.click();
    await page.waitForTimeout(1000);

    const modalVisible = await page.$('#order-modal:not(.hidden)');
    const modalHtml = modalVisible ? await page.$eval('#order-detail-body', el => el.innerHTML.substring(0, 400)) : 'MODAL NOT OPEN';
    console.log('ADMIN MODAL HTML:', modalHtml);

    // Check thumbnails in modal
    const modalThumbs = await page.$$eval('#order-detail-body div[style*="border-radius:6px"]', els =>
      els.map(el => ({ hasImg: !!el.querySelector('img'), hasSpan: !!el.querySelector('span'), text: el.innerText.trim() }))
    );
    console.log('ADMIN MODAL thumbs:', JSON.stringify(modalThumbs));
  } else {
    console.log('No View button found');
  }

  await browser.close();
})();
