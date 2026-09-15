const { chromium } = require('playwright');

const identificacion = process.env.NUMERO_IDENTIFICACION;

if (!identificacion) {
  throw new Error('Define NUMERO_IDENTIFICACION antes de ejecutar.');
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.fcm.org.co/simit/#/estado-cuenta', {
      waitUntil: 'domcontentloaded'
    });

    const campo = page.getByRole('textbox', {
      name: 'Número de identificación o placa del vehículo'
    });
    await campo.fill(identificacion);
    await page.getByRole('button', { name: 'Realizar consulta' }).click();

    await page.getByText('Resumen').waitFor();

    const resultado = {
      identificacion,
      comparendos: await page.locator('text=Comparendos:').locator('..').innerText(),
      multas: await page.locator('text=Multas:').locator('..').innerText(),
      acuerdosPago: await page.locator('text=Acuerdos de pago:').locator('..').innerText(),
      total: await page.locator('text=Total:').locator('..').innerText(),
      mensaje: await page.getByRole('heading', { level: 3 }).last().innerText()
    };

    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    await browser.close();
  }
})();
