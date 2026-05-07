# Most Wanted

Plataforma comunitaria de reportes para rastrear jugadores tóxicos (modders, griefers y tramposos) en **GTA Online**, operada por la crew **Kaith's Rebels**. Funciona como un tablón de "Se Busca" con estética del sistema H.E.X., permitiendo a la comunidad documentar, validar y consultar jugadores problemáticos mediante reportes con evidencia.

## Características principales

- **Reportes con evidencia**: formulario completo con nickname, crew, alias, RID, IP, tipo de infracción, nivel de corrupción e imágenes de prueba subidas a ImgBB.
- **Sistema de votos comunitario**: la comunidad puede validar o rechazar reportes mediante upvotes/downvotes.
- **Perfiles por jugador**: URL directa por username (`/usuario/{nickname}`) con historial completo de reportes.
- **Asistente IA**: chat integrado (Qwen2.5 vía Ollama) para consultar rankings, estadísticas, correlaciones y análisis tácticos sobre los reportes.
- **Integración con Discord**: notificaciones automáticas con embeds enriquecidos al canal del equipo al registrar un reporte.
- **Integración con HEXBOT**: sincronización server-to-server con la API `hex-api.kaithsrebels.com` para persistencia centralizada de reportes.
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
│   ├── reports/          # Lógica de reportes, Discord y HEXBOT
│   ├── ai/               # Configuración e integración con IA
│   └── middleware/       # Rate limiting y validación
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
| `/api/reports` | POST | Envía un nuevo reporte (valida, notifica Discord y sincroniza con HEXBOT) |
| `/api/reports/health` | GET | Verifica estado del backend y conectividad con HEXBOT |
| `/api/ia-chat` | POST | Chat con el asistente IA sobre reportes |
| `/api/ia-intent` | POST | Clasificación de intención del usuario |
| `/api/ia-report-correlation` | POST | Análisis de correlaciones entre reportes |
| `/api/discord-webhook` | POST | Endpoint de webhook para Discord |

## Variables de entorno

### Frontend (prefijo `VITE_`)

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | URL base del backend (ej. `http://localhost:3001`) |
| `VITE_IA_ENDPOINT` | Endpoint del chat IA |
| `VITE_IA_INTENT_ENDPOINT` | Endpoint de clasificación de intención |
| `VITE_IA_REPORT_CORRELATION_ENDPOINT` | Endpoint de correlación de reportes |

### Backend (servidor Node)

| Variable | Descripción |
|---|---|
| `KAITH_AI_USE_LOCAL_OLLAMA` | `true` para usar Ollama local (desarrollo) |
| `KAITH_OLLAMA_ENDPOINT` | Endpoint de Ollama. Por defecto: `http://127.0.0.1:11434/api/generate` |
| `KAITH_OLLAMA_MODEL` | Modelo Ollama a usar (ej. `qwen2.5`) |
| `KAITH_AI_ENDPOINT` | Endpoint de IA en producción |
| `KAITH_AI_USER` | Usuario para autenticación con IA en producción |
| `KAITH_AI_PASSWORD` | Contraseña para autenticación con IA en producción |
| `KAITH_AI_MODEL` | Nombre del modelo (opcional) |
| `HEXBOT_API_SECRET` | Token Bearer para autenticación con HEXBOT |
| `HEXBOT_API_BASE_URL` | URL de HEXBOT. Por defecto: `https://hex-api.kaithsrebels.com` |
| `HEXBOT_API_TIMEOUT_MS` | Timeout en ms para peticiones a HEXBOT. Recomendado: `8000` |
| `DISCORD_WEBHOOK_URL` | URL del webhook de Discord para notificaciones |

## Integración con HEXBOT

Los reportes no se envían a HEXBOT desde el navegador. El flujo es:

1. El formulario sube las imágenes a ImgBB para obtener URLs públicas.
2. El frontend llama a `POST /api/reports` con los datos del reporte y las URLs de evidencia.
3. El backend reenvía el reporte server-to-server a HEXBOT con autenticación Bearer.
4. Si HEXBOT falla o no está configurado, el reporte se acepta igualmente (status 202) y el backend retorna un estado de sincronización para mostrar una advertencia en la UI.

Para verificar la integración localmente:

```bash
# Comprueba si el backend tiene configuración y si HEXBOT responde
GET /api/reports/health

# Valida el mapeo del payload sin depender de red
npm run test:reports
```

## Integración con Discord

Cuando se envía un reporte, el backend publica automáticamente un embed enriquecido en Discord con:

- Nombre del jugador reportado y crew
- Tipo de infracción y nivel de corrupción (barra visual)
- Resumen del motivo y análisis IA
- Datos del reportero y número de evidencias

El envío está limitado a un mínimo de 45 segundos entre reportes por IP para evitar spam (`DISCORD_WEBHOOK_MIN_INTERVAL_MS`).

## Integración con IA

El asistente usa **Qwen2.5** a través de Ollama (local en desarrollo, endpoint configurado en producción). Soporta tres modos:

- **Chat**: responde preguntas sobre reportes, rankings y estadísticas.
- **Clasificación de intención**: determina si la consulta es sobre un reporte específico o una pregunta general.
- **Correlación**: detecta patrones de reincidencia y evalúa nivel de amenaza global entre reportes relacionados.
