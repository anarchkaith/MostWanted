# Most Wanted

Plataforma comunitaria de reportes para rastrear jugadores tóxicos (modders, griefers y ardidos) en **GTA Online**, operada por la crew **Kaith's Rebels**. Funciona como un tablón de "Se Busca" con estética del sistema H.E.X., permitiendo a la comunidad documentar, validar y consultar jugadores problemáticos mediante reportes con evidencia.

## Características principales

- **Reportes con evidencia**: formulario completo con nickname, crew, alias, RID, IP, tipo de infracción, nivel de corrupción e imágenes de prueba subidas a ImgBB.
- **Sistema de votos comunitario**: la comunidad puede validar o rechazar reportes mediante upvotes/downvotes.
- **Perfiles por jugador**: URL directa por nombre exacto (`/jugador/{nickname}`), conservando mayúsculas y guiones bajos, con historial completo de reportes.
- **Asistente IA**: chat integrado (gateway de IA de H.E.X.; Ollama local opcional) para consultar rankings, estadísticas, correlaciones y análisis tácticos sobre los reportes.
- **Integración con Discord**: notificaciones automáticas con embeds enriquecidos al canal del equipo al registrar un reporte, con enlaces al reporte para votar en la web y al perfil de Social Club.
- **Persistencia en WordPress**: reportes, jugadores y votos se guardan como custom post types mediante el plugin `wordpress/mostwanted-cpt-rest/`, que expone la API REST `/wp-json/mostwanted/v1/`.
- **Moderación de administradores**: capacidades de administración y gestión del estado de los reportes.

### Despacho y cuenta

Al iniciar sesión en la página principal sin un jugador seleccionado, el buscador aparece centrado y se ocultan la navegación del archivo y los paneles vacíos. Al consultar un jugador, el buscador vuelve al encabezado y se muestra su expediente. Las rutas directas de jugadores, reportes, denuncias y perfil conservan sus pantallas habituales.

El buscador acepta nombres, alias y RID. La ficha sitúa los avatares actuales junto a **Identificación** y mantiene el archivo de avatares anteriores por separado. Cada nombre dispone de un enlace **Ver perfil** a Social Club. Los datos pendientes muestran skeletons accesibles, sin animación cuando se solicita movimiento reducido. No se muestra la fecha de consulta: **Estado del caso** aparece solo para un caso registrado (también si está abierto), y **Verificación comunitaria** solo cuando existen votos.

La ficha utiliza un bento grid organizado por jerarquía de consulta: identidad con avatares y acciones del caso en la primera franja; análisis HEX con valoración comunitaria en la segunda; nombres, crews y archivo fotográfico como antecedentes secundarios. La identidad y el análisis tienen mayor peso visual que los datos auxiliares. Cada franja se adapta independientemente a los paneles disponibles, sin reservar celdas vacías. En tablet, las acciones forman una barra compacta y el análisis ocupa todo el ancho; en móvil todo se apila en el mismo orden de lectura, sin reordenar visualmente el foco de teclado.

El estado y la acción **Registrar reporte** se integran al pie de Identificación, sin una tarjeta independiente. El panel HEX se oculta cuando no tiene texto (incluido texto en blanco); los estados de carga o generación muestran skeletons y los errores permanecen visibles. Un análisis anterior pendiente de actualizar conserva su aviso.

Los avatares actuales y anteriores se pueden ampliar en el visor, sin edición ni envío de imágenes a servicios de IA. Los retratos de Rockstar conservan la misma corrección de transparencia que en la miniatura; el fondo del visor se aplica al contenedor, no a la imagen filtrada.

La barra de navegación muestra el nombre y avatar de la sesión de Discord verificada por el servidor. En `/perfil` se puede consultar la identidad de la cuenta, los reportes propios paginados, su detalle y la ficha del jugador, además de registrar un reporte y cerrar sesión. `GET /api/reports/mine?page=1` exige sesión aunque el acceso a otros endpoints sea opcional y responde con `Cache-Control: private, no-store`.

**Despliegue:** actualizar frontend, backend y el plugin WordPress a **0.6.4**. Los nuevos reportes autenticados reciben una vinculación privada por ID de Discord, establecida únicamente desde la sesión del backend y guardada en `_mw_owner_discord_id`. El backend consulta el endpoint WordPress protegido `GET /reports/owned` con su secreto; no publica ese ID en los reportes ni acepta que el cliente elija el propietario. Los reportes históricos sin esta vinculación no se atribuyen por nombre ni aparecen automáticamente en el perfil. Un plugin antiguo o una consulta fallida muestran un error y no una lista vacía de éxito.

Si el perfil indica que `/api/reports/mine` no está disponible (HTTP 404), hay que desplegar y reiniciar el backend que registra esa ruta en [reports.routes.js](server/modules/reports/http/reports.routes.js); actualizar solo el frontend no crea el endpoint. La comprobación sin sesión debe responder **401 JSON**, no `Cannot GET` en HTML. Una sesión válida debe poder consultar el listado privado; un fallo de WordPress se comunica como error, nunca consultando el archivo público por nombre como sustituto. El perfil usa [ownedReports](src/services/ownedReports.js) y [useOwnedReports](src/hooks/useOwnedReports.js) para distinguir despliegue incompleto, sesión expirada, HTML no válido, respuestas malformadas y cancelación; conserva reintento, skeleton y paginación.

## Estructura del proyecto

La composición general reutiliza `components/layout` y `components/screens`. La sesión Discord se coordina en `src/hooks/useSession.js`, con transporte en `src/services/sessionService.js`; la navegación History API reside en `src/hooks/useAppNavigation.js` y sus reglas comprobables en `src/services/appNavigation.js`. La conversión WordPress/legacy a datos de presentación del reporte está en `src/services/reportViewModel.js`, sin dependencias de React ni acceso al almacenamiento. `src/hooks/useReportArchive.js` coordina la carga cancelable del archivo; `src/services/reportArchive.js` gestiona paginación y copia local, distinguiendo un resultado remoto válido, una copia desactualizada y un fallo de almacenamiento. `npm run test:interface` incluye estos contratos junto con rutas y clics modificados. La pasada de refactorización queda cerrada sin cambiar las URLs públicas ni sustituir los módulos backend existentes. Dividir más el backend, el plugin o los estilos requiere una necesidad concreta de mantenimiento; no es un requisito pendiente para usar la aplicación.

El [detalle del reporte](components/ReportDetailModal.jsx) compone [resumen y validación histórica](components/reports/ReportSummary.jsx), [evidencias](components/reports/ReportEvidenceGallery.jsx), [enlace compartido](components/reports/ReportShareLink.jsx) y [votación](components/VoteSystem.jsx). [reportEvidence](src/services/reportEvidence.js) adapta URLs de WordPress, datos de presentación y adjuntos antiguos; las imágenes muestran skeletons y errores reales. Una referencia antigua que solo contiene un ID se muestra como no disponible: no se inventa una URL ni se consulta un endpoint inexistente. Las evidencias se amplían sin aplicar la corrección de transparencia reservada a los avatares de Rockstar.

[useReportVote](src/hooks/useReportVote.js) separa el estado asíncrono de la presentación y bloquea envíos simultáneos. [reportVoting](src/services/reportVoting.js) valida y guarda preferencias locales únicamente después de recibir contadores confirmados por WordPress. Si falla la copia local después del voto remoto, se conservan los contadores reales y se muestra un aviso dentro de la votación. [jsonResponse](src/services/jsonResponse.js) comparte el tratamiento de errores HTTP, JSON inválido y cancelación del transporte de reportes. Un fallo al refrescar el archivo después de guardar se comunica en la confirmación, sin fabricar reportes locales ni repetir el envío.

[Modal](components/ui/Modal.jsx), [ImageViewer](components/ImageViewer.jsx) y la [confirmación del envío](components/reports/ReportSubmissionConfirmation.jsx) comparten [useDialog](src/hooks/useDialog.js) y [dialogLifecycle](src/services/dialogLifecycle.js): foco inicial y de retorno, Tab, Escape y bloqueo de scroll anidado. Escape cierra solo el diálogo superior. La confirmación conserva las opciones de editar, aceptar y volver al expediente; si el envío asíncrono dejó el foco en el documento, al cerrar lo devuelve al botón de envío. El chat todavía tiene su propia coordinación.

[assistantChat](src/services/assistantChat.js) aísla el transporte HEX de su interfaz: clasificación de intención, contrato del contexto acotado y lectura estricta de la respuesta con el parser compartido. Intención y chat comparten el límite total de 120 segundos y la cancelación al desmontar; cancelar intención nunca inicia después el chat. Un 401 de cualquiera de las etapas comunica sesión expirada y detiene el flujo. Si falla solo la clasificación, se conserva el clasificador local existente con un aviso en consola. HTML, respuestas vacías y formatos no admitidos se muestran como errores, no como respuestas normales de HEX. `npm run test:ai` incluye ocho pruebas del transporte sin red; modelos, prompts y cuotas permanecen intactos.

[useReportSubmission](src/hooks/useReportSubmission.js) separa errores, confirmación y bloqueo de envíos simultáneos de Formik. [reportSubmissionWorkflow](src/services/reportSubmissionWorkflow.js) coordina carga de evidencias → guardado → actualización de la ficha con dependencias explícitas y pruebas sin red. Una carga o guardado fallido conserva el formulario y no muestra éxito. Un guardado confirmado conserva la confirmación aunque fallen Discord, HEX o el refresco, con sus avisos y sin repetir el envío. El éxito se basa en `ok: true`, no en que el backend devuelva además un perfil agregado: `player: null` no invalida un reporte ya guardado. Las evidencias del formulario no se envían como sustituto de las URLs publicadas.

[ReportFormModal](components/ReportFormModal.jsx) conserva únicamente la coordinación del borrador, pegado, envío y reinicio. [ReportFormFields](components/reports/ReportFormFields.jsx) compone identificación, datos adicionales, infracciones, motivo/evidencias y conductas desde un único contexto Formik, sin copiar valores a estados locales. Las categorías siguen limpiando las conductas al cambiar y el RID resuelto permanece bloqueado. Los estilos propios están en [ReportForm.css](styles/ReportForm.css), en la capa `legacy` entre base y tema; también incluye el indicador accesible de envío. La extracción conserva las reglas anteriores y se comparó su cascada en navegador a 320, 640, 1024 y 1440 px.

**Retirada legacy:** se eliminaron el modo administrativo habilitado por `?admin=1`/localStorage y sus controles de edición, eliminación y validación. Llamaban a `/reportes/:id` y `/evidencias`, rutas que el backend actual no registra, y podían aparentar éxito mediante cambios locales. No se borran las antiguas claves de almacenamiento ni los reportes históricos; severidad, validación y notas anteriores siguen disponibles en modo lectura. La gestión staff autenticada de casos, las rutas publicadas de expedientes y la propiedad privada por Discord no cambian.

La [ficha del jugador](components/PlayerBackgroundPanel.jsx) conserva la investigación y la composición bento mediante slots, pero delega identificación, fotografías actuales, archivo fotográfico y nombres/crews a [componentes del jugador](components/player). Los enlaces «Ver perfil» comparten [SocialClubProfileLink](components/player/SocialClubProfileLink.jsx). Cada imagen histórica mantiene su propio estado de carga; cambiar de identidad o de fuentes actuales reinicia el estado de los avatares sin heredar fallos de otro jugador. [playerAvatarState](src/services/playerAvatarState.js) contiene las transiciones comprobables original → proxy → no disponible: ignora eventos atrasados del original y solo ofrece el aviso de permisos después de agotar el proxy, si no queda otro avatar disponible. La corrección alpha se decide por la URL original de Rockstar, aunque se esté mostrando una copia inline o del proxy.

[InvestigationDesk](components/screens/InvestigationDesk.jsx) coordina selección, navegación y borrador de reporte; [usePlayerCase](src/hooks/usePlayerCase.js) consulta y refresca el caso con cancelación, conservando errores y datos anteriores con aviso. Una respuesta cancelada no puede reemplazar el resultado vigente. [PlayerCaseAssessment](components/player/PlayerCaseAssessment.jsx) presenta HEX en Markdown y votos; el contenedor omite los slots vacíos para no dejar huecos en el bento. [PlayerCaseReports](components/player/PlayerCaseReports.jsx) reúne filtros, paginación y tabla usando las reglas de presentación existentes.

Los estilos propios de la ficha están en [PlayerDossier.css](styles/PlayerDossier.css), cargados después de los estilos base y antes del tema; mantienen la capa `legacy`. La extracción conserva las reglas originales, sin una reescritura de la cascada. Las pruebas de interfaz incluyen siete casos del ciclo de avatares; la variante dossier y la variante predeterminada también se verificaron en navegador a 320, 640, 1024 y 1440 px.

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
- Las acciones usan `cyber-button` / `cyber-button-small` con las proporciones de la biblioteca, fondo principal rojo y sombra lateral. La integración adapta expresamente la silueta: lado izquierdo plano y esquina inferior derecha recortada, como el demo Glitch. Las máscaras asimétricas del glitch se reflejan horizontalmente para seguir esa orientación, sin reflejar letras ni invertir el movimiento. Las secundarias conservan el fondo oscuro. Las categorías también recortan su esquina derecha. Los controles de icono y enlaces de texto conservan su función específica.
- El tema de [styles/GlitchTheme.css](styles/GlitchTheme.css), cargado después de la base Cyberpunk, adapta la referencia aportada en `styles/Glitch/`: marcos angulares de esquina recortada y superficies oscuras translúcidas. Se aplica al acceso, fichas, tabla de reportes, categorías, paneles del formulario, confirmaciones, diálogos y asistente. Los marcos permanecen neutros, sin resaltado al pasar el mouse por las secciones o sus elementos internos. Se mantienen el hover y el foco propios de los controles interactivos. El fondo y el borde son capas decorativas separadas; el borde permanece sobre las superficies internas, con el centro transparente y sin interceptar eventos. Los recortes y la entrada del marco no se aplican a contenedores interactivos, para no cortar foco, menús ni tooltips ni desplazar su área de interacción. Los diálogos recuperan el subrayado de título animado del demo.
- El glitch de botón utiliza directamente la animación `glitch` de cyberpunk-css: un hijo `.glitchtext` con fondo de contraste, sombras de texto y un pseudoelemento interior con el fondo del botón. `CyberButtonLabel` conserva el texto principal y añade una sola copia con `aria-hidden`. Se mantienen la secuencia de bandas, los desplazamientos del 5% y el ciclo original de 4 s, sin capas de eco ni un contenedor que recorte el movimiento. Solo se anima al pasar el mouse o recibir foco de teclado; el área de interacción y el texto principal permanecen estables, y los botones deshabilitados no muestran el efecto.
- Los diálogos y el acceso usan una entrada escalonada de marco, encabezado, contenido y acciones, sin retrasar el foco ni las acciones. Los diálogos desplazan el overlay completo, no el interior del marco: así sus bordes y la esquina inferior cubren todo el contenido sin cortarse al hacer scroll. El asistente conserva su posición flotante y su modo de pantalla completa. Se respeta `prefers-reduced-motion`. No se ejecuta el Babel de la demo ni se importan sus selectores globales, panel Tweakpane, fuentes remotas, popovers o atajos de teclado; se mantienen los componentes y flujos React existentes.
- [InterfaceSounds](components/InterfaceSounds.jsx) centraliza por delegación los sonidos de apertura de diálogos, activación de acciones, cierre/cancelación y hover. Las opciones de selectores, resultados del buscador y categorías/etiquetas usan `370962_5450487-lq.mp3`; los botones usan `703884_6142149-lq.mp3`. Entrar en un hijo del mismo control no repite el sonido, y los controles deshabilitados, el hover táctil y las zonas `data-ui-sound="off"` no suenan. La aceptación indica una interacción, no confirma el resultado del servidor. Se reproducen al 25% de volumen, sin superponerse ni reproducirse antes de la primera interacción permitida por el navegador. No hay música, botón de sonido ni preferencia propia de silencio; el audio se controla desde el navegador. Los MP3 se solicitan al CDN de Freesound solo cuando se necesitan; no se redistribuyen en el repositorio. Los fallos se registran y muestran un aviso de estado sin bloquear acciones; se reintentan con la siguiente acción. No se incorporan dependencias de audio. Para acciones de cancelación usar `data-ui-sound="reject"`; para excluir controles, `data-ui-sound="off"`.
- [CyberSelect](components/CyberSelect.jsx) es el desplegable compartido de filtros, gestión de casos y edición de reportes. Expone combobox/listbox, selección por mouse/táctil, flechas, Inicio/Fin, búsqueda por letras, Enter/Espacio, Escape y Tab. Sus opciones se muestran en un portal sin recortes y permiten detectar hover de manera uniforme, a diferencia de los menús nativos del sistema.
- El título MOST WANTED mantiene su texto principal estable y dos copias decorativas ocultas a lectores de pantalla. `hex-brand-signal` y `hex-brand-echo` combinan recortes de franjas, desplazamientos de hasta 8 px y sesgos en ráfagas rápidas: ciclos desfasados de 1.13 y 1.73 s, con el segundo en sentido inverso, evitan que ambos repitan juntos el mismo patrón. Son variaciones deterministas, no aleatoriedad real; no se alterna el brillo de todo el título ni su opacidad. El escudo de la crew permanece estático, sin pulsación lenta de brillo/desenfoque. El indicador decorativo conserva `cyber-glitch-4`, sin representar conectividad en tiempo real. No se aplican glitches a campos, fotografías, evidencias ni texto de reportes.
- `prefers-reduced-motion: reduce` desactiva todas las animaciones y oculta las copias glitch, manteniendo los textos originales. Los efectos de la marca usan rojo y blanco en lugar de los acentos amarillo/cian originales.
- Los paneles de formulario usan fondos decorativos independientes para no recortar campos ni ayudas emergentes. Las tablas del asistente tienen desplazamiento horizontal propio.
- Las tablas conservan las franjas poligonales de 6 px de `cyber-table`, la cuadrícula de 1 px, el separador de encabezado de 2 px y el padding original de `.2rem .5rem`. La tabla de reportes usa `cyber-style-2`, columnas ajustadas al contenido y Blender Pro de 18 px con encabezados centrados y en negrita. Tiene margen interior respecto al panel, sin un fondo distinto para el encabezado. La cuadrícula y las franjas mantienen colores neutros, sin cambiar con el hover de la sección. La integración comparte la cuadrícula y la disposición mediante `table-caption` con las tablas del asistente, sin sustituir las geometrías de la biblioteca. En móviles los reportes conservan su presentación por tarjetas y las etiquetas de cada dato.
- Las cabeceras de diálogos reservan una columna para cerrar en la esquina superior derecha; cerrar y copiar tienen objetivos de 44 px, sin giros al pasar el mouse. Las ayudas permanecen visibles mientras conservan el foco de teclado, aunque el puntero salga de ellas.
- El orden `legacy, cyberpunk` se declara antes de cargar los estilos; los estilos locales de integración permanecen por encima de ambas capas. Los restos visuales de antecedentes (chips cian y avatares redondeados) se adaptan a la paleta y bordes del tema, sin cambiar sus datos. Los campos nativos respetan el esquema oscuro.
- La distribución se define en `styles/Cyberpunk.css` y el acabado visual en `styles/GlitchTheme.css`: se conservan las familias temáticas originales (Blender Pro para texto de trabajo de 18 px, Closeness para títulos e IBM 3270 para datos técnicos), los bordes y los efectos de la biblioteca cyberpunk y del demo Glitch. Las acciones de trabajo y selectores tienen objetivos táctiles de al menos 44 px; las acciones compactas de cabecera tienen 40 px de alto. La tabla agrupa fecha y número y usa la acción explícita «Ver reporte». Los filtros se alinean en escritorio amplio, se apilan en móvil y solo aparecen si hay reportes que filtrar. La pantalla inicial muestra una sola indicación de búsqueda. El CSS anterior y los bloques de estilos heredados quedan en la capa `legacy`, por debajo de la biblioteca y del tema, para evitar que sus efectos compitan con el diseño actual.
- Los errores de envio reciben el foco y se anuncian como alertas. La confirmacion permite navegar con Tab dentro del dialogo, cerrarlo con Escape y volver al control anterior.
- Por debajo de 640 px, la investigacion se apila, las acciones principales ocupan el ancho disponible y el chat utiliza la pantalla completa con altura dinamica. Las categorias pasan a dos columnas por debajo de 900 px y a una por debajo de 480 px para no partir sus nombres; motivo y evidencias se apilan por debajo de 900 px.
- Antes de iniciar sesión, la pantalla ocupa al menos el alto dinámico de la ventana (`100dvh`, con fallback `100vh`). El panel de acceso y su única acción, «Iniciar sesión con Discord», se centran en el espacio disponible entre cabecera y pie; en pantallas bajas el documento puede crecer y desplazarse sin recortar el contenido. La distribución del despacho autenticado no cambia.

## Despacho de investigación

- Los textos visibles priorizan datos y acciones: ficha, estado del caso, historial y reportes. No se repiten subtítulos de sección, contadores sin filtrar ni instrucciones equivalentes en tooltips, placeholders y notas. Se conservan nombre, RID, avatares, crews, referencias, fechas, clasificación y votos. La fecha de consulta permanece disponible; los errores, las fuentes desactualizadas y las coincidencias solo por nombre siguen avisándose en contexto. Las aclaraciones generales sobre estados comunitarios, vigencia y votos se concentran en Ayuda. El formulario mantiene límites de archivos, campos opcionales, validaciones y avisos de entrega sin duplicar sus explicaciones.
- «Archivo de investigación» conserva el jugador seleccionado: desde el formulario vuelve a su URL por nombre, sin borrar la selección ni reiniciar la ficha. El enlace real también apunta a esa ficha para permitir abrirla en otra pestaña. Tras guardar un reporte, el regreso usa la identidad confirmada por el envío.
- Buscar o seleccionar un jugador navega primero a `/jugador/<nombre>`; las consultas de ficha e investigación se inician desde esa ruta, sin pasar por la pantalla inicial ni esperar su resolución. Si solo se conoce el RID, se abre `/jugador/<RID>` y se sustituye por la URL del nombre cuando se resuelve la identidad.

- La versión sigue SemVer en [package.json](package.json), sincronizada con [package-lock.json](package-lock.json). El frontend importa directamente esa versión para el pie de página; no mantiene un número independiente ni necesita una constante duplicada en Vite. Las correcciones compatibles incrementan el parche (`npm version patch --no-git-tag-version`).
- El flujo principal es buscar por nombre/RID, abrir la ficha y usar «Registrar reporte» dentro de esa ficha. La cabecera no ofrece registro directo ni control de sonido; la mesa de denuncias aparece en la navegación solo mientras se está usando. La investigación se transfiere al formulario para no exigir otra consulta; si aún estaba en curso se completa allí. La ausencia de resultados o el fallo de las fuentes no impide aportar datos. El jugador seleccionado se muestra como texto, sin volver a pedir su nombre; solo se permite escribirlo al entrar al formulario sin una selección. RID sin resolver y crews pueden completarse. Los nombres conocidos son información automática de solo lectura: se actualizan al completar la consulta y los nombres de otros reportes solo se incorporan al borrador si comparten RID. Una respuesta de otro RID no modifica el borrador. Los avatares se obtienen automáticamente de la investigación y se conservan como metadatos del reporte: no se piden ni se editan URLs de avatar. El contenedor y el textarea de motivo crecen juntos hasta ocupar el alto disponible, dejando el contador fuera del campo.
- Los antecedentes se muestran únicamente en [PlayerBackgroundPanel](components/PlayerBackgroundPanel.jsx), dentro del archivo, no de nuevo en el formulario. [ReportPlayerIdentity](components/ReportPlayerIdentity.jsx) muestra el destinatario; el resto del formulario recoge aportes nuevos. Para salir del formulario se usa «Archivo de investigación» en la navegación, sin un botón de regreso duplicado. Ambos componentes reutilizan [usePlayerInvestigation](components/usePlayerInvestigation.js) para consultas y estados. [playerProfile](src/services/playerProfile.js) centraliza el historial y [reportPlayerDraft](src/services/reportPlayerDraft.js) traslada los datos al formulario. Completar una consulta pendiente no sobrescribe los aportes manuales ni aplica una respuesta de otro nombre.
- La ficha reúne el perfil externo actual y el historial de reportes. Nombres y crews se agrupan una sola vez por valor, ignorando diferencias de mayúsculas; las observaciones conservan los reportes asociados y sus fechas. El agregado de WordPress no se presenta como una fuente independiente ni duplica el reporte original. Esta información siempre está visible en el panel, sin desplegable. Los avatares por RID se consultan en Rockstar y sus dos URLs actuales, junto con cualquier otra URL mostrada como actual, se excluyen del historial. Los nombres y crews reportados no se presentan como verificados ni necesariamente vigentes. Se conservan URLs anteriores, no copias de las imágenes: una URL mutable puede mostrar contenido nuevo y no permite reconstruir una foto histórica perdida.
- La interfaz no anuncia Social Club como procedencia de los datos: el buscador omite las etiquetas de fuente y las observaciones públicas muestran referencias a reportes, o únicamente la fecha si no hay reporte asociado. Se conservan los metadatos internos y el enlace voluntario para visitar el perfil.
- Un envío confirmado invalida la búsqueda, refresca los reportes y la clasificación persistida; «Aceptar» o «Volver al expediente» vuelve a consultar la ficha del jugador enviado, incluso si antes no tenía caso o se completó un RID nuevo. Los errores de guardado no producen una confirmación falsa; un fallo de actualización posterior se anuncia sin repetir el envío. Estos cambios requieren desplegar frontend/backend y el plugin WordPress 0.6.3 para la persistencia del historial.

- La identidad se normaliza por RID numérico. Para reportes históricos con `rid` vacío se admite el formato exacto `playerId: "RID-<números>"`; frontend y backend recuperan el RID y reúnen las fuentes en una coincidencia. Un RID explícito tiene prioridad. Los IDs temporales y los nombres iguales sin RID no se usan para fusionar identidades. El plugin WordPress aplica la misma recuperación al guardar y al publicar reportes antiguos, sin migrar ni modificar estos últimos al leerlos; su actualización requiere desplegar el plugin y purgar las cachés REST/CDN.

- La vista principal consulta por nombre o RID y muestra identidades seleccionables. La ficha mantiene el estilo cyberpunk con una organización de terminal en tres columnas: identidad/RID y nombres a la izquierda, análisis HEX en Markdown y registro fotográfico en el centro, estado del caso, crews y votos a la derecha. Cada nombre, incluido el principal y los alias, tiene a su lado un botón de Social Club que abre el perfil exacto en otra pestaña. Se conservan fuentes, fechas, avatares actuales y anteriores y la acción de registrar un reporte. La gestión privada sigue reservada al staff y aparece debajo. La ficha pasa a dos columnas en tablet y a una en móvil; la lista de reportes permanece debajo, con tabla adaptable a tarjetas.
- El buscador central de la cabecera funciona desde el archivo y desde la mesa de denuncias. Combina coincidencias parciales de reportes cargados y perfiles analizados durante la sesión con búsquedas exactas en `player-insights` de WordPress y Social Club/sc-cache (nombre o RID). No presupone que un perfil tenga denuncias. Las consultas remotas esperan 450 ms, se cancelan al cambiar de texto y muestran fallos de fuente o tiempo de espera; las coincidencias llegan por fuente y se conservan si otra fuente falla o supera los 12 segundos. Seleccionar una identidad abre su ficha y consulta sus reportes. Enter analiza el texto cuando no hay coincidencias; si hay varias identidades, exige elegir una. No existe un índice de coincidencias parciales de todo sc-cache.
- La ficha separa registro fotográfico, identidad/RID, nombres y afiliaciones con procedencia, situación del caso y resumen comunitario. El RID se muestra una sola vez como «RID (Rockstar ID)», sin indicadores redundantes de disponibilidad. No se muestran referencias técnicas ni prioridad.
- Las crews de la ficha enlazan a su página de Social Club (`https://socialclub.rockstargames.com/crew/epi-gta5`) en otra pestaña. La web y Discord comparten el generador de enlaces: se prioriza la URL registrada, se conservan guiones y guiones bajos y se normalizan enlaces antiguos terminados en `/hierarchy`.
- Cabecera de división H.E.X., navegación entre archivo y mesa de denuncias, ficha de identificación, secciones numeradas y tabla `cyber-table cyber-style-2` componen el despacho. La apariencia policial es temática: se identifica expresamente como registro comunitario, no como autoridad policial.
- `/jugador/:nombreExacto` abre la ficha sin convertir el nombre en slug ni sustituir sus guiones bajos. El nombre actual resuelto es la URL canónica; el RID sigue identificando internamente la cuenta y evita fusionar identidades por nombre. Los enlaces antiguos `/jugador/case-<UUID>` y `/usuario/:nombre` siguen abriendo la ficha y se canonicalizan al nombre resuelto. `/denunciar` separa el registro de una denuncia. `/reporte/:id` y `/expediente/:numero` mantienen la consulta de reportes; los enlaces compartidos de reportes usan su ID estable.
- Alias y afiliaciones se presentan completos, sin listas con scroll interno, con procedencia y fechas cuando existen; no se repiten sus contadores. `PlayerAvatarImage` normaliza solo el canal alfa de los retratos de Rockstar (153/255 a opaco, conservando RGB y píxeles transparentes) mediante un filtro SVG. Se usa una sola imagen, tanto en miniatura como en la ampliación; las imágenes externas y evidencias no reciben ese filtro. Las miniaturas no superan sus 128 px de imagen; el foco/hover resalta el borde sin agrandarlas sobre el contenido. Se amplían con click, Enter o toque. Las evidencias se consultan exclusivamente en el detalle de cada reporte, sin galería agregada en la ficha.
- Todos los campos de texto de consulta, denuncia, chat, motivos de voto y edición usan la misma línea angular Cyberpunk, incluidas las áreas de texto.
- WordPress sigue siendo la fuente de reportes, evidencias y votos. El estado manual del caso y las notas de staff son datos distintos de la validación de cada reporte y del estado externo de la cuenta.
- La severidad es opcional: solo se muestran valores explícitos válidos (`baja`, `media`, `alta`, `critica`), sin asignar «media» por defecto ni inferirla de palabras en etiquetas. El modal y las tarjetas omiten el campo si falta; la tabla omite la columna si ningún reporte del jugador tiene severidad. La edición permite dejarla sin asignar.
- «Estado del caso» pertenece a la ficha del jugador: se crea como «Abierto» y el staff puede cambiarlo a «En investigación» o «Cerrado» desde Gestión interna, eligiendo estado, indicando motivo y guardando. El servidor verifica pertenencia a `DISCORD_STAFF_GUILD_ID` y uno de los roles de `DISCORD_STAFF_ROLE_IDS` mediante Discord (`guilds.members.read`); el modo administrador local no concede ese permiso. Cada cambio conserva autor, motivo y fecha en el historial interno. Buscar, generar un resumen, votar o recibir nuevos reportes no cambia ese estado. Un caso cerrado requiere reapertura manual. El modal muestra únicamente «Validación del reporte», sin afirmar que rechazar un reporte cierre el caso; los resultados de votos se muestran por separado.
- La verificación comunitaria de la ficha agrega votos de reportes. No hay votos de culpabilidad del jugador; se vota en el detalle de cada denuncia.
- «Análisis HEX» muestra un resumen de IA persistido en `aiSummary` dentro del expediente, separado de las notas privadas del staff. Se genera al consultar por primera vez un caso con reportes y se actualiza después de cada alta exitosa desde el backend; la consulta también detecta nuevos reportes ingresados directamente en WordPress y correcciones de contenido o validación. Una huella del contenido evita ejecutar IA por recargas, cambios de orden o votos.
- El resumen se genera y renderiza en Markdown. El prompt omite severidad y validación vacías, no interpreta su ausencia como una revisión ni expone nombres técnicos o JSON en el texto. La huella incluye la versión del resumen para regenerar los formatos anteriores en la próxima consulta con la fuente disponible.
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

### Vistas previas al compartir reportes y jugadores

En el hosting estatico Apache/LiteSpeed, las rutas `/reporte/<id>`, `/jugador/<nickname-o-rid>` y el alias `/usuario/<nickname-o-rid>` pasan por `public/share.php` mediante las reglas de `.htaccess`. Este archivo sirve el HTML compilado de la SPA con titulo, descripcion, canonical, Open Graph y Twitter especificos, antes de ejecutar JavaScript. No cambia el acceso a la aplicacion ni requiere una sesion para que Discord lea la vista previa.

- **Reporte:** nombre del jugador, numero de reporte, extracto del motivo, infracciones reportadas, cantidad de evidencias y votos comunitarios a favor/en contra.
- **Jugador:** el **resumen HEX persistido** inicia la descripcion de metadata, sin anteponer contadores ni etiquetas que consuman su limite de 160 caracteres. Se obtiene de `player.aiSummary` en WordPress y se convierte de Markdown a texto; compartir un enlace nunca llama a la IA. Si falta o esta desactualizado, la descripcion inicia con el ultimo motivo reportado y la tarjeta avisa del estado del resumen. La imagen no repite el resumen: muestra nombre, total de reportes, RID, crews, conductas y fecha del ultimo reporte, ademas de sus evidencias y votos. Se consultan hasta cinco reportes recientes; no se presentan esos votos como un total de todos los antecedentes. El perfil privado `/perfil` no publica metadata de la cuenta.
- **Imagen dinamica:** `share-image.php` genera un PNG real de **1200 x 630** con los datos del reporte o perfil, incluido el extracto del motivo y una aclaracion de que son acusaciones comunitarias, no hechos confirmados. Usa GD y fuentes bitmap incorporadas (sin descargar fuentes o imagenes externas). Open Graph declara las dimensiones y `image/png`. La URL lleva una revision derivada del contenido para renovar la imagen cuando cambian los datos, aunque cada plataforma puede mantener su propia cache. No se utiliza el banner generico para las vistas previas validas.
- Un recurso inexistente devuelve 404. Una consulta fallida devuelve 502/503 con `noindex` y sin cache; no inventa datos del jugador o del reporte. Las respuestas validas se pueden cachear durante cinco minutos. Discord y otras plataformas pueden conservar su propia cache por mas tiempo.

Las descripciones HTML/Open Graph/Twitter se limitan a **160 caracteres**; el texto extenso permanece en el contenido HTML inicial y en la tarjeta, no en la meta description. El HTML inicial contiene un H1 visible y datos JSON-LD `ProfilePage`/`WebPage` coherentes con la URL; React sustituye ese contenido al iniciar, sin agregar otro H1 persistente. Se publican `favicon.svg` y `site.webmanifest` reales. El manifiesto declara la aplicacion, pero no ofrece soporte offline ni instala un service worker.

`MOSTWANTED_TWITTER_SITE` permite indicar la cuenta oficial (por ejemplo, `@CuentaReal`) en el entorno PHP. Si no esta configurada se omite `twitter:site`, sin inventar una identidad; un valor invalido produce un diagnostico explicito.

`share-cache.php` reutiliza las respuestas publicas exitosas de WordPress durante **300 segundos**, tanto para HTML como para imagenes; no cachea errores ni consultas privadas. Guarda los PNG por ruta y revision del contenido para no renderizarlos otra vez en cada peticion. La cache reside en un directorio dedicado del temporal de PHP, fuera de la web; requiere permiso de escritura. Cambios del contenido invalidan la imagen al refrescar la fuente (hasta cinco minutos), y los despliegues de los generadores invalidan sus entradas por fecha del archivo. Configurar tambien la CDN con TTL de cinco minutos solo para respuestas 200 de estas rutas publicas, excluyendo errores, `/api`, autenticacion y `/perfil`. Medir cache fria y caliente por separado: no se garantiza una latencia inferior a 200 ms en todos los puntos de acceso.

**Despliegue en Hostinger:** actualizar el plugin WordPress a **0.6.12** y desplegar tambien el backend Node, que publica el resumen ya generado en la metadata del jugador; despues ejecutar `npm run build` y subir **todo** `dist/`, incluidos `share.php`, `share-metadata.php`, `share-image.php`, `share-card.php` y `.htaccess`. Se requiere PHP 8.0+ con **cURL, GD e iconv**, y las reglas de reescritura activadas. El origen WordPress por defecto es `https://kaithsrebels.com`; puede cambiarse mediante la variable de entorno PHP `WORDPRESS_API_BASE_URL`. El lector PHP no necesita ni envia el secreto de ingesta; solo el backend Node lo usa para publicar el resumen. Si GD no esta disponible, el endpoint de imagen devuelve 503 y deja el diagnostico en el log PHP; no devuelve una imagen generica como si hubiera generado la tarjeta.

El resumen sigue guardado en `aiSummary` del expediente Node; una copia se persiste en `_mw_ai_summary` de la ficha WordPress y se devuelve como `player.aiSummary: {text, updatedAt, reportCount, stale}`. El backend publica una vez por huella del resumen, incluidos resumenes ya generados antes del despliegue (se sincronizan en la siguiente consulta de la ficha sin regenerarlos). El endpoint `GET/POST /wp-json/mostwanted/v1/players/ai-summary` exige el secreto del backend: verifica que los reportes usados coincidan y rechaza con 409 publicaciones cuya fuente cambio durante la generacion. Las lecturas publicas calculan vigencia pero no generan ni escriben IA. Nuevos reportes, eliminaciones o correcciones relevantes invalidan el resumen; votos, crews y recargas no lo regeneran. Los cambios hechos directamente en WordPress se detectan en la siguiente consulta del caso por Node; hasta entonces la copia se marca desactualizada.

Un fallo de publicacion conserva el texto generado, se notifica en la clasificacion y se reintenta tras cinco minutos al consultar el caso, sin volver a generar IA por ese fallo. Para recibir resumenes nuevos sigue siendo necesario que el servidor Node este disponible y tenga configurado su proveedor IA y el secreto de WordPress; el hosting estatico no ejecuta ese proceso.

Si un reporte devuelve 404, comprobar primero la respuesta de `/wp-json/mostwanted/v1/reports/<id>` en WordPress: `rest_no_route` significa que falta actualizar el plugin (la vista previa devuelve 503), no que el reporte no exista. `report_not_found` si indica un reporte ausente o no publicado. El lector de vistas previas acepta un BOM UTF-8 inicial para mantener compatibilidad con respuestas de versiones anteriores; otros JSON invalidos siguen devolviendo 502. Despues de actualizar, purgar la cache REST/CDN y volver a analizar el enlace.

Estas reglas corresponden al despliegue estatico Apache/LiteSpeed: `vite preview` y el servidor estatico de Express no ejecutan PHP. Para las vistas previas en ese esquema, el proxy del dominio debe servir estas rutas con PHP. Las rutas de API siguen su configuracion habitual.

Validacion local: `npm run test:metadata` (requiere PHP CLI con GD, iconv, DOM y mbstring para las pruebas). Verifica los resumenes, los bytes PNG y sus dimensiones, ademas de que cambios en los datos cambien la imagen. Tambien puede comprobarse el HTML compilado con `php server/reports/shareMetadata.test.php dist/index.html` despues del build.

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

El mensaje incluye enlaces dentro del embed, sin depender de componentes o botones:

- **Ver reporte y votar**: aparece debajo del encabezado «Reporte de jugador» y abre `https://mostwanted.kaithsrebels.com/reporte/<id>`. Si el login es necesario, la web vuelve a esa ruta después de iniciar sesión. Sin un ID válido se muestra un enlace general a la web, no a un reporte inexistente.
- **Nombre del jugador**: es el título del embed y abre su perfil en Rockstar Social Club.
- **Reportar a un jugador**: abre `https://mostwanted.kaithsrebels.com/#reportar`, que lleva directo al formulario de reporte de la web.
- **Ver lista de reportes**: abre `https://mostwanted.kaithsrebels.com/#reportes-lista`.

Los webhooks normales de Discord pueden ignorar `components`; los enlaces Markdown del embed no requieren bot. Votar desde Discord no está disponible; el voto se hace en la web.

El webhook incluye **Aportar información sobre este jugador**, que abre su ficha para usar «Registrar reporte», **Reportar a un jugador**, que abre `/denunciar`, y **Ver reporte y votar** para el reporte concreto. Las vistas previas automaticas de enlaces compartidos no admiten botones personalizados desde Open Graph. Los botones reales en mensajes requieren una integracion compatible con componentes (bot o webhook de aplicacion); no se simulan botones en la imagen ni se agregan componentes que el webhook actual pueda ignorar.

El envío de notificaciones está limitado por `DISCORD_WEBHOOK_MIN_INTERVAL_MS` (por defecto 45 segundos).

## Integración con IA

El asistente usa el gateway de IA de H.E.X. (`KAITH_AI_GATEWAY_TOKEN`, por defecto `https://api.kaithsrebels.com/v1/text`). Ollama local con `qwen2.5` solo se usa si `KAITH_AI_USE_LOCAL_OLLAMA=true`. El orden de proveedores es: hex-gateway, luego ollama-local (si está activo) y por último production-api.

Límite de uso: cada usuario puede hacer 10 consultas por día (día calendario de Buenos Aires). Las consultas de chat y correlación consumen cuota; la clasificación de intención requiere sesión pero no consume cuota. El contador vive en memoria, así que se reinicia al reiniciar el servidor. Al agotarse, la API responde 429 con el mensaje correspondiente.

Soporta tres modos:

- **Chat**: responde preguntas sobre reportes, rankings y estadísticas.
- **Clasificación de intención**: determina si la consulta es sobre un reporte específico o una pregunta general.
- **Correlación**: detecta patrones de reincidencia y evalúa nivel de amenaza global entre reportes relacionados.
