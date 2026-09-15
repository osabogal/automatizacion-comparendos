# Pruebas por terminal

Estructura para correr los 3 scripts del repo con casos de prueba definidos en `tests/casos.json`, sin tener que exportar variables de entorno a mano cada vez.

## Cómo correr una prueba

```bash
npm run test:rnmc            # corre el primer caso de "rnmc" en casos.json
npm run test:rnmc -- caso1   # corre un caso específico por nombre
npm run test:comparendos -- caso1
npm run test:antecedentes -- caso1   # requiere ANTHROPIC_API_KEY exportada
```

Para ver todos los tipos y casos disponibles, corré sin argumentos:

```bash
npm test
```

## Agregar un caso nuevo

Editá `tests/casos.json` y agregá un objeto dentro del arreglo correspondiente (`rnmc`, `comparendos` o `antecedentes`) con un `nombre` único y los campos que pida ese tipo (`cedula`, `fechaExpedicion`, etc).

## Importante — cumplimiento

Los casos de ejemplo en `casos.json` traen una cédula ficticia (`1000000000`). Reemplazala solo por cédulas que estés autorizado a consultar (ver el punto de cumplimiento pendiente en Jira A1S-14 / A1S-31 sobre Habeas Data). No uses esta estructura para correr pruebas masivas contra los portales del gobierno.
