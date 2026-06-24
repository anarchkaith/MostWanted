# Estructura de Reportes - MostWanted

## Nueva Estructura Implementada

A partir de ahora, los reportes se almacenan y envían a la API con la siguiente estructura:

### Ejemplo de Reporte Completo

```json
{
  "nickname": "CHEATER_123",
  "crews": "Elite_Crew",
  "avatar1": "https://example.com/avatar1.png",
  "avatar2": "https://example.com/avatar2.png",
  "rid": 12345,
  "ip": "192.168.1.1",
  "aliases": "ALT_Player, Cheater_Alt",
  "time": 1640000000,
  "typesOfInfraction": ["Modder", "Aimbot"],
  "reason": "El jugador ha sido observado utilizando software de asistencia de puntería (Aimbot) en múltiples sesiones consecutivas con precisión imposible de alcanzar naturalmente.",
  "labels": ["Aimbot", "Godmode", "WallHack"],
  "reportedby": "Player#1234",
  "anonymous": false,
  "source": "mostwanted-web",
  "reporter": {
    "id": "discord-user-id",
    "name": "Reporte Name",
    "tag": "Player#1234",
    "email": "player@example.com"
  },
  "evidence": [
    {
      "url": "https://api.imgbb.com/1/upload/image.png",
      "name": "screenshot_aimbot_001",
      "contentType": "image/png"
    }
  ]
}
```

## Campos de la Estructura

### Información del Jugador Reportado

| Campo | Tipo | Descripción | Requerido |
|-------|------|-------------|-----------|
| `nickname` | String | Nombre exacto del jugador en el servidor | ✅ Sí |
| `crews` | String | Crews/Bandas del jugador | ❌ No |
| `avatar1` | String | URL del avatar 1 | ❌ No |
| `avatar2` | String | URL del avatar 2 | ❌ No |
| `rid` | Number | RID (Rockstar ID) del jugador | ❌ No |
| `ip` | String | Dirección IP del jugador | ❌ No |
| `aliases` | String | Alias alternativos del jugador | ❌ No |
| `time` | Number | Timestamp del incidente (Unix) | ❌ No |

### Información del Reporte

| Campo | Tipo | Descripción | Requerido |
|-------|------|-------------|-----------|
| `typesOfInfraction` | Array[String] | Tipos de infracciones (categorías) | ✅ Sí |
| `reason` | String | Descripción detallada del reporte | ✅ Sí |
| `labels` | Array[String] | Etiquetas/Tags de amenaza | ❌ No |
| `reportedby` | String | Contacto de quién reporta (Discord, etc.) | ❌ No |

### Información del Reportador

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reporter.id` | String | ID único del reportador |
| `reporter.name` | String | Nombre del reportador |
| `reporter.tag` | String | Tag del reportador (Discord#1234) |
| `anonymous` | Boolean | Si el reporte es anónimo |

### Evidencias

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `evidence` | Array[Object] | Arreglo de evidencias subidas |
| `evidence[].url` | String | URL de la evidencia en imgbb |
| `evidence[].name` | String | Nombre del archivo |
| `evidence[].contentType` | String | Tipo MIME (image/png, etc.) |

## Ejemplo de Envío a API

```javascript
// POST /api/reports
{
  "report": {
    "nickname": "CHEATER_123",
    "crews": "",
    "avatar1": "",
    "avatar2": "",
    "rid": null,
    "ip": "",
    "aliases": "",
    "time": null,
    "typesOfInfraction": ["Modder"],
    "reason": "Este es un reporte de prueba",
    "labels": ["Aimbot"],
    "reportedby": "TestUser#0001",
    "anonymous": false,
    "source": "mostwanted-web",
    "reporter": {
      "id": "user-123",
      "name": "TestUser",
      "tag": "TestUser#0001"
    },
    "evidence": [
      {
        "url": "https://api.imgbb.com/1/upload/...",
        "name": "evidence_001.png",
        "contentType": "image/png"
      }
    ]
  }
}
```

## Validación

Todos los campos requeridos están validados en el frontend mediante Yup:

- ✅ `nickname`: Requerido, no puede estar en lista negra
- ✅ `typesOfInfraction`: Mínimo 1 categoría
- ✅ `reason`: Mínimo 10 caracteres
- ⚠️ Campos opcionales: Si están vacíos se envían como strings vacíos o null

## Migración desde la estructura anterior

### Campos renombrados:
- `usuario` → `nickname`
- `categorias` → `typesOfInfraction`
- `motivo` → `reason`
- `etiquetas` → `labels`
- `contacto` → `reportedby`
- `evidencias` → `evidence`

### Nuevos campos agregados:
- `crews`
- `avatar1`
- `avatar2`
- `rid`
- `ip`
- `aliases`
- `time`
