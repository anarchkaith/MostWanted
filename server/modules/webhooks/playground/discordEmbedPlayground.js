import { createDiscordWebhookEmbed } from '../services/discordWebhook.service.js';
import { fileURLToPath } from 'node:url';

/**
 * Convierte un objeto plano de datos en fields de embed.
 */
function buildFieldsFromData(details = {}, inline = true) {
  if (!details || typeof details !== 'object') {
    return [];
  }

  return Object.entries(details)
    .filter(([name, value]) => name && value !== undefined && value !== null && value !== '')
    .map(([name, value]) => ({
      name,
      value: String(value),
      inline,
    }));
}

/**
 * Construye el payload del embed desde parametros de entrada.
 * Este es el archivo para disenar tu estructura y mapear tus datos.
 */
export function buildCustomEmbedPayload(data = {}) {
  const fields = Array.isArray(data.fields)
    ? data.fields
    : buildFieldsFromData(data.details || {}, Boolean(data.inlineDetails));

  return {
    content: data.content || '',
    username: data.username || 'MostWanted Embed Designer',
    avatar_url: data.avatarUrl || data.avatar_url || undefined,
    allowed_mentions: data.allowedMentions || data.allowed_mentions || { parse: [] },
    embeds: [
      {
        title: data.title || 'Embed de prueba',
        description: data.description || 'Disena este bloque y pasa los datos por parametro.',
        color: data.color || '#e74c3c',
        url: data.url || undefined,
        timestamp: data.timestamp || new Date().toISOString(),
        author: data.author || undefined,
        thumbnail: data.thumbnailUrl ? { url: data.thumbnailUrl } : data.thumbnail || undefined,
        image: data.imageUrl ? { url: data.imageUrl } : data.image || undefined,
        footer: data.footer || undefined,
        fields,
      },
    ],
  };
}

/**
 * Envia un embed usando datos por parametro.
 */
export async function sendCustomEmbed({ webhookUrl, data = {} }) {
  const client = createDiscordWebhookEmbed({ webhookUrl });
  const payload = buildCustomEmbedPayload(data);
  return client.send(payload);
}

/**
 * Uso CLI:
 * node server/modules/webhooks/playground/discordEmbedPlayground.js '<jsonData>' [webhookUrl]
 *
 * Ejemplo:
 * node server/modules/webhooks/playground/discordEmbedPlayground.js "{\"title\":\"Alerta\",\"details\":{\"Jugador\":\"KaithRider_01\",\"RID\":\"RID-90821\"}}" https://discord.com/api/webhooks/...
 */
async function runCli() {
  const rawData = String(process.argv[2] || '{}').trim();
  const webhookUrl = String(process.argv[3] || process.env.DISCORD_WEBHOOK_URL || '').trim();

  if (!webhookUrl) {
    console.error('Falta webhookUrl. Pasa el URL por argumento o define DISCORD_WEBHOOK_URL.');
    process.exit(1);
  }

  let data;
  try {
    if (rawData.startsWith('b64:')) {
      const encoded = rawData.slice(4);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      data = JSON.parse(decoded);
    } else {
      data = JSON.parse(rawData);
    }
  } catch {
    console.error('El parametro de datos no es JSON valido. Puedes usar tambien b64:<jsonEnBase64>.');
    process.exit(1);
  }

  const result = await sendCustomEmbed({ webhookUrl, data });
  if (!result.ok) {
    console.error('Fallo al enviar webhook:', result);
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, status: result.status }, null, 2));
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && currentFilePath === process.argv[1]) {
  runCli().catch((error) => {
    console.error('Error ejecutando playground de embeds:', error?.message || error);
    process.exit(1);
  });
}
