const { chromium } = require('playwright');

const documento = process.env.NUMERO_IDENTIFICACION;
if (!documento) throw new Error('Define NUMERO_IDENTIFICACION antes de ejecutar.');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://webfenix.movilidadbogota.gov.co/#/consulta-pagos');

  await page.getByRole('combobox', { name: 'Tipo de identificación' }).click();
  await page.getByRole('option', { name: 'Cédula de ciudadanía' }).click();
  await page.getByRole('textbox', { name: 'Número de identificación' }).fill(documento);

  console.log('Completa manualmente el reCAPTCHA y luego ejecuta este bloque:');
  await page.getByRole('textbox', { name: 'Respuesta' }).fill('13');
  await page.getByRole('button', { name: 'Consultar' }).click();
})();
