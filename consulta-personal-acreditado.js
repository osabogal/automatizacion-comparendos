const { chromium } = require('playwright');

const identificacion = process.env.NUMERO_IDENTIFICACION || 'REDACTED-ID';
const url = 'https://apo.supervigilancia.gov.co/acreditapo/BuscaPersona.aspx';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreHTTPSErrors: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#ctl00_contentMaster_TxIdn').fill(identificacion);
    await page.locator('#ctl00_contentMaster_BtBuscar').click();

    const tabla = page.locator('.tablaDatos');
    await tabla.waitFor({ state: 'visible' });
    await page.screenshot({
      path: 'resultado-supervigilancia.png',
      fullPage: true
    });

    console.log('Captura guardada en resultado-supervigilancia.png');
    console.log((await tabla.innerText()).trim());
  } finally {
    await browser.close();
  }
})();
