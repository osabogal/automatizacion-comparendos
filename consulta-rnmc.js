const { chromium } = require('playwright');

const numeroIdentificacion = process.env.NUMERO_IDENTIFICACION;
const fechaExpedicion = process.env.FECHA_EXPEDICION;

if (!numeroIdentificacion || !fechaExpedicion) {
  throw new Error('Define NUMERO_IDENTIFICACION y FECHA_EXPEDICION antes de ejecutar.');
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx', {
      waitUntil: 'domcontentloaded'
    });

    await page.locator('#ctl00_ContentPlaceHolder3_ddlTipoDoc')
      .selectOption({ label: 'CEDULA DE CIUDADANIA' });
    await page.locator('#ctl00_ContentPlaceHolder3_txtExpediente')
      .fill(numeroIdentificacion);
    await page.locator('#txtFechaexp').fill(fechaExpedicion);

    await page.locator('#ctl00_ContentPlaceHolder3_btnConsultar2').click();
    await page.waitForLoadState('domcontentloaded');

    const resultado = await page.locator('body').innerText();
    console.log(resultado);
  } finally {
    await browser.close();
  }
})();
