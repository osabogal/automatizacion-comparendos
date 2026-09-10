const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const numeroIdentificacion = process.env.NUMERO_IDENTIFICACION;
const fechaExpedicion = process.env.FECHA_EXPEDICION;

if (!numeroIdentificacion || !fechaExpedicion) {
  throw new Error('Define NUMERO_IDENTIFICACION y FECHA_EXPEDICION antes de ejecutar.');
}

// --- Config anti-bloqueo ---
// Tiempo mínimo entre ejecuciones consecutivas del script (aunque se lancen procesos
// distintos uno tras otro, ej. en un bucle para varias cédulas).
const MIN_DELAY_BETWEEN_RUNS_MS = 8000;
const LOCK_FILE = path.join(__dirname, '.ultima-consulta-rnmc.lock');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
];
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 }
];

class BloqueoDetectadoError extends Error {}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return delay(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
}

// Si el script se ejecuta varias veces seguidas (ej. un bucle consultando distintas
// cédulas), esto obliga a esperar entre una ejecución y la siguiente para no generar
// ráfagas de tráfico que el sitio pueda interpretar como scraping agresivo.
async function esperarTurno() {
  try {
    const ultima = Number(fs.readFileSync(LOCK_FILE, 'utf8'));
    const transcurrido = Date.now() - ultima;
    if (transcurrido < MIN_DELAY_BETWEEN_RUNS_MS) {
      const espera = MIN_DELAY_BETWEEN_RUNS_MS - transcurrido;
      console.log(`Esperando ${Math.ceil(espera / 1000)}s antes de consultar (evita ráfagas de peticiones)...`);
      await delay(espera);
    }
  } catch {
    // No existe el archivo aún (primera ejecución): no hay que esperar.
  }
  fs.writeFileSync(LOCK_FILE, String(Date.now()));
}

async function consultar(intento = 1) {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({
      userAgent: pick(USER_AGENTS),
      viewport: pick(VIEWPORTS),
      locale: 'es-CO',
      timezoneId: 'America/Bogota'
    });
    const page = await context.newPage();

    await page.goto('https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx', {
      waitUntil: 'domcontentloaded'
    });

    // Pausas aleatorias entre acciones para imitar el ritmo de una persona real
    // en vez de rellenar el formulario instantáneamente.
    await randomDelay(400, 1200);
    await page.locator('#ctl00_ContentPlaceHolder3_ddlTipoDoc')
      .selectOption({ label: 'CEDULA DE CIUDADANIA' });

    await randomDelay(500, 1400);
    await page.locator('#ctl00_ContentPlaceHolder3_txtExpediente')
      .fill(numeroIdentificacion);

    await randomDelay(300, 900);
    await page.locator('#txtFechaexp').fill(fechaExpedicion);

    await randomDelay(500, 1500);
    await page.locator('#ctl00_ContentPlaceHolder3_btnConsultar2').click();
    await page.waitForLoadState('domcontentloaded');
    await randomDelay(500, 1000);

    const resultado = await page.locator('body').innerText();

    if (/captcha/i.test(resultado) || /acceso denegado|bloqueado|too many requests/i.test(resultado)) {
      throw new BloqueoDetectadoError('El sitio respondió con una señal de bloqueo (captcha / acceso denegado).');
    }

    console.log(resultado);
    return resultado;
  } catch (err) {
    if (err instanceof BloqueoDetectadoError) {
      // No reintentar: insistir justo ahora empeora el bloqueo.
      throw err;
    }
    if (intento < 3) {
      const espera = 5000 * intento + Math.random() * 3000;
      console.warn(`Intento ${intento} falló (${err.message}). Reintentando en ${Math.ceil(espera / 1000)}s...`);
      await delay(espera);
      return consultar(intento + 1);
    }
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

(async () => {
  await esperarTurno();
  await consultar();
})();
