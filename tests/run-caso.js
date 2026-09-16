#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CASOS_PATH = path.join(__dirname, 'casos.json');
const CASOS_LOCAL_PATH = path.join(__dirname, 'casos.local.json');

const SCRIPTS = {
  rnmc: {
    archivo: 'consulta-rnmc.js',
    requiere: ['cedula', 'fechaExpedicion'],
    env: { NUMERO_IDENTIFICACION: 'cedula', FECHA_EXPEDICION: 'fechaExpedicion' }
  },
  comparendos: {
    archivo: 'consulta-comparendos.js',
    requiere: ['cedula'],
    env: { NUMERO_IDENTIFICACION: 'cedula' }
  },
  antecedentes: {
    archivo: 'consulta-antecedentes-claude.js',
    requiere: ['cedula'],
    env: { NUMERO_IDENTIFICACION: 'cedula' },
    envAdicional: ['ANTHROPIC_API_KEY']
  },
  simit: {
    archivo: 'consulta-simit.js',
    requiere: ['cedula'],
    env: { NUMERO_IDENTIFICACION: 'cedula' }
  },
  acreditado: {
    archivo: 'consulta-personal-acreditado.js',
    requiere: ['cedula'],
    env: { NUMERO_IDENTIFICACION: 'cedula' }
  }
};

// tests/casos.local.json es opcional y está en .gitignore: sirve para casos con
// cédulas reales que no deben subirse al repo público. Los casos locales se
// agregan a (o reemplazan por nombre a) los de casos.json.
function cargarCasos() {
  const casos = JSON.parse(fs.readFileSync(CASOS_PATH, 'utf8'));
  if (!fs.existsSync(CASOS_LOCAL_PATH)) return casos;

  const casosLocales = JSON.parse(fs.readFileSync(CASOS_LOCAL_PATH, 'utf8'));
  for (const [tipo, lista] of Object.entries(casosLocales)) {
    const base = casos[tipo] || [];
    for (const casoLocal of lista) {
      const idx = base.findIndex(c => c.nombre === casoLocal.nombre);
      if (idx >= 0) base[idx] = casoLocal;
      else base.push(casoLocal);
    }
    casos[tipo] = base;
  }
  return casos;
}

const [, , tipo, nombreCaso] = process.argv;

function listarYSalir(mensaje) {
  if (mensaje) console.error(mensaje + '\n');
  console.log('Uso: node tests/run-caso.js <tipo> [nombre-caso]');
  console.log('Tipos disponibles:', Object.keys(SCRIPTS).join(', '));
  const casos = cargarCasos();
  for (const t of Object.keys(casos)) {
    console.log(`\n${t}:`);
    casos[t].forEach(c => console.log(`  - ${c.nombre}: ${c.descripcion || ''}`));
  }
  process.exit(mensaje ? 1 : 0);
}

if (!tipo || !SCRIPTS[tipo]) {
  listarYSalir(tipo ? `Tipo desconocido: "${tipo}"` : null);
}

const config = SCRIPTS[tipo];
const todosCasos = cargarCasos()[tipo] || [];
const caso = nombreCaso ? todosCasos.find(c => c.nombre === nombreCaso) : todosCasos[0];

if (!caso) {
  listarYSalir(`No se encontró el caso "${nombreCaso}" para "${tipo}".`);
}

for (const campo of config.requiere) {
  if (!caso[campo]) {
    console.error(`El caso "${caso.nombre}" no define el campo requerido "${campo}" en tests/casos.json.`);
    process.exit(1);
  }
}

for (const faltante of config.envAdicional || []) {
  if (!process.env[faltante]) {
    console.error(`Falta la variable de entorno "${faltante}" (exportala antes de correr esta prueba).`);
    process.exit(1);
  }
}

const env = { ...process.env };
for (const [envVar, campoCaso] of Object.entries(config.env)) {
  env[envVar] = String(caso[campoCaso]);
}

console.log(`Ejecutando caso "${caso.nombre}" (${tipo}) -> ${config.archivo}`);
const resultado = spawnSync('node', [path.join(__dirname, '..', config.archivo)], {
  stdio: 'inherit',
  env
});
process.exit(resultado.status ?? 1);
