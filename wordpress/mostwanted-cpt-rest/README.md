# MostWanted CPT + REST

Plugin WordPress para registrar CPT de jugadores/reportes y exponer endpoints REST para ingesta de reportes.

## 1) Instalacion rapida

Versión 0.6.3: conserva nombres, crews y URLs de avatares al recibir nuevos reportes. Los datos vacíos no borran avatares conocidos y los nombres ausentes del reporte nuevo mantienen su fecha previa. La consulta por nombres históricos usa los alias registrados y nunca combina RIDs conocidos diferentes. `player-insights` añade `avatarHistory` y `crewHistory`, con fechas de registro cuando se conocen; no convierte los datos reportados en identidad externa verificada. El historial conserva URLs, no copias de imágenes alojadas por terceros.

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

## 2) Endpoints

Base: `/wp-json/mostwanted/v1`

- `GET /health`
- `POST /reports` (requiere token)
- `GET /reports` (paginado, sin datos del reportante)
- `GET /players`
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

## 3) Pruebas inmediatas con curl

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

## 4) Integracion con backend MostWanted

En el backend Node de este repo:

- `WORDPRESS_REPORTS_ENABLED=true`
- `WORDPRESS_API_BASE_URL=https://TU-WP`
- `WORDPRESS_API_SECRET=TU_SECRETO`
- `WORDPRESS_API_TIMEOUT_MS=9000` (opcional)

Con eso, `/api/reports` y `/api/reports/health` se enrutan a WordPress.

## 5) Notas

- No crees los mismos CPT con otro plugin visual usando los mismos slugs (`mw_player`, `mw_report`).
- Si ya existen contenidos previos, manteniendo slugs no deberias perderlos.
