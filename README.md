# Altum Leads Dashboard

Dashboard web para visualizar leads guardados en Google Sheets sin trabajar directo sobre la hoja.

## Qué hace

- Lee filas desde Google Sheets publicado como CSV
- Expone un endpoint local \`/api/leads\`
- Permite buscar, filtrar y ordenar leads
- Muestra detalle completo del lead, problema detectado, score, mensaje sugerido y notas
- Funciona como opción 2: frontend + backend propio, listo para deploy

## Stack

- Frontend: Vite
- Backend: Express
- Fuente de datos: Google Sheets CSV público

## Configuración

Creá un \`.env\` en la raíz del proyecto con una de estas variables:

\`\`\`bash
LEADS_SOURCE_URL=https://docs.google.com/spreadsheets/d/.../edit#gid=0
\`\`\`

o bien:

\`\`\`bash
GOOGLE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0
\`\`\`

El backend acepta tanto la URL normal de edición/compartido como la URL directa CSV. Si recibe una URL estándar de Google Sheets, la convierte automáticamente a export CSV.
Si la URL responde HTML en vez de CSV, la API devuelve un error claro para que no se rompa el frontend.

## Cómo publicar la hoja

Para que la web pueda leerla sin credenciales:

1. Abrí la hoja en Google Sheets.
2. \`Archivo\` → \`Compartir\` → \`Publicar en la web\`.
3. Publicá la pestaña correcta como \`CSV\`.
4. Copiá la URL publicada o la URL normal de la hoja.
5. Pegala en \`LEADS_SOURCE_URL\` o \`GOOGLE_SHEETS_CSV_URL\`.

## Scripts

\`\`\`bash
npm install
npm run dev
npm run build
npm run start
\`\`\`

## Desarrollo

- \`npm run dev\` levanta Vite y el server Express en paralelo
- \`npm run start\` sirve la API y también el \`dist/\` si ya hiciste build

## Endpoints

### Health

\`\`\`http
GET /api/health
\`\`\`

Devuelve si la fuente está configurada.

### Leads

\`\`\`http
GET /api/leads
\`\`\`

Filtros soportados:

- \`q\`
- \`estado\`
- \`rubro\`
- \`zona\`
- \`servicio\`
- \`minScore\`
- \`sort\`

## Notas

- El webhook actual de Altum sólo responde healthcheck por GET; no devuelve filas.
- En Vercel, la web usa funciones serverless en `/api/health` y `/api/leads`.
- Si querés lectura privada sin publicar la hoja, el siguiente paso sería sumar Google Sheets API con credenciales de servicio.
