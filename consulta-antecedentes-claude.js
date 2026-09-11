const { chromium } = require("playwright");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const NUMERO_IDENTIFICACION = process.env.NUMERO_IDENTIFICACION;

if (!ANTHROPIC_API_KEY || !NUMERO_IDENTIFICACION) {
  throw new Error(
    "Define ANTHROPIC_API_KEY y NUMERO_IDENTIFICACION como variables de entorno."
  );
}

async function responderConClaude(pregunta) {
  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 20,
      temperature: 0,
      system: "Responde únicamente con la respuesta final, sin explicación.",
      messages: [
        {
          role: "user",
          content: `Resuelve esta pregunta del formulario y devuelve solo la respuesta:\n${pregunta}`
        }
      ]
    })
  });

  if (!respuesta.ok) {
    throw new Error(`Error de Claude: ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return datos.content[0].text.trim();
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(
    "https://www.procuraduria.gov.co/Pages/Consulta-de-Antecedentes.aspx"
  );

  const formulario = page.frameLocator("iframe");

  await formulario
    .getByLabel("Tipo de Identificación:")
    .selectOption({ label: "Cédula de ciudadanía" });

  await formulario
    .getByLabel("Número Identificación:")
    .fill(NUMERO_IDENTIFICACION);

  const pregunta = await formulario
    .locator("div")
    .filter({ hasText: /¿/ })
    .first()
    .innerText();

  const respuesta = await responderConClaude(pregunta);

  await formulario
    .getByRole("textbox")
    .nth(1)
    .fill(respuesta);

  console.log(`Pregunta: ${pregunta}`);
  console.log(`Respuesta: ${respuesta}`);
})();
