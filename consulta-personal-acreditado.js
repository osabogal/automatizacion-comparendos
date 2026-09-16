const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const identificacion = process.env.NUMERO_IDENTIFICACION;

if (!identificacion) {
  console.error('Error: define la variable de entorno NUMERO_IDENTIFICACION antes de ejecutar el script.');
  process.exit(1);
}

const URL = 'https://apo.supervigilancia.gov.co/acreditapo/BuscaPersona.aspx';
const HEADLESS = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : false;
const RESULTADO_TIMEOUT_MS = 30000;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    // El sitio de Supervigilancia sirve un certificado TLS inválido; ignoreHTTPSErrors va en
    // newPage/newContext, no en launch() (ahí Playwright simplemente lo ignoraría).
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.locator('#ctl00_contentMaster_TxIdn').fill(identificacion);
    await page.locator('#ctl00_contentMaster_BtBuscar').click();

    const tabla = page.locator('.tablaDatos');
    try {
      await tabla.waitFor({ state: 'visible', timeout: RESULTADO_TIMEOUT_MS });
    } catch {
      throw new Error(
        `No apareció la tabla de resultados en ${RESULTADO_TIMEOUT_MS / 1000}s. ` +
        'La persona puede no estar acreditada, o la página cambió/no cargó.'
      );
    }

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(SCREENSHOTS_DIR, `acreditapo-${identificacion}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`Captura guardada en ${screenshotPath}`);
    console.log((await tabla.innerText()).trim());
  } finally {
    await browser.close().catch(() => {});
  }
})();
