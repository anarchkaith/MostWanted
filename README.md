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

## Estilos y recursos visuales

La paleta de marca es rojo, negro y blanco, con grises neutros para superficies y texto secundario, sin tonos crema o beige. Los tokens históricos `--color-cream` y `--color-cream-dark` se conservan por compatibilidad, pero sus valores son blanco y gris neutro. Los colores semánticos de severidad, advertencias y validación mantienen su significado.

El sitio reutiliza botones, tiles, encabezados, campos, tablas, listas y franjas SVG de [cyberpunk-css](https://github.com/alddesign/cyberpunk-css), bajo licencia MIT.

- La copia original sin modificar está en [styles/vendor/cyberpunk/cyberpunk.css](styles/vendor/cyberpunk/cyberpunk.css), junto con su [licencia](styles/vendor/cyberpunk/LICENSE) y sus [fuentes locales](styles/vendor/cyberpunk/fonts/). Procede de la revisión `c6a77b49062c9c876a85c0137cb69c2acc9fd1d8` de la biblioteca.
- [styles/Cyberpunk.css](styles/Cyberpunk.css) importa la biblioteca en una capa de menor prioridad y conecta sus colores con la paleta de [styles/variables.css](styles/variables.css). Las clases `mw-cyber-*` ajustan tamaños, foco, movimiento reducido y comportamiento responsive.
- La biblioteca se carga completa; la capa de menor prioridad permite conservar la base del documento y la paleta del sitio. Sus fuentes BlenderProBook, Oxanium y Cyberpunk se sirven localmente. La marca recupera Black Ops One mediante el enlace de Google Fonts ya existente.
- Se conservan las familias originales de [styles/variables.css](styles/variables.css): Closeness (encabezados), Blender pro (lectura) e IBM 3270 (datos). Sus archivos originales no están en el repositorio y no se redistribuyen sin una licencia comprobada. Mientras falten, sus fallbacks explícitos son Impact/sans-serif, BlenderProBook y Share Tech Mono/Courier New, respectivamente; no se presenta una fuente distinta como si fuera el archivo original.
- El foco de los campos Cyberpunk resalta su linea angular; no agrega un marco rectangular ni las sombras y animaciones de los campos anteriores.
- Los inputs y fechas usan el contenedor original `cyber-input-full`; todos los selectores (filtros, gestión y edición) usan `cyber-select-full` con su flecha y línea originales. Las áreas de texto extienden la geometría del input, ya que la biblioteca no trae un componente textarea.
- Las acciones usan `cyber-button` / `cyber-button-small` para sus proporciones y tamaños; el tema Glitch sustituye el recorte y desplazamiento originales por una esquina inferior derecha recortada y un borde de 1 px sin mover el botón real. Los controles de icono, enlaces de texto y opciones seleccionables conservan su función específica.
- El tema de [styles/GlitchTheme.css](styles/GlitchTheme.css), cargado después de la base Cyberpunk, adapta la referencia aportada en `styles/Glitch/`: marcos angulares de esquina recortada, superficies oscuras translúcidas, bordes rojo/blanco y botones delineados que se rellenan al interactuar. Se aplica al acceso, fichas, tabla de reportes, paneles del formulario, confirmaciones, diálogos y asistente. Los recortes se aplican a fondos decorativos, no a contenedores interactivos, para no cortar foco, menús ni tooltips.
- El glitch de botón requiere un hijo `.glitchtext`; `CyberButtonLabel` conserva el texto principal y añade una copia con `aria-hidden`, separando sus letras para invertir algunas como en la referencia. `hex-interface-glitch` usa bandas poligonales, desplazamiento horizontal de hasta un 5% y sombras rojo/blanco; los botones alternan dirección y ciclos de 3.1, 3.7 o 4.3 s, y el título usa 5.9 s. Solo se anima la copia decorativa al pasar el mouse o recibir foco de teclado; el área de interacción y el texto principal permanecen estables, y los botones deshabilitados no muestran el efecto. Las variaciones son deterministas, no aleatoriedad real.
- Los diálogos y el acceso usan una entrada escalonada de marco, encabezado, contenido y acciones, sin retrasar el foco ni las acciones. El asistente conserva su posición flotante y su modo de pantalla completa. Se respetan los scrolls de contenido y `prefers-reduced-motion`. No se ejecuta el Babel de la demo ni se importan sus selectores globales, panel Tweakpane, fuentes remotas, popovers o atajos de teclado; se mantienen los componentes y flujos React existentes.
- [InterfaceSounds](components/InterfaceSounds.jsx) centraliza por delegación los sonidos de apertura de diálogos, activación de acciones, cierre/cancelación y hover. Las opciones de selectores, resultados del buscador y categorías/etiquetas usan `370962_5450487-lq.mp3`; los botones usan `703884_6142149-lq.mp3`. Entrar en un hijo del mismo control no repite el sonido, y los controles deshabilitados, el hover táctil y las zonas `data-ui-sound="off"` no suenan. La aceptación indica una interacción, no confirma el resultado del servidor. Se reproducen al 25% de volumen, sin superponerse ni reproducirse antes de la primera interacción permitida por el navegador. No hay música, botón de sonido ni preferencia propia de silencio; el audio se controla desde el navegador. Los MP3 se solicitan al CDN de Freesound solo cuando se necesitan; no se redistribuyen en el repositorio. Los fallos se registran y muestran un aviso de estado sin bloquear acciones; se reintentan con la siguiente acción. No se incorporan dependencias de audio. Para acciones de cancelación usar `data-ui-sound="reject"`; para excluir controles, `data-ui-sound="off"`.
- [CyberSelect](components/CyberSelect.jsx) es el desplegable compartido de filtros, gestión de casos y edición de reportes. Expone combobox/listbox, selección por mouse/táctil, flechas, Inicio/Fin, búsqueda por letras, Enter/Espacio, Escape y Tab. Sus opciones se muestran en un portal sin recortes y permiten detectar hover de manera uniforme, a diferencia de los menús nativos del sistema.
- Los efectos independientes originales siguen disponibles en la biblioteca; la copia decorativa de la marca usa el glitch discreto del tema y el indicador decorativo de la barra de consulta conserva `cyber-glitch-4`. El logo se mantiene estático, sin la pulsación lenta de brillo/desenfoque. No se aplican glitches a campos, fotografías de identidad, evidencias ni texto de los reportes; el indicador no representa conectividad en tiempo real.
- `prefers-reduced-motion: reduce` desactiva todas las animaciones y oculta las copias glitch, manteniendo los textos originales. Los efectos de la marca usan rojo y blanco en lugar de los acentos amarillo/cian originales.
- Los paneles de formulario usan fondos decorativos independientes para no recortar campos ni ayudas emergentes. Las tablas del asistente tienen desplazamiento horizontal propio.
- La distribución se define en `styles/Cyberpunk.css` y el acabado visual en `styles/GlitchTheme.css`: cabecera compacta, texto de trabajo de 18 px, paneles numerados y acciones de trabajo y selectores con objetivos tactiles de al menos 44 px; las acciones compactas de cabecera tienen 40 px de alto. El CSS anterior y los bloques de estilos heredados del formulario, antecedentes y evidencias quedan en la capa `legacy`, por debajo de la biblioteca y del tema, para evitar que sus efectos de foco y animaciones compitan con el nuevo diseno.
- Los errores de envio reciben el foco y se anuncian como alertas. La confirmacion permite navegar con Tab dentro del dialogo, cerrarlo con Escape y volver al control anterior.
- Por debajo de 640 px, la investigacion se apila, las acciones principales ocupan el ancho disponible y el chat utiliza la pantalla completa con altura dinamica. Las categorias pasan a dos columnas por debajo de 900 px; motivo y evidencias se apilan en ese mismo punto.
- Antes de iniciar sesión, la pantalla ocupa al menos el alto dinámico de la ventana (`100dvh`, con fallback `100vh`). El panel de acceso y su única acción, «Iniciar sesión con Discord», se centran en el espacio disponible entre cabecera y pie; en pantallas bajas el documento puede crecer y desplazarse sin recortar el contenido. La distribución del despacho autenticado no cambia.

## Despacho de investigación

- El flujo principal es buscar por nombre/RID, abrir la ficha y usar «Registrar reporte» dentro de esa ficha. La cabecera no ofrece registro directo ni control de sonido; la mesa de denuncias aparece en la navegación solo mientras se está usando. La investigación se transfiere al formulario para no exigir otra consulta; si aún estaba en curso se completa allí. La ausencia de resultados o el fallo de las fuentes no impide aportar datos. Nombre, RID cuando no se resolvió, alias, crews y URLs de avatares pueden completarse en el reporte.
- Los antecedentes se muestran únicamente en [PlayerBackgroundPanel](components/PlayerBackgroundPanel.jsx), dentro del archivo, no de nuevo en el formulario. [ReportPlayerIdentity](components/ReportPlayerIdentity.jsx) permite confirmar el destinatario y volver a su ficha; el resto del formulario recoge aportes nuevos. Ambos reutilizan [usePlayerInvestigation](components/usePlayerInvestigation.js) para consultas y estados. [playerProfile](src/services/playerProfile.js) centraliza el historial y [reportPlayerDraft](src/services/reportPlayerDraft.js) traslada los datos al formulario. Completar una consulta pendiente no sobrescribe los aportes manuales ni aplica una respuesta de otro nombre.
- La ficha reúne el perfil externo actual y el historial de WordPress/reportes, identificando fuentes y fechas. Los avatares por RID se consultan en Rockstar y no se sustituyen por fotografías antiguas del archivo. Los nombres y crews reportados no se presentan como verificados ni necesariamente vigentes. Se conservan las URLs anteriores de avatares, no copias de las imágenes: una URL mutable puede mostrar un contenido nuevo y no permite reconstruir una foto histórica perdida.
- Un envío confirmado invalida la búsqueda, refresca los reportes y la clasificación persistida; «Aceptar» o «Volver al expediente» vuelve a consultar la ficha del jugador enviado, incluso si antes no tenía caso o se completó un RID nuevo. Los errores de guardado no producen una confirmación falsa; un fallo de actualización posterior se anuncia sin repetir el envío. Estos cambios requieren desplegar frontend/backend y el plugin WordPress 0.6.3 para la persistencia del historial.

- La identidad se normaliza por RID numérico. Para reportes históricos con `rid` vacío se admite el formato exacto `playerId: "RID-<números>"`; frontend y backend recuperan el RID y reúnen las fuentes en una coincidencia. Un RID explícito tiene prioridad. Los IDs temporales y los nombres iguales sin RID no se usan para fusionar identidades. El plugin WordPress aplica la misma recuperación al guardar y al publicar reportes antiguos, sin migrar ni modificar estos últimos al leerlos; su actualización requiere desplegar el plugin y purgar las cachés REST/CDN.

- La vista principal consulta por nombre o RID y muestra identidades seleccionables. El archivo es vertical en todas las pantallas: panel del jugador a todo el ancho arriba y lista de reportes debajo. Dentro del panel, fotografías e identidad comparten espacio con el estado del caso; clasificación y verificación se distribuyen en columnas. La información se apila en móvil y la tabla pasa a tarjetas.
- El buscador central de la cabecera funciona desde el archivo y desde la mesa de denuncias. Combina coincidencias parciales de reportes cargados y perfiles analizados durante la sesión con búsquedas exactas en `player-insights` de WordPress y Social Club/sc-cache (nombre o RID). No presupone que un perfil tenga denuncias. Las consultas remotas esperan 450 ms, se cancelan al cambiar de texto y muestran fallos de fuente o tiempo de espera; las coincidencias llegan por fuente y se conservan si otra fuente falla o supera los 12 segundos. Seleccionar una identidad abre su ficha y consulta sus reportes. Enter analiza el texto cuando no hay coincidencias; si hay varias identidades, exige elegir una. No existe un índice de coincidencias parciales de todo sc-cache.
- La ficha separa registro fotográfico, identidad/RID, nombres y afiliaciones con procedencia, situación del caso y resumen comunitario. El RID se muestra una sola vez como «RID (Rockstar ID)», sin indicadores redundantes de disponibilidad. No se muestran referencias técnicas ni prioridad.
- Cabecera de división H.E.X., navegación entre archivo y mesa de denuncias, ficha de identificación, secciones numeradas y tabla `cyber-table cyber-style-2` componen el despacho. La apariencia policial es temática: se identifica expresamente como registro comunitario, no como autoridad policial.
- `/jugador/:expedienteId` identifica un caso persistente; `/denunciar` separa el registro de una denuncia. `/reporte/:id`, `/expediente/:numero` y `/usuario/:nombre` mantienen la consulta de reportes heredada. Los nuevos enlaces compartidos de reportes usan el ID estable de WordPress.
- Alias y afiliaciones se presentan completos, sin listas con scroll interno, con procedencia y fechas cuando existen; no se repiten sus contadores. Los avatares tienen fondo claro, zoom 1.18 con mouse/foco y ampliación con click, Enter o toque. Las evidencias se consultan exclusivamente en el detalle de cada reporte, sin galería agregada en la ficha.
- Todos los campos de texto de consulta, denuncia, chat, motivos de voto y edición usan la misma línea angular Cyberpunk, incluidas las áreas de texto.
- WordPress sigue siendo la fuente de reportes, evidencias y votos. El estado manual del caso y las notas de staff son datos distintos de la validación de cada reporte y del estado externo de la cuenta.
- La verificación comunitaria de la ficha agrega votos de reportes. No hay votos de culpabilidad del jugador; se vota en el detalle de cada denuncia.
- «Clasificación» muestra un resumen de IA persistido en `aiSummary` dentro del expediente, separado de las notas privadas del staff. Se genera al consultar por primera vez un caso con reportes y se actualiza después de cada alta exitosa desde el backend; la consulta también detecta nuevos reportes ingresados directamente en WordPress y correcciones de contenido o validación. Una huella del contenido evita ejecutar IA por recargas, cambios de orden o votos.
- Las generaciones concurrentes comparten una reserva persistida de tres minutos. Un error conserva el último resumen, lo marca como desactualizado y limita los reintentos de la misma versión a uno cada cinco minutos; si el proceso se reinicia, las reservas vencidas se recuperan en la próxima consulta. Sin reportes o con la fuente WordPress caída no se genera un resumen. Se reutiliza la configuración IA existente; el prompt solo recibe campos públicos de los reportes, nunca autoría ni notas internas, y no afirma haber visto las imágenes.
- La tabla pública y su búsqueda no incluyen reportantes. La API de casos, los endpoints heredados y el plugin WordPress omiten autoría de reportes y votos en sus respuestas públicas; los metadatos privados originales se conservan. Desplegar también el plugin actualizado y purgar las respuestas REST cacheadas para proteger las consultas directas del navegador a WordPress.
- Notas internas y cambios de estado exigen roles de Discord verificados por el servidor. No basta con activar el modo administrador del navegador. Las notas no se guardan en localStorage ni se incluyen en el contexto público de H.E.X.
- Un caso cerrado con nuevas denuncias muestra un aviso interno al staff, sin reabrirse automáticamente. La comparación utiliza las fechas de los reportes y el último cierre registrado.
- Ejecutar `npm run test:cases` para presentación, filtros, API de casos y persistencia/reintentos/concurrencia del resumen IA. Ejecutar `php wordpress/mostwanted-cpt-rest/privacy.test.php` para el contrato público de WordPress, además de las pruebas de backend de expedientes, reportes e IA.

### Persistencia privada y respaldos del despacho

El almacén runtime predeterminado es `data/expedientes.json`: contiene identidad persistente, notas privadas, autoría, auditoría y snapshots de WordPress. No debe versionarse ni publicarse como archivo estático. Git ignora exclusivamente este JSON, el directorio de bloqueo `data/expedientes.lock/` y los archivos de escritura atómica `data/expedientes.json.<PID>.<UUID>.staging`; no se excluyen los demás datos del proyecto.

Conservar este JSON en almacenamiento persistente del servidor. Hacer respaldos protegidos fuera de Git, con acceso restringido y el servicio detenido para obtener una copia consistente; restaurar también con el servicio detenido. No respaldar/restaurar locks ni archivos `.staging` como datos válidos. Ante un bloqueo huérfano después de un cierre abrupto, confirmar que ningún proceso usa el almacén antes de retirar exclusivamente `data/expedientes.lock/`. No eliminar el JSON real para resolver un bloqueo.

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
| `/api/reports/health` | GET | Estado de la integración con WordPress; devuelve 503 si no está configurada y 502 si falla |
| `/api/reports/player-insights` | GET | Antecedentes de un jugador (`username`, `rid`) desde WordPress |
| `/api/battleye-status` | GET | Estado de BattlEye |
| `/api/auth/discord` | GET | Inicia el login con Discord (OAuth) |
| `/auth/discord/callback` | GET | Callback de OAuth; redirige al frontend |
| `/api/auth/me` | GET | Usuario de la sesión actual |
| `/api/auth/logout` | POST | Cierra la sesión |
| `/api/cases/lookup` | GET | Consulta por `username` o `rid`, devuelve expediente y reportes de WordPress |
| `/api/cases/:caseId` | GET | Consulta pública del expediente del jugador |
| `/api/cases/:caseId/staff` | GET | Notas e historial privados; requiere rol de staff |
| `/api/cases/:caseId/notes` | POST | Añade nota privada con autor y fecha del servidor |
| `/api/cases/:caseId/status` | PATCH | Cambia estado del caso con motivo y auditoría |
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
| `DISCORD_STAFF_GUILD_ID` | Servidor Discord donde se verifican los roles de staff |
| `DISCORD_STAFF_ROLE_IDS` | IDs de roles autorizados, separados por comas; no son nombres de rol |
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

## Persistencia en WordPress

Los reportes se guardan en WordPress. El healthcheck consulta únicamente esa integración, sin servicios alternativos; no afecta al gateway de IA. El flujo es:

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
