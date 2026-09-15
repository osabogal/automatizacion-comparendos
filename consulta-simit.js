const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const identificacion = process.env.NUMERO_IDENTIFICACION;

if (!identificacion) {
  throw new Error('Define NUMERO_IDENTIFICACION antes de ejecutar.');
}

// --- Config anti-bloqueo (mismo criterio que consulta-rnmc.js) ---
const MIN_DELAY_BETWEEN_RUNS_MS = 8000;
const LOCK_FILE = path.join(__dirname, '.ultima-consulta-simit.lock');
const MUTEX_FILE = `${LOCK_FILE}.mutex`;
const MUTEX_MAX_WAIT_MS = 15000;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const HEADLESS = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : false;

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

// Lock exclusivo entre procesos (creación atómica con 'wx') para que leer y
// actualizar LOCK_FILE sea una sección crítica real: si dos procesos se lanzan
// casi al mismo tiempo (ej. un bucle externo consultando varias cédulas), no
// pueden leer el mismo timestamp y arrancar juntos.
async function conMutex(fn) {
  const inicio = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(MUTEX_FILE, String(process.pid), { flag: 'wx' });
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - inicio > MUTEX_MAX_WAIT_MS) {
        // Mutex probablemente huérfano (proceso anterior murió sin liberarlo).
        try { fs.unlinkSync(MUTEX_FILE); } catch {}
        continue;
      }
      await delay(100);
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(MUTEX_FILE); } catch {}
  }
}

// Igual que en consulta-rnmc.js: si el script se corre varias veces seguidas
// (ej. varias cédulas en fila), obliga a esperar entre una ejecución y la
// siguiente para no generar ráfagas de tráfico.
async function esperarTurno() {
  await conMutex(async () => {
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
  });
}

function verificarBloqueo(texto) {
  if (/captcha/i.test(texto) || /acceso denegado|bloqueado|too many requests/i.test(texto)) {
    throw new BloqueoDetectadoError('El sitio respondió con una señal de bloqueo (captcha / acceso denegado).');
  }
}

async function consultar(intento = 1) {
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({
      userAgent: pick(USER_AGENTS),
      viewport: pick(VIEWPORTS),
      locale: 'es-CO',
      timezoneId: 'America/Bogota'
    });
    const page = await context.newPage();

    await page.goto('https://www.fcm.org.co/simit/#/estado-cuenta', {
      waitUntil: 'domcontentloaded'
    });
    // Tiempo de carga extra antes de interactuar, para imitar a una persona
    // real leyendo la página en vez de un bot llenando el form al instante.
    await randomDelay(1500, 3000);
    verificarBloqueo(await page.locator('body').innerText());

    const campo = page.getByRole('textbox', {
      name: 'Número de identificación o placa del vehículo'
    });
    await randomDelay(600, 1500);
    await campo.fill(identificacion);

    await randomDelay(600, 1500);
    await page.getByRole('button', { name: 'Realizar consulta' }).click();

    await page.getByText('Resumen').waitFor({ timeout: 30000 });
    // Espera a que termine de cargar el resultado completo antes de leerlo/capturarlo.
    await randomDelay(1200, 2200);

    verificarBloqueo(await page.locator('body').innerText());

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(SCREENSHOTS_DIR, `simit-${identificacion}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Captura guardada en ${screenshotPath}`);

    const resultado = {
      identificacion,
      comparendos: await page.locator('text=Comparendos:').locator('..').innerText(),
      multas: await page.locator('text=Multas:').locator('..').innerText(),
      acuerdosPago: await page.locator('text=Acuerdos de pago:').locator('..').innerText(),
      total: await page.locator('text=Total:').locator('..').innerText(),
      mensaje: await page.getByRole('heading', { level: 3 }).last().innerText()
    };

    console.log(JSON.stringify(resultado, null, 2));
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
