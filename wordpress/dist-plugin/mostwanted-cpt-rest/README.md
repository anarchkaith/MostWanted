# MostWanted CPT + REST

Plugin WordPress para registrar CPT de jugadores/reportes y exponer endpoints REST para ingesta de reportes.

## 1) Instalacion rapida

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
- `GET /players`
- `GET /players/lookup?rid=...` o `playerId=...` o `nickname=...`
- `POST /players/load-default` (requiere token): carga jugador de prueba con datos completos (default: `1R0N_STR1K3R`)

`GET /health` ahora incluye `secretConfigured` para diagnostico rapido.

`GET /players` y `GET /players/lookup` admiten:

- `with_reports=1|0` (default `1`)
- `reports_limit=1..100`

La API ahora devuelve historial enriquecido de reportes por jugador, incluyendo `reporter`, `evidence`, `analysis` y `rawPayload`.

Contrato actualizado de crews:

- `crews` ahora es un array de objetos con forma `{ "name": string, "url": string }`.
- Las respuestas del plugin ya no exponen `crewsData` ni `crewsAssignedData`.
- El plugin mantiene compatibilidad de ingesta para payloads legacy que aun envian `crewsData`.

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
