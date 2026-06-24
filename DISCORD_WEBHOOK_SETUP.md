# 📨 Sistema de Envío de Reportes a Discord

## Overview

Los reportes ahora se envían automáticamente al webhook de Discord cuando se crean. El sistema utiliza la nueva estructura de 13 campos y genera embeds visuales profesionales.

## Webhook Configuration

**URL del Webhook:**
```
https://discord.com/api/webhooks/1487549131655483583/zYfylIqIqPAM7Oy9icfNAiZb51kQvVD0oVVhq9HAW1UxheTp6U7RMIsoRBh2FIQQrx2O
```

## Flow del Reporte

```
Formulario Web (React)
        ↓
Envía datos a /api/reports
        ↓
Validación en Backend
        ↓
┌───────────────────────┐
│  Envío Paralelo:      │
│  • Discord Webhook    │
│  • HEXBOT (si config) │
└───────────────────────┘
        ↓
Respuesta al Cliente
```

## Estructura del Embed de Discord

Cada reporte genera un embed con los siguientes elementos:

### Header
- **Username:** ⚠️ H.E.X. SYSTEM
- **Avatar:** Logo de vigilancia
- **Content:** 🚨 **REPORTE DE JUGADOR FRAUDULENTO DETECTADO** 🚨

### Main Embed
- **Author:** ◢◤ H.E.X. VIGILANCE SYSTEM ◢◤
- **Title:** ⛔ TARGET: [Nickname]
- **Description:** Nuevo reporte ingresado en el sistema de vigilancia
- **Color:** Dinámico según infracciones (Rojo por defecto)

### Campos del Embed

| Campo | Contenido | Inline |
|-------|----------|--------|
| 👤 JUGADOR REPORTADO | Nickname, Crews, RID, IP, Aliases | ❌ |
| 📋 INFRACCIONES | Lista de tipos de infracción | ❌ |
| 📝 RAZÓN DEL REPORTE | Descripción del incidente | ❌ |
| 🏷️ ETIQUETAS | Tags/Labels del reporte | ❌ |
| 👤 REPORTADO POR | Nombre/Tag del reportador | ✅ |
| 🕐 HORA INCIDENTE | Timestamp relativo (`<t:...>`) | ✅ |
| 📎 EVIDENCIAS | Links a imágenes/archivos | ❌ |

### Footer
- **Texto:** Sistema de Reportes MostWanted • Kaith's Rebels
- **Icon:** Logo de Kaith

## Colores por Infracción

```javascript
'Modder'       → 0xff0000      // Rojo
'Aimbot'       → 0xff3333      // Rojo intenso
'Griffer'      → 0xffa500      // Naranja
'Team Killer'  → 0xff6600      // Naranja rojo
'Exploiting'   → 0xffff00      // Amarillo
'Toxic'        → 0xffa500      // Naranja
'Hacker'       → 0xff0000      // Rojo
```

## Archivos Relacionados

### Backend
- **`server/reports/discord.js`** - Función `sendReportToDiscordWebhook()`
  - Construye el payload del embed
  - Maneja truncado de texto para Discord
  - Valida URLs de evidencias
  - Envía al webhook

- **`server/index.js`** - Endpoint `/api/reports`
  - POST que recibe reportes
  - Envía a Discord + HEXBOT
  - Retorna resultado de ambos canales

### Test
- **`server/reports/test-discord-webhook.js`** - Script de prueba
  - Envía reporte de ejemplo al webhook
  - Útil para debugging y pruebas

## Respuesta del API

Cuando se envía un reporte, el servidor retorna:

```json
{
  "ok": true,
  "reportId": "report-123",
  "evidenceCount": 1,
  "hexbotDelivery": {
    "ok": true,
    "reportId": "hex-123",
    "evidenceCount": 1
  },
  "discordDelivery": {
    "ok": true,
    "message": "Reporte enviado a Discord exitosamente"
  }
}
```

## Ejemplo de Payload Enviado a Discord

```json
{
  "username": "⚠️ H.E.X. SYSTEM",
  "avatar_url": "https://i.pinimg.com/736x/...",
  "content": "🚨 **REPORTE DE JUGADOR FRAUDULENTO DETECTADO** 🚨",
  "embeds": [
    {
      "author": {
        "name": "◢◤ H.E.X. VIGILANCE SYSTEM ◢◤",
        "icon_url": "https://i.ibb.co/zT7r8F2P/X.png"
      },
      "title": "⛔ TARGET: CHEATER_123",
      "description": "**Nuevo reporte ingresado en el sistema de vigilancia**",
      "color": 16711739,
      "fields": [
        {
          "name": "👤 JUGADOR REPORTADO",
          "value": "**Nickname:** `CHEATER_123`\n**Crews:** `Los Diablos`\n...",
          "inline": false
        }
        // ... más campos
      ],
      "thumbnail": {
        "url": "https://api.imgbb.com/avatar/xxxxx"
      },
      "footer": {
        "text": "Sistema de Reportes MostWanted • Kaith's Rebels",
        "icon_url": "https://i.ibb.co/v4KTFw0q/Vector.png"
      },
      "timestamp": "2026-05-06T10:30:00Z"
    }
  ]
}
```

## Limitaciones de Discord

- **Descripción:** máx 4096 caracteres
- **Campos:** máx 25 por embed
- **Valor de campo:** máx 1024 caracteres (se trunca automáticamente)
- **Embeds:** máx 10 por mensaje
- **Total payload:** máx 6000 caracteres

El código maneja estos límites automáticamente.

## Error Handling

Si falla el envío a Discord:
```json
{
  "ok": false,
  "message": "Error al enviar a Discord: ...",
  "error": "Discord webhook returned 401"
}
```

El reporte se acepta de todas formas, pero se registra el error para debugging.

## Próximos Pasos

1. ✅ Webhook configurado y funcionando
2. ✅ Estructura de embeds implementada
3. ⏳ Testear envío con reportes reales
4. ⏳ Implementar Discord bot commands (opcional)
5. ⏳ Agregar reacciones/botones en Discord (opcional)

## Testing

Para probar el webhook manualmente:

```bash
node server/reports/test-discord-webhook.js
```

Esto enviará un reporte de ejemplo al canal de Discord.
