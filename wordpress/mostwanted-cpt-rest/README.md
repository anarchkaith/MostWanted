# MostWanted CPT + REST

Plugin WordPress para registrar CPT de jugadores/reportes y exponer endpoints REST para ingesta de reportes.

## 1) Instalacion rapida

Version 0.7.4: elimina por completo la inyeccion automatica de datos en `the_content`. El plugin solo ofrece campos y fuentes de datos para las plantillas: no genera una ficha, tabla ni JSON en la pagina del reporte. El visor de campos y los datos internos permanecen exclusivamente en el administrador WordPress. No carga CSS en el frontend ni modifica el fondo de `body`; el diseno pertenece al tema y a Elementor.

Version 0.7.3: registra 25 campos de solo lectura compatibles con ACF gratuito y Elementor Pro. Lee los metadatos originales tambien en reportes historicos, sin duplicarlos ni migrarlos. Sustituye el volcado generico por el grupo ACF; sin ACF conserva una tabla de campos con nombres legibles. Incluye una etiqueta dinamica de imagen para avatares/evidencias externos, sin importarlos a Medios. Mantiene el acceso privado y no reemplaza contenido existente de Elementor.

Version 0.7.2: todas las lecturas de reportes y jugadores y los votos exigen el secreto existente del backend (`MOSTWANTED_API_SECRET`/opcion WordPress, igual a `WORDPRESS_API_SECRET` en Node). Ya no son endpoints anonimos y las CPT dejan de exponerse en REST nativa `wp/v2`. El navegador usa las rutas Node con su sesion Discord existente; no recibe ese secreto ni descarga el archivo completo al iniciar. Respuestas REST `private, no-store`, sin fallback publico. Actualizar frontend, backend, PHP de vistas previas y plugin juntos y purgar cache WordPress/CDN. El entorno PHP de vistas previas tambien debe recibir el mismo `WORDPRESS_API_SECRET` existente, fuera de archivos publicos; si falta devuelve 503. No se genera ninguna clave nueva. El administrador WordPress de solo lectura y las vistas previas compartidas se conservan; el acceso autenticado y las tarjetas publicas no son una proteccion absoluta contra copiar datos.

Version 0.7.1: retira Severidad de la proyeccion publica y del visor WordPress, incluidos `severity`/`severidad` anidados en analisis historicos. Los valores siguen almacenados y no se borran al editar; ya no participan en prioridad, estadisticas, correlaciones, rankings ni colores de vistas previas. Los colores conservan unicamente su relacion con las conductas del catalogo. Los resumenes anteriores se marcan desactualizados y se regeneran en la proxima consulta de MostWanted con la fuente disponible. Desplegar frontend, backend, PHP publico y plugin juntos, y purgar cache REST/CDN.

Version 0.7.0: WordPress pasa a ser un visor de reportes de solo lectura. La edicion se realiza en MostWanted por la administradora web ya autorizada o por el propietario Discord verificado del reporte. Requiere desplegar frontend, backend y la carpeta completa del plugin juntos. No requiere ACF ni migrar datos. Reemplaza el editor y la moderacion nativa de reportes de las versiones 0.6.x; los votos existentes se conservan, pero esta version no ofrece herramientas web para moderarlos. Realiza una copia de seguridad antes de actualizar.

Version 0.6.16: agrega `GET /search?q=...&page=...&per_page=...`, protegido por el secreto del backend. Busca nombres, alias, RID, motivos, infracciones, etiquetas, crews y resúmenes guardados en reportes y fichas publicados; no consulta datos privados del reportante, IPs ni URLs. Ignora mayúsculas y tildes y exige todas las palabras dentro de un reporte o ficha. Recorre todo el archivo en lotes de 100 y pagina identidades agrupadas por RID o nombre (50 por defecto, máximo 100), con `total`, `hasMore` y hasta cinco fragmentos por identidad. No genera IA ni modifica datos; los resúmenes guardados pueden estar desactualizados. Desplegar frontend/backend y plugin juntos. La implementación recorre el archivo sin índice persistente; un archivo grande requerirá indexación para mantener tiempos de respuesta.

Version 0.6.15: el dashboard web en `/admin` usa `/accounts/private` con `reportCount` exacto (consulta por `_mw_owner_discord_id`, sin limitarlo a los 50 enlaces recientes) y `loginCount`, registrado en `_mw_login_count` desde esta actualizacion. No reconstruye inicios de sesion anteriores. El backend agrega presencia desde su propio almacen de sesiones, aplica busqueda/filtros/orden antes de paginar y conserva el acceso exclusivo del administrador web actual. Una fecha de acceso WordPress nunca se interpreta como una sesion vigente. Desplegar frontend, backend y plugin juntos; un contrato antiguo devuelve un error explicito.

Version 0.6.14: agrega consulta privada paginada `/accounts/private`, protegida por el secreto del backend, para el panel web de la administradora autorizada. El backend debe verificar el ID de la sesion antes de consultar; nunca exponer esta ruta mediante un proxy publico. Los reportes sin captura de identidad consultan la cuenta privada asociada al ID del propietario y la identifican como datos actuales, no historicos. Si no existe esa cuenta, hace falta un nuevo acceso del usuario con backend actualizado; instalar el plugin solo no recupera datos que nunca se guardaron.

Version 0.6.13: incorpora **MostWanted > Usuarios MostWanted**, con acceso exclusivo a administradores (`manage_options`). Guarda identidad Discord verificada (ID, usuario, nombre visible, avatar y correo disponible), primer acceso, ultimo login y ultima actividad registrada. Cada reporte muestra un apartado privado con su autor y fecha; la ficha de cuenta enlaza hasta 50 reportes recientes. Las cuentas son privadas, sin REST publico. `POST /accounts/activity` solo acepta el secreto del backend; no admite lecturas publicas. No se guardan tokens ni contrasenas. El frontend informa del almacenamiento antes del acceso.

Requiere desplegar tambien el backend actualizado y configurar su `WORDPRESS_API_SECRET` con el mismo secreto del plugin. Desde 0.6.15, el navegador envia un heartbeat cada minuto con la pestaña visible y al regresar a ella; el backend sincroniza la actividad como maximo una vez por minuto por sesion. No registra todos los clics ni visitas anonimas. Una pestaña visible no demuestra interaccion humana. No reconstruye identidades historicas ausentes. Los fallos de sincronizacion quedan en logs y no bloquean el login; los fallos de heartbeat se notifican en el sitio y se reintentan. Todos los administradores y quienes tengan acceso directo a la base de datos pueden consultar estos datos. Los metadatos privados son `_mw_private_identity` y `_mw_owner_discord_id` en reportes; `_mw_identity`, `_mw_discord_id`, `_mw_first_access`, `_mw_last_login`, `_mw_last_access`, `_mw_last_event` y `_mw_login_count` en fichas `mw_account`.

Versión 0.6.12: guarda el resumen HEX como metadata `_mw_ai_summary` de la ficha y lo devuelve como `player.aiSummary` con texto, fecha, cantidad de reportes y vigencia (`stale`). El backend Node publica el texto ya generado; WordPress y las vistas previas solo leen el resumen, nunca llaman a la IA. Cambios relevantes en los reportes invalidan la copia; votos y visitas no lo hacen. Hasta que Node sincronice un resumen actualizado se conserva el anterior marcado como desactualizado, sin presentarlo como vigente en las vistas previas.

Conserva la correccion del BOM UTF-8 de 0.6.11 y `GET /reports/<id>` (desde 0.6.10) para obtener un reporte publicado por su ID. No publica borradores, reportes privados ni datos del reportante. Si este endpoint responde `rest_no_route`, actualizar el plugin instalado y purgar la cache REST/CDN; no indica que el reporte solicitado no exista.

Historico 0.6.9 (reemplazado por el visor 0.7.0): el editor WordPress mostraba los campos del formulario de denuncia y un panel de moderacion de votos. Estos controles ya no se cargan; sus valores guardados se conservan.

Conserva nombres, crews y URLs de avatares al recibir nuevos reportes. Los datos vacíos no borran avatares conocidos y los nombres ausentes del reporte nuevo mantienen su fecha previa. La consulta por nombres históricos usa los alias registrados y nunca combina RIDs conocidos diferentes. `player-insights` añade `avatarHistory` y `crewHistory`, con fechas de registro cuando se conocen; no convierte los datos reportados en identidad externa verificada. El historial conserva URLs, no copias de imágenes alojadas por terceros.

Mantiene la recuperación del RID desde el formato exacto `playerId: "RID-<números>"` cuando el campo numérico falta, tanto al guardar como al publicar reportes históricos. Un RID explícito tiene prioridad. Conserva la protección de los datos del reportante.

Para actualizar desde un ZIP: **Plugins > Añadir nuevo plugin > Subir plugin**, selecciona el archivo y confirma **Reemplazar el actual con el subido**. No desinstales el plugin ni borres sus datos. Después, purga la caché REST/CDN.

1. Copia la carpeta `mostwanted-cpt-rest` dentro de `wp-content/plugins/`.
2. Activa el plugin desde **Plugins** en el panel de WordPress.
3. Configura el secreto de una de estas 2 formas:

- Opcion A (recomendada): en `wp-config.php`:

```php
define('MOSTWANTED_API_SECRET', 'cambia-esto-por-un-secreto-seguro');
```

- Opcion B: en WordPress, ve a **Ajustes > MostWanted CPT + REST** y guarda `API Secret`.

4. Guarda enlaces permanentes (WordPress suele refrescar reglas automaticamente al activar, esto es por seguridad extra).

## 2) Consultar en WordPress y editar en MostWanted

En **MostWanted > Reportes**, abre un reporte para consultar sus valores actuales, incluidas listas, evidencias, analisis y votos publicos. No hay controles de guardado, biblioteca de medios, edicion rapida ni acciones masivas. Tambien se bloquean escrituras por el editor nativo; no basta con ocultar los botones. Las CPT de reportes y jugadores no se exponen por REST generico `wp/v2`; las consultas de MostWanted usan los endpoints protegidos del plugin.

Los administradores WordPress (`manage_options`) ven el payload interno en un apartado privado plegado, omitiendo los campos de Severidad retirados, ademas de la identidad privada del autor. No se publica ese payload ni los datos del autor/votantes. Con ACF activo, el grupo **MostWanted - Campos del reporte (solo lectura)** reemplaza el visor generico. Sin ACF se conserva una tabla de campos solo en administracion. La pagina individual `/reportes/...` no recibe contenido automatico del plugin: su presentacion depende exclusivamente del tema o de tu plantilla Elementor. Sigue exigiendo login WordPress y no se indexa.

### ACF gratuito y Elementor Pro

1. Actualiza la carpeta completa del plugin a **0.7.4**, con ACF gratuito activo. No crees ni importes otro grupo: el plugin lo registra por codigo para el CPT `mw_report`. Abre un reporte antiguo para comprobar sus campos; no hace falta volver a guardarlo.
2. En **Elementor > Theme Builder**, crea una plantilla **Single** para **Reportes MostWanted**. En los ajustes de vista previa elige un reporte publicado real, no una pagina o la propia plantilla.
3. En un widget de texto/titulo, elige **Etiquetas dinamicas > Campo ACF**, abre sus ajustes y selecciona el campo del grupo MostWanted. Usa un widget de texto para los valores de varias lineas.
4. En un widget **Imagen**, elige **Etiquetas dinamicas > MostWanted > MostWanted - Imagen del reporte** y selecciona Avatar 1, Avatar 2 o Evidencia 1 a 5. Las URLs externas no son IDs de la biblioteca de Medios: por eso se incluye esta etiqueta, en lugar de simular un campo ACF de tipo Imagen. No presenta videos como imagenes; usa sus URLs en enlaces/widgets de video.
5. Aplica la condicion de visualizacion al CPT de reportes. El plugin no rellena el widget Contenido de la entrada ni crea tu interfaz. Selecciona solo los campos que quieras mostrar, no el payload interno. Purga la cache de Elementor/CDN tras actualizar y evita cachear paginas de reportes o widgets que muestren estos datos privados.

El plugin no cambia colores globales ni carga su hoja de estilos administrativa en la web. Si `body` tiene fondo blanco procedente de `hello-biz/assets/css/theme.css`, revisa el fondo global del tema/Elementor; no se corrige inyectando CSS global desde MostWanted.

Campos disponibles (nombres estables para `get_field()` y plantillas):

| Dato | Nombre ACF |
|---|---|
| ID del reporte | `mw_report_id` |
| Nombre del jugador | `mw_report_nickname` |
| RID | `mw_report_rid` |
| Otros nombres, uno por linea | `mw_report_aliases` |
| Fecha original | `mw_report_created_at` |
| Motivo completo | `mw_report_reason` |
| Infracciones | `mw_report_infractions` |
| Etiquetas / etiquetas con detalles | `mw_report_labels` / `mw_report_label_details` |
| Crews / enlaces | `mw_report_crews` / `mw_report_crew_urls` |
| URLs de avatares | `mw_report_avatar_1` / `mw_report_avatar_2` |
| Cantidad de evidencias | `mw_report_evidence_count` |
| Todas las URLs / nombres, tipos y URLs | `mw_report_evidence_urls` / `mw_report_evidence_details` |
| URLs individuales (primeras cinco) | `mw_report_evidence_1` a `mw_report_evidence_5` |
| Resumen guardado del analisis | `mw_report_analysis` |
| Votos verdadero / falso | `mw_report_votes_up` / `mw_report_votes_down` |
| Motivos publicos de votos falso | `mw_report_vote_feedback` |

No requiere ACF Pro: las listas son texto, no Repeaters ni Galleries. Las listas completas de evidencias conservan tambien las que excedan cinco en reportes historicos. Los campos son una proyeccion ACF registrada sobre el almacenamiento canonico del CPT: funcionan por nombre o clave ACF sin referencias `_mw_report_*` duplicadas, y no crean nuevas filas al leerlos. No constituyen un indice para `meta_query` ni una copia exportable de la base de datos. Cada lectura obtiene los valores actuales de MostWanted; `update_field()` no puede modificarlos. En plantillas PHP propias, escapa los valores segun su contexto.

No se exponen autor, correo, IP, identidad de votantes, payload interno, severidad ni validacion historica inactiva como campos Elementor. Las lecturas ACF y la etiqueta de imagen devuelven vacio sin login WordPress; no se abre REST ni se cambia la politica privada. No coloques estos campos en plantillas publicas ajenas a los reportes ni caches HTML autenticado. La edicion de datos sigue exclusivamente en MostWanted; el diseno de la plantilla se realiza en Elementor.

En la web MostWanted, abre el reporte y pulsa **Editar reporte**. El servidor permite editar a la administradora web ya autorizada en `server/shared/auth/accountAdmin.js` o al ID Discord guardado como propietario; nunca por nombre o por un ID enviado por el navegador. Los reportes sin propietario historico solo los puede editar la administradora.

El formulario permite corregir nickname, crews, infracciones, motivo, conductas y evidencias. Conserva RID, alias, avatares, analisis, fecha, origen, autor y votos. Las crews sin cambios conservan sus URLs; vaciar el campo elimina las crews de ese reporte. Las conductas conservadas mantienen sus detalles. Las imagenes nuevas se suben con el uploader de MostWanted; la biblioteca WordPress ya no se utiliza. Las evidencias historicas se conservan por referencia, incluidos videos y campos adicionales; quitarlas no borra el archivo. Hasta cinco evidencias o el tamano historico, sin truncarlo. Los motivos historicos largos se conservan y los textos corregidos requieren diez caracteres como minimo.

El guardado actualiza el mismo reporte y su titulo, sin aumentar contadores, cambiar la fecha ni reenviar la notificacion de Discord. La validacion termina antes de escribir; una revision obsoleta devuelve 409. Se serializan ediciones de una misma ficha con un bloqueo MySQL `GET_LOCK`, liberado al terminar; si el alojamiento no lo permite, se rechaza el guardado explicitamente. Los votos no forman parte de la revision ni se sobrescriben. Si hay conflicto, cancela la edicion para recargar los datos antes de volver a editar.

### Correcciones e historial del jugador

Al guardar, se consultan todos los reportes actuales asociados al jugador por metadata o relación padre (publicados, privados, borradores, pendientes y programados; no papelera) y se recalculan nombres, crews, URLs, avatares, estado de investigación y número de reportes. No se usa la operación de ingesta: editar no suma reportes ni asigna una fecha nueva de recepción. La identidad principal procede del reporte más reciente; un nombre corregido en un reporte anterior queda como antecedente si hay reportes posteriores.

- Editar el campo **Crews** reemplaza las crews del reporte, no agrega otra observación al historial anterior. Vaciarlo deja una lista vacía explícita.
- Si otro reporte todavía registra la crew, alias o avatar anterior, permanece como antecedente válido. Corrige también ese otro reporte si contiene el mismo error.
- Los reportes antiguos sin crews explícitas ya no heredan las crews agregadas del jugador como si fueran evidencia propia. Las crews en formato de texto antiguo se normalizan.
- El historial agregado sin respaldo en ningún reporte actual se elimina al recalcular. Antes de actualizar, realiza una copia de seguridad si tienes datos importados o agregados manualmente solo al perfil.
- Para reparar una edicion anterior, abre el reporte en MostWanted y guarda de nuevo: la sincronizacion es idempotente y no suma reportes.
- MostWanted combina el archivo de WordPress con **Social Club**. Estos datos externos no se modifican ni se ocultan desde el plugin; una crew que aparezca con esa fuente puede seguir visible.
- No es una herramienta para fusionar o mover reportes entre cuentas. El backend verifica la autoridad para el reporte y el plugin valida su ficha asociada. Las identidades con RIDs incompatibles se bloquean antes del guardado.

Los errores de sincronizacion de base de datos se notifican explicitamente. El guardado no es transaccional: si el reporte se guardo pero la ficha no pudo completarse, cancela, recarga y guarda para reconstruirla desde los datos persistidos. Si hay cache REST/CDN, purgala al desplegar y excluye de cache las rutas privadas de edicion.

Pruebas: `npm run test:report-editing`. Incluyen permisos, contratos web, referencias de evidencias, privacidad, revisiones, bloqueo, sincronizacion de fichas, recuperacion de fallos, campos ACF historicos y etiqueta de imagen Elementor. El test PHP reutiliza tambien las regresiones de los normalizadores historicos; sus formularios antiguos ya no estan conectados al administrador WordPress. Copia la carpeta completa, incluidos `report-edit.php`, `report-readonly.php` y `report-fields.php`, no solo el archivo principal.

## 3) Endpoints

Base: `/wp-json/mostwanted/v1`

Salvo `/health`, todos estos endpoints requieren el secreto backend en `Authorization: Bearer ...`; no llamarlos desde JavaScript del navegador. La sesion Discord se verifica en Node antes de consultar por una identidad o ID. No existe un listado completo equivalente expuesto al navegador. Los endpoints genericos `/wp-json/wp/v2/mw_report` y `/wp-json/wp/v2/mw_player` ya no estan registrados.

- `GET /health`
- `POST /reports` (requiere token)
- `GET /reports` (paginado, sin datos del reportante)
- `GET /reports/<id>`: devuelve `{ok: true, report}` para un reporte publicado. Un ID inexistente, otro tipo de entrada o un reporte no publicado devuelve 404. Usa el mismo formato público y las mismas restricciones de autoría que el listado.
- `POST /reports/<id>/edit` (solo secreto del backend): `{actor: {id, isAdmin}, inspect: true}` consulta permisos y devuelve `{ok, canEdit}`; si esta autorizado, agrega `report` (proyeccion publica) y `revision`. Para guardar, envia `{actor, revision, changes: {nickname, reason, crews, typesOfInfraction, labels, evidence}}`. `labels` contiene nombres; `evidence` contiene `{_original: indice}` para conservar una evidencia o `{url, name, contentType}` para una imagen nueva. Rechaza campos adicionales y no acepta cambiar propietario, RID, votos ni identidad privada. No llamar desde el navegador: el backend deriva `actor` de su sesion y no confia en afirmaciones del cliente. Respuestas sin cache. Los reportes no publicados no se exponen.
- `GET /reports/owned?ownerDiscordId=...&page=1&per_page=20` (requiere el secreto del backend): consulta exacta por `_mw_owner_discord_id`, devuelve `{ok, items, page, perPage, hasMore}` sin metadatos privados y con `Cache-Control: private, no-store`. No llamar desde el navegador ni exponer el secreto. La autoría se recibe únicamente del backend confiable al ingerir reportes autenticados; no se reconstruye a partir de nombres históricos.
- `GET /players`
- `GET /players/ai-summary?rid=...` (o `nickname=...`): exige secreto del backend; devuelve los reportes publicados de la identidad y su revision para sincronizar un resumen. No genera IA.
- `POST /players/ai-summary`: exige secreto del backend; recibe `{nickname, rid, text, sourceRevision}` y persiste el resumen si la revision sigue vigente. Devuelve 409 si cambiaron los reportes; nunca admite una publicacion para una fuente vacia. Solo el texto, fecha y cantidad de reportes se devuelven en las lecturas publicas del jugador, junto a `stale`; no se publican tokens internos ni el secreto.
- `GET /players/lookup?rid=...` o `playerId=...` o `nickname=...`
- `GET /player-insights?username=...&rid=...`: perfil para el panel de antecedentes (`names[{name,time}]`, `avatars`, `crews`, `activeCrew`, `reportCount`, `lastReportAt`). Responde `player: null` si no existe.
- `POST /players/load-default` (requiere token): carga jugador de prueba con datos completos (default: `1R0N_STR1K3R`)

`GET /health` ahora incluye `secretConfigured` para diagnostico rapido.

`GET /players` y `GET /players/lookup` admiten:

- `with_reports=1|0` (default `1`)
- `reports_limit=1..100`

La API devuelve historial enriquecido de reportes por jugador, incluyendo `evidence` y `analysis`. La autoría (`reporter`, `reportedby` y equivalentes), los datos privados de votantes y el payload bruto no se publican. La información original del reportante se conserva en los metadatos privados de WordPress; también se protege la autoría de reportes históricos al serializarlos.

Al actualizar el plugin, purga las respuestas REST cacheadas en WordPress/CDN. La aplicacion consulta por medio de Node y su sesion; actualizar solo el backend Node no protege una version antigua del plugin que aun permita lecturas anonimas.

Validación local sin una instalación de WordPress: `php wordpress/mostwanted-cpt-rest/privacy.test.php` desde la raíz del repositorio.
Historial y actualizaciones parciales: `php wordpress/mostwanted-cpt-rest/profileHistory.test.php`.

Los titulos de `mw_player` y `mw_report` se normalizan como `NICKNAME [RID <valor>]` cuando hay RID.

## 4) Pruebas inmediatas con curl

### Health

```bash
curl -X GET "https://TU-WP/wp-json/mostwanted/v1/health"
```

### Ingesta de reporte

```bash
curl -X POST "https://TU-WP/wp-json/mostwanted/v1/reports" \
  -H "Authorization: Bearer TU_SECRETO" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "PlayerDemo",
    "reason": "Prueba de ingesta",
    "playerId": "PlayerDemo::no-rid",
    "rid": "",
    "typesOfInfraction": ["Toxicidad"],
    "labels": ["Hostil"],
    "labelIds": ["hostil"],
    "report": {"investigation_status": "manual"},
    "evidence": []
  }'
```

### Carga completa de jugador de prueba

```bash
curl -X POST "https://TU-WP/wp-json/mostwanted/v1/players/load-default" \
  -H "Authorization: Bearer TU_SECRETO" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "1R0N_STR1K3R"
  }'
```

Puedes sobreescribir campos enviando cualquier dato del payload en el body.

## 5) Integracion con backend MostWanted

En el backend Node de este repo:

- `WORDPRESS_REPORTS_ENABLED=true`
- `WORDPRESS_API_BASE_URL=https://TU-WP`
- `WORDPRESS_API_SECRET=TU_SECRETO`
- `WORDPRESS_API_TIMEOUT_MS=9000` (opcional)

Con eso, `/api/reports` y `/api/reports/health` se enrutan a WordPress.

## 6) Notas

- No crees los mismos CPT con otro plugin visual usando los mismos slugs (`mw_player`, `mw_report`).
- Si ya existen contenidos previos, manteniendo slugs no deberias perderlos.
