# MostWanted CPT + REST

Plugin WordPress para registrar CPT de jugadores/reportes y exponer endpoints REST para ingesta de reportes.

## 1) Instalacion rapida

Version 0.6.14: agrega consulta privada paginada `/accounts/private`, protegida por el secreto del backend, para el panel web de la administradora autorizada. El backend debe verificar el ID de la sesion antes de consultar; nunca exponer esta ruta mediante un proxy publico. Los reportes sin captura de identidad consultan la cuenta privada asociada al ID del propietario y la identifican como datos actuales, no historicos. Si no existe esa cuenta, hace falta un nuevo acceso del usuario con backend actualizado; instalar el plugin solo no recupera datos que nunca se guardaron.

Version 0.6.13: incorpora **MostWanted > Usuarios MostWanted**, con acceso exclusivo a administradores (`manage_options`). Guarda identidad Discord verificada (ID, usuario, nombre visible, avatar y correo disponible), primer acceso, ultimo login y ultima actividad registrada. Cada reporte muestra un apartado privado con su autor y fecha; la ficha de cuenta enlaza hasta 50 reportes recientes. Las cuentas son privadas, sin REST publico. `POST /accounts/activity` solo acepta el secreto del backend; no admite lecturas publicas. No se guardan tokens ni contrasenas. El frontend informa del almacenamiento antes del acceso.

Requiere desplegar tambien el backend actualizado y configurar su `WORDPRESS_API_SECRET` con el mismo secreto del plugin. La actividad se actualiza al consultar la sesion, como maximo cada quince minutos por sesion: no registra todos los clics ni visitas anonimas. No reconstruye identidades historicas ausentes. Los fallos de sincronizacion quedan en logs y no bloquean el acceso. Todos los administradores y quienes tengan acceso directo a la base de datos pueden consultar estos datos. Los metadatos privados son `_mw_private_identity` y `_mw_owner_discord_id` en reportes; `_mw_identity`, `_mw_discord_id`, `_mw_first_access`, `_mw_last_login`, `_mw_last_access` y `_mw_last_event` en fichas `mw_account`.

Versión 0.6.12: guarda el resumen HEX como metadata `_mw_ai_summary` de la ficha y lo devuelve como `player.aiSummary` con texto, fecha, cantidad de reportes y vigencia (`stale`). El backend Node publica el texto ya generado; WordPress y las vistas previas solo leen el resumen, nunca llaman a la IA. Cambios relevantes en los reportes invalidan la copia; votos y visitas no lo hacen. Hasta que Node sincronice un resumen actualizado se conserva el anterior marcado como desactualizado, sin presentarlo como vigente en las vistas previas.

Conserva la correccion del BOM UTF-8 de 0.6.11 y `GET /reports/<id>` (desde 0.6.10) para obtener un reporte publicado por su ID. No publica borradores, reportes privados ni datos del reportante. Si este endpoint responde `rest_no_route`, actualizar el plugin instalado y purgar la cache REST/CDN; no indica que el reporte solicitado no exista.

Desde 0.6.9, el editor muestra únicamente los campos del formulario de denuncia de MostWanted, en su mismo orden: Jugador, Datos adicionales, Infracciones, Motivo, Evidencias y Conductas. Elimina los controles de análisis, severidad, validación, avatares, anonimato, fecha, origen y estado de investigación; sus valores guardados se conservan internamente. La moderación de votos tiene un panel aparte. Mantiene la sincronización de correcciones con la ficha del jugador.

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

## 2) Editar metadata desde WordPress

1. Abre **MostWanted → Reportes** en el administrador y selecciona **Editar** en un reporte.
2. En **Jugador**, corrige el nombre. **Datos adicionales** muestra el RID de la cuenta asociada (solo lectura), **Crews** como un único campo separado por comas y **Otros nombres conocidos** como información de solo lectura, igual que la web. Las crews sin cambios conservan sus enlaces guardados; un nombre corregido no conserva el enlace de la crew anterior.
3. En **Infracciones**, marca una o varias categorías. En **Conductas**, elige opciones agrupadas por las infracciones seleccionadas, sin identificadores, texto personalizado ni campos de detalle. Al cambiar categorías, se limpian las conductas seleccionadas, igual que en la web. Las opciones históricas desconocidas se muestran solo para conservarlas o quitarlas, sin crear nuevas categorías arbitrarias. El catálogo replica `components/tiposEtiquetas.js`; si cambia en la aplicación, actualiza `mw_report_form_catalog()` conservando el orden de identificadores.
4. **Motivo** tiene contador y límite de 500 caracteres; un texto histórico más largo se conserva sin truncarlo. Los cambios requieren un mínimo de 10 caracteres.
5. **Evidencias** muestra una galería con botones para quitar imágenes y seleccionar/subir otras desde la biblioteca nativa de WordPress. No hay campos para URL, nombre o MIME: los datos se obtienen del archivo seleccionado en el servidor. Admite JPG, PNG, GIF y WEBP de hasta 5 MB, máximo cinco imágenes como la web. Los adjuntos históricos, incluidos otros formatos o listas de más de cinco, se conservan mientras no se quiten; la lista no puede crecer por encima de su tamaño histórico. Quitar una evidencia no borra el archivo original. La biblioteca nativa sustituye al uploader ImgBB de la web; no se envían imágenes a terceros desde el plugin.
6. **Moderación de votos** es un metabox independiente, fuera del formulario de denuncia. Permite corregir los motivos de Falso o marcar **Eliminar voto completo al guardar**. La eliminación quita el motivo y el registro del votante y descuenta un voto «Falso»; editar solo el motivo no cambia contadores. Los motivos históricos sin registro de votante se pueden moderar sin reconstruir identidades. No se reinician los contadores históricos ni los votos «Verdadero».
7. Pulsa **Actualizar** en el editor. El plugin valida todos los campos antes de escribir y sincroniza la metadata con el payload que consume la API. Si hay un error de validación no escribe cambios. Si los votos cambiaron mientras editabas, bloquea el guardado y pide recargar para evitar sobrescribir votos nuevos. Un formulario truncado por `max_input_vars` también se rechaza explícitamente. Los errores de base de datos se muestran y requieren revisar los datos antes de reintentar.

El título sigue siendo independiente de la metadata. El editor de contenido y el panel genérico de campos personalizados se ocultan para los reportes: el motivo que muestra la aplicación se edita en **Motivo**. El plugin no añade controles para análisis, confianza, directivas, corrupción, severidad, validación, avatares, fecha, origen, anonimato o estado de investigación. Estos datos se conservan en el servidor sin reenviarlos en campos ocultos editables. Tampoco se modifica el RID ni los alias desde el formulario simplificado. Esto no borra contenido histórico ni cambia el CPT de jugadores. La autoría y el propietario de Discord siguen privados. Las identidades e IPs de votantes no se muestran; los motivos y contadores sí son públicos. Las cajas adicionales de Yoast, LiteSpeed u otros plugins son independientes de este formulario y no se eliminan.

### Correcciones e historial del jugador

Al guardar, se consultan todos los reportes actuales asociados al jugador por metadata o relación padre (publicados, privados, borradores, pendientes y programados; no papelera) y se recalculan nombres, crews, URLs, avatares, estado de investigación y número de reportes. No se usa la operación de ingesta: editar no suma reportes ni asigna una fecha nueva de recepción. La identidad principal procede del reporte más reciente; un nombre corregido en un reporte anterior queda como antecedente si hay reportes posteriores.

- Editar el campo **Crews** reemplaza las crews del reporte, no agrega otra observación al historial anterior. Vaciarlo deja una lista vacía explícita.
- Si otro reporte todavía registra la crew, alias o avatar anterior, permanece como antecedente válido. Corrige también ese otro reporte si contiene el mismo error.
- Los reportes antiguos sin crews explícitas ya no heredan las crews agregadas del jugador como si fueran evidencia propia. Las crews en formato de texto antiguo se normalizan.
- El historial agregado sin respaldo en ningún reporte actual se elimina al recalcular. Antes de actualizar, realiza una copia de seguridad si tienes datos importados o agregados manualmente solo al perfil.
- Para reparar una edición hecha con 0.6.7, vuelve a abrir el reporte ya corregido y pulsa **Actualizar**: la sincronización es idempotente y limpia las copias anteriores sin volver a sumar datos.
- MostWanted combina el archivo de WordPress con **Social Club**. Estos datos externos no se modifican ni se ocultan desde el plugin; una crew que aparezca con esa fuente puede seguir visible.
- No es una herramienta para fusionar o mover reportes entre cuentas. Necesitas permisos de edición tanto del reporte como del jugador asociado. Las identidades con RIDs incompatibles se bloquean antes del guardado.

Los errores de sincronización de base de datos se notifican explícitamente. El guardado no es transaccional: si el reporte se guardó pero la ficha no pudo completarse, reintentar **Actualizar** reconstruye la ficha desde los datos persistidos. Se requieren nonce válido y formulario completo; los autosaves, revisiones y guardados que no incluyen el panel no alteran estos datos. Si hay caché REST/CDN, púrgala y vuelve a consultar la ficha en MostWanted para ver las correcciones.

Pruebas locales del editor: `php wordpress/mostwanted-cpt-rest/reportAdmin.test.php`. Incluyen reemplazo/eliminación de crews, enlaces corregidos, antecedentes de otros reportes, nombres y avatares, contadores, RIDs incompatibles y reintentos tras fallos de sincronización. Para una actualización manual, copia la carpeta completa del plugin (incluidos `report-admin.php`, `report-admin-form.php`, `report-profile-sync.php`, `report-admin.js` y `report-admin.css`), no solo el archivo principal. Los botones para agregar, quitar y seleccionar archivos requieren JavaScript. Los assets solo se cargan al editar reportes, no en el resto del administrador ni en la aplicación pública.

## 3) Endpoints

Base: `/wp-json/mostwanted/v1`

- `GET /health`
- `POST /reports` (requiere token)
- `GET /reports` (paginado, sin datos del reportante)
- `GET /reports/<id>`: devuelve `{ok: true, report}` para un reporte publicado. Un ID inexistente, otro tipo de entrada o un reporte no publicado devuelve 404. Usa el mismo formato público y las mismas restricciones de autoría que el listado.
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

Al actualizar el plugin, purga las respuestas REST cacheadas en WordPress/CDN. La aplicación consulta estas rutas directamente desde el navegador: actualizar solo el backend Node no protege una versión antigua del plugin.

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
