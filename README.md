# Most Wanted

Plataforma comunitaria de reportes para rastrear jugadores tóxicos (modders, griefers y ardidos) en **GTA Online**, operada por la crew **Kaith's Rebels**. Funciona como un tablón de "Se Busca" con estética del sistema H.E.X., permitiendo a la comunidad documentar, validar y consultar jugadores problemáticos mediante reportes con evidencia.

## Características principales

- **Reportes con evidencia**: formulario completo con nickname, crew, alias, RID, IP, tipo de infracción, nivel de corrupción e imágenes de prueba subidas a ImgBB.
- **Sistema de votos comunitario**: la comunidad puede validar o rechazar reportes mediante upvotes/downvotes.
- **Perfiles por jugador**: URL directa por username (`/usuario/{nickname}`) con historial completo de reportes.
- **Asistente IA**: chat integrado (gateway de IA de H.E.X.; Ollama local opcional) para consultar rankings, estadísticas, correlaciones y análisis tácticos sobre los reportes.
- **Integración con Discord**: notificaciones automáticas con embeds enriquecidos al canal del equipo al registrar un reporte, con botones de enlace a la web (votar y perfil de Social Club).
- **Persistencia en WordPress**: reportes, jugadores y votos se guardan como custom post types mediante el plugin `wordpress/mostwanted-cpt-rest/`, que expone la API REST `/wp-json/mostwanted/v1/`.
- **Moderación de administradores**: capacidades de administración y gestión del estado de los reportes.

## Estructura del proyecto

```
/
├── src/                  # Código fuente React (App.jsx, main.jsx)
│   └── services/         # Servicios frontend (apiConfig, reportSubmission)
├── components/           # Componentes React reutilizables
│   ├── ReportCard.jsx        # Tarjeta de reporte con votos y estado
│   ├── ReportFormModal.jsx   # Formulario de nuevo reporte
│   ├── ReportDetailModal.jsx # Vista detallada del expediente
│   ├── VoteSystem.jsx        # Sistema de votación comunitaria
│   ├── AIAssistantBubble.jsx # Chat con asistente IA
│   ├── ImageUpload.jsx       # Subida de evidencias a ImgBB
│   ├── PlayerBackgroundPanel.jsx # Panel de investigación de antecedentes
│   └── ...               # Selectores, tooltips, ayuda, etc.
├── server/               # Backend Express (Node.js)
│   ├── index.js          # Entrada principal y rutas
│   ├── modules/          # Rutas HTTP por dominio (reports, auth, ai, webhooks, system)
│   ├── reports/          # Cliente WordPress, validación, payloads y embed de Discord
│   ├── ai/               # Configuración e integración con IA
│   └── middleware/       # Rate limiting y validación
├── wordpress/
│   └── mostwanted-cpt-rest/  # Plugin WordPress (CPT + REST), base de datos del proyecto
├── styles/               # CSS global y variables
├── public/               # Archivos estáticos
└── data/                 # Datos locales de ejemplo
```

## Instalación y uso

Instala dependencias y ejecuta en modo desarrollo:

```bash
npm install
npm run dev
```

El servidor Vite arranca en `http://localhost:5180` por defecto (configurable con `VITE_DEV_PORT`). En desarrollo, Vite actúa como proxy hacia el backend Node en `server/index.js`.

Para producción:

```bash
npm run build
npm run start
```

## API del servidor

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/reports` | POST | Valida y guarda un reporte en WordPress, luego lo notifica a Discord |
| `/api/reports/health` | GET | Estado de la integración con WordPress (y HEXBOT, opcional) |
| `/api/reports/player-insights` | GET | Antecedentes de un jugador (`username`, `rid`) desde WordPress |
| `/api/battleye-status` | GET | Estado de BattlEye |
| `/api/auth/discord` | GET | Inicia el login con Discord (OAuth) |
| `/auth/discord/callback` | GET | Callback de OAuth; redirige al frontend |
| `/api/auth/me` | GET | Usuario de la sesión actual |
| `/api/auth/logout` | POST | Cierra la sesión |
| `/api/ia-chat` | POST | Chat con el asistente IA sobre reportes |
| `/api/ia-intent` | POST | Clasificación de intención del usuario |
| `/api/ia-report-correlation` | POST | Análisis de correlaciones entre reportes |
| `/api/discord-webhook` | POST | Webhook genérico para Discord (también `/api/webhooks/discord`) |

Las rutas `/api/expedientes/*` y `/api/players/investigate` son anteriores a WordPress y el frontend actual no las usa.

## Variables de entorno

### Frontend (prefijo `VITE_`)

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | URL base del backend. Vacía o relativa en producción |
| `VITE_WORDPRESS_API_BASE_URL` | URL base de WordPress (lecturas, insights y votos desde el navegador) |
| `VITE_API_KEY_IMGBB` | API key de ImgBB para subir evidencias |
| `VITE_IA_INTENT_ENDPOINT` | Endpoint de clasificación de intención (opcional; por defecto `/api/ia-intent`) |
| `VITE_IA_REPORT_CORRELATION_ENDPOINT` | Endpoint de correlación de reportes (opcional; por defecto `/api/ia-report-correlation`) |
| `VITE_DISCORD_ID_CHANNEL` | ID del canal de Discord del equipo (opcional) |
| `VITE_DEV_PORT` | Puerto del servidor Vite en desarrollo. Por defecto `5180` |

Solo se documentan las variables privadas o sensibles. Las demás tienen valores por defecto en `server/`.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend. Por defecto `5000` |
| `DISCORD_WEBHOOK_URL` | Webhook donde se publican los reportes |
| `DISCORD_WEBHOOK_MIN_INTERVAL_MS` | Intervalo mínimo entre notificaciones. Por defecto `45000` |
| `CLIENT_ID` / `CLIENT_SECRET` | Credenciales de la aplicación de Discord para OAuth |
| `CALLBACK_URL` | URL de callback de OAuth (`DISCORD_REDIRECT_URI` como alias) |
| `AUTH_FRONTEND_SUCCESS_URL` / `AUTH_FRONTEND_FAILURE_URL` | Destinos del frontend tras el login |
| `AUTH_REQUIRE_LOGIN` | `false` desactiva la exigencia de login para reportar y votar |
| `AUTH_ALLOWED_DISCORD_USER_IDS` | IDs de Discord permitidos (lista separada por comas) |
| `SESSION_SECRET` | Secreto de la cookie de sesión |
| `DEBUG_MODE` | `true` omite el rate limiter de webhooks (solo desarrollo) |
| `WEBHOOK_ALLOWED_ORIGINS` | Orígenes permitidos para CORS del webhook |
| `WORDPRESS_REPORTS_ENABLED` | `true` (por defecto) para enviar reportes a WordPress |
| `WORDPRESS_API_BASE_URL` | Sitio WordPress. Por defecto `https://kaithsrebels.com` |
| `WORDPRESS_API_SECRET` | Secreto del plugin para escrituras desde el backend |
| `WORDPRESS_API_TIMEOUT_MS` | Timeout de WordPress en ms. Por defecto `9000` |
| `KAITH_AI_GATEWAY_TOKEN` | Token `X-API-Token` del gateway de IA de H.E.X. |
| `KAITH_AI_GATEWAY_ENDPOINT` | Endpoint del gateway. Por defecto `https://api.kaithsrebels.com/v1/text` |
| `KAITH_AI_USE_LOCAL_OLLAMA` | `true` activa Ollama local como proveedor. Por defecto `false` |
| `KAITH_OLLAMA_ENDPOINT` / `KAITH_OLLAMA_MODEL` | Endpoint y modelo de Ollama local (solo si está activo) |
| `KAITH_AI_ENDPOINT` / `KAITH_AI_USER` / `KAITH_AI_PASSWORD` | Proveedor de IA de producción |
| `HEXBOT_API_SECRET` | Secreto de HEXBOT (legacy, solo para el healthcheck) |
| `HEXBOT_API_BASE_URL` / `HEXBOT_API_TIMEOUT_MS` | HEXBOT (legacy). Solo se usa en el healthcheck |

## Persistencia en WordPress

Los reportes se guardan en WordPress, no en HEXBOT. El flujo es:

1. El formulario sube las imágenes a ImgBB para obtener URLs públicas.
2. El frontend llama a `POST /api/reports` con los datos del reporte y las URLs de evidencia.
3. El backend valida el reporte y lo envía al plugin de WordPress con `WORDPRESS_API_SECRET`.
4. Con el jugador resultante, el backend publica el embed en Discord.
5. Listados, antecedentes y votos se leen y escriben directamente contra la API REST de WordPress desde el frontend.

Para verificar la integración localmente:

```bash
# Comprueba la configuración y la conexión con WordPress
GET /api/reports/health

# Valida el mapeo del payload sin depender de red
npm run test:reports
```

## Integración con Discord

Cuando se envía un reporte, el backend publica un embed en Discord con la ficha del jugador: apodo, crews, estado, RID (oculto como spoiler), aliases (solo si son distintos del apodo), etiquetas, tipos de infracción, motivo y "Evidencias de Video" (solo si hay evidencias de video). Las imágenes van en una galería de embeds que comparten la misma URL, y las etiquetas se muestran en texto pequeño (`-# `).

El mensaje incluye dos botones de enlace:

- **Votar en la web**: abre `https://mostwanted.kaithsrebels.com/reporte/<id>`. Si el login es necesario, la web vuelve a esa ruta después de iniciar sesión.
- **Perfil de Social Club**: abre el perfil del jugador en Rockstar Social Club.
- **Reportar a un jugador**: abre `https://mostwanted.kaithsrebels.com/#reportar`, que lleva directo al formulario de reporte de la web.

Los botones de enlace no requieren bot. Votar desde Discord no está disponible; el voto se hace en la web.

El envío de notificaciones está limitado por `DISCORD_WEBHOOK_MIN_INTERVAL_MS` (por defecto 45 segundos).

## Integración con IA

El asistente usa el gateway de IA de H.E.X. (`KAITH_AI_GATEWAY_TOKEN`, por defecto `https://api.kaithsrebels.com/v1/text`). Ollama local con `qwen2.5` solo se usa si `KAITH_AI_USE_LOCAL_OLLAMA=true`. El orden de proveedores es: hex-gateway, luego ollama-local (si está activo) y por último production-api.

Límite de uso: cada usuario puede hacer 10 consultas por día (día calendario de Buenos Aires). Las consultas de chat y correlación consumen cuota; la clasificación de intención requiere sesión pero no consume cuota. El contador vive en memoria, así que se reinicia al reiniciar el servidor. Al agotarse, la API responde 429 con el mensaje correspondiente.

Soporta tres modos:

- **Chat**: responde preguntas sobre reportes, rankings y estadísticas.
- **Clasificación de intención**: determina si la consulta es sobre un reporte específico o una pregunta general.
- **Correlación**: detecta patrones de reincidencia y evalúa nivel de amenaza global entre reportes relacionados.
