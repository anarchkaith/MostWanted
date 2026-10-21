# Most Wanted

Plataforma comunitaria de reportes para rastrear jugadores tóxicos (modders, griefers y ardidos) en **GTA Online**, operada por la crew **Kaith's Rebels**. Funciona como un tablón de "Se Busca" con estética del sistema H.E.X., permitiendo a la comunidad documentar, validar y consultar jugadores problemáticos mediante reportes con evidencia.

## Características principales

- **Reportes con evidencia**: formulario completo con nickname, crew, alias, RID, IP, tipo de infracción, nivel de corrupción e imágenes de prueba subidas a ImgBB.
- **Sistema de votos comunitario**: la comunidad puede validar o rechazar reportes mediante upvotes/downvotes.
- **Perfiles por jugador**: URL directa por nombre exacto (`/jugador/{nickname}`), conservando mayúsculas y guiones bajos, con historial completo de reportes.
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

- La vista principal consulta por nombre o RID y muestra identidades seleccionables. La ficha mantiene el estilo cyberpunk y organiza todos los datos existentes como un archivo: cabecera y fechas, registro fotográfico con avatares actuales y anteriores, identificación/RID y situación externa de la cuenta, nombres y crews con fuentes y fechas. Una franja separada reúne el estado manual del caso y la acción de registrar un reporte; debajo, análisis HEX en Markdown y verificación comunitaria se distribuyen en columnas. La gestión privada sigue reservada al staff. La información se apila en móvil y la lista de reportes permanece debajo, con tabla adaptable a tarjetas.
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
