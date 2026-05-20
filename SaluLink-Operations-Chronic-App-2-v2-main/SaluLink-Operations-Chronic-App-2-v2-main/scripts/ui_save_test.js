const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: 'console', text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  // Capture network requests to supabase
  const supaRequests = [];
  page.on('requestfinished', async (req) => {
    try {
      const url = req.url();
      if (url.includes('supabase.co') || url.includes('/rest/v1/')) {
        const res = await req.response();
        const status = res.status();
        const body = await res.text().catch(() => '');
        supaRequests.push({ url, status, body });
      }
    } catch (e) {
      // ignore
    }
  });

  console.log('Opening app...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

  // Click New Case
  await page.click('text=New Case');

  // Fill patient info
  await page.fill('#patientName', 'Automation Test');
  await page.fill('#patientId', 'auto-001');
  await page.fill('#medicalAidNumber', 'MA-0001');
  await page.fill('#patientEmail', 'auto@example.com');
  await page.fill('#patientPhone', '+27123456789');
  // Select plan button labeled 'Core' (default already Core)
  // Click Save & Continue
  await page.click('text=Save & Continue');

  // Wait for clinical note textarea
  await page.waitForSelector('textarea.textarea-field', { timeout: 10000 });
  await page.fill('textarea.textarea-field', 'Patient has chronic cough and shortness of breath. Likely asthma.');

  // Click Analyze Note
  await page.click('text=Analyze Note');

  // Wait for matched conditions list - buttons inside ConditionSelection
  await page.waitForSelector('button:has(h3)', { timeout: 10000 });
  // Click first condition button
  const conditionButtons = await page.$$('button:has(h3)');
  if (conditionButtons.length === 0) {
    console.log('No condition buttons found');
    await browser.close();
    process.exit(1);
  }
  await conditionButtons[0].click();

  // Wait for ICD code selection
  await page.waitForSelector('button:has(span.font-mono)', { timeout: 10000 });
  const icdButtons = await page.$$('button:has(span.font-mono)');
  if (icdButtons.length > 0) {
    await icdButtons[0].click();
  }

  // Click Next repeatedly until Final Claim step appears (look for Confirm and Finalize Claim button)
  for (let i = 0; i < 6; i++) {
    const confirmVisible = await page.$('text=Confirm and Finalize Claim');
    if (confirmVisible) break;
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      await nextBtn.click();
    } else {
      // try generic continue
      const continueBtn = await page.$('button:has-text("Continue to Registration Note")') || await page.$('button:has-text("Continue to Final Claim")');
      if (continueBtn) await continueBtn.click();
    }
    await page.waitForTimeout(700);
  }

  // Ensure Final Claim present
  await page.waitForSelector('text=Confirm and Finalize Claim', { timeout: 10000 });
  await page.click('text=Confirm and Finalize Claim');

  // Wait for save modal
  await page.waitForSelector('text=Finalize Patient Case', { timeout: 5000 });

  // Fill modal inputs (if empty)
  const nameVal = await page.inputValue('div[role="dialog"] input[type="text"]');
  await page.fill('div[role="dialog"] input[type="text"]', 'Automation Test');
  await page.fill('div[role="dialog"] input[type="text"] + input', 'auto-001').catch(() => {});

  // Handle dialog alert
  page.on('dialog', async dialog => {
    console.log('Dialog message:', dialog.message());
    await dialog.accept();
  });

  // Click Save Patient Case
  await page.click('text=Save Patient Case');

  // Wait for result alert and network activity
  await page.waitForTimeout(2000);

  console.log('Supabase requests made:', supaRequests.length);
  console.log(supaRequests.slice(-5));
  console.log('Console logs:', logs.slice(-20));

  await browser.close();
  process.exit(0);
})();
