/**
 * Recorta y sanea strings del payload para respetar limites de Discord.
 */
function safeStr(value, maxLen, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : fallback;
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

/**
 * Normaliza color de embed aceptando decimal o hexadecimal en string.
 */
function normalizeEmbedColor(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value) & 0xffffff;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const normalized = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed.replace('#', '');
    if (/^[0-9a-f]{1,6}$/.test(normalized)) {
      return Number.parseInt(normalized, 16) & 0xffffff;
    }
  }

  return undefined;
}

/**
 * Construye un field de embed con limites validos para Discord.
 */
export function buildDiscordEmbedField(field = {}) {
  const name = safeStr(field?.name, 256);
  const value = safeStr(field?.value, 1024);
  if (!name || !value) {
    return null;
  }

  return {
    name,
    value,
    inline: typeof field?.inline === 'boolean' ? field.inline : false,
  };
}

/**
 * Construye un embed de Discord de forma segura y portable.
 */
export function buildDiscordEmbed(embed = {}) {
  const fields = Array.isArray(embed?.fields)
    ? embed.fields
      .slice(0, 25)
      .map((field) => buildDiscordEmbedField(field))
      .filter(Boolean)
    : undefined;

  const author = embed?.author && typeof embed.author === 'object'
    ? {
      ...(embed.author?.name ? { name: safeStr(embed.author.name, 256) } : {}),
      ...(embed.author?.url ? { url: safeStr(embed.author.url, 2048) } : {}),
      ...(embed.author?.icon_url ? { icon_url: safeStr(embed.author.icon_url, 2048) } : {}),
    }
    : undefined;

  const footer = embed?.footer && typeof embed.footer === 'object'
    ? {
      ...(embed.footer?.text ? { text: safeStr(embed.footer.text, 2048) } : {}),
      ...(embed.footer?.icon_url ? { icon_url: safeStr(embed.footer.icon_url, 2048) } : {}),
    }
    : undefined;

  const thumbnailUrl = safeStr(embed?.thumbnail?.url, 2048);
  const imageUrl = safeStr(embed?.image?.url, 2048);

  return {
    ...(embed?.title ? { title: safeStr(embed.title, 256) } : {}),
    ...(embed?.description ? { description: safeStr(embed.description, 4096) } : {}),
    ...(normalizeEmbedColor(embed?.color) !== undefined ? { color: normalizeEmbedColor(embed?.color) } : {}),
    ...(embed?.url ? { url: safeStr(embed.url, 2048) } : {}),
    ...(embed?.timestamp ? { timestamp: safeStr(embed.timestamp, 128) } : {}),
    ...(author && (author.name || author.url || author.icon_url) ? { author } : {}),
    ...(footer && (footer.text || footer.icon_url) ? { footer } : {}),
    ...(thumbnailUrl ? { thumbnail: { url: thumbnailUrl } } : {}),
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
    ...(fields?.length ? { fields } : {}),
  };
}

/**
 * Construye payload de webhook listo para envio.
 */
export function buildDiscordWebhookPayload(input = {}) {
  const content = safeStr(input?.content, 2000);
  const username = safeStr(input?.username, 80);
  const avatarUrl = safeStr(input?.avatarUrl ?? input?.avatar_url, 2048);

  const embeds = Array.isArray(input?.embeds)
    ? input.embeds
      .slice(0, 10)
      .map((embed) => buildDiscordEmbed(embed))
      .filter((embed) => embed.title || embed.description || embed.fields)
    : undefined;

  return {
    ...(content ? { content } : {}),
    ...(username ? { username } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(Array.isArray(embeds) && embeds.length > 0 ? { embeds } : {}),
    ...(input?.allowedMentions && typeof input.allowedMentions === 'object'
      ? { allowed_mentions: input.allowedMentions }
      : input?.allowed_mentions && typeof input.allowed_mentions === 'object'
        ? { allowed_mentions: input.allowed_mentions }
        : {}),
  };
}

/**
 * Sanea payload de Discord limitando embeds, fields y longitudes maximas.
 * Permite contenido generico (no esta acoplado a reportes).
 */
export function sanitizeDiscordWebhookPayload(body = {}) {
  return buildDiscordWebhookPayload(body);
}

/**
 * Envia un payload ya saneado a Discord webhook.
 */
export async function sendDiscordWebhook({ webhookUrl, payload }) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      ok: false,
      status: response.status,
      error: 'Discord rechazo el webhook.',
      details: detail.slice(0, 200),
    };
  }

  return { ok: true, status: response.status };
}

/**
 * Crea un cliente autocontenido para enviar embeds por Discord webhook.
 * Este modulo se puede copiar a otros proyectos sin dependencias externas.
 */
export function createDiscordWebhookEmbed({ webhookUrl, fetchImpl = globalThis.fetch } = {}) {
  const resolvedWebhookUrl = String(webhookUrl || '').trim();
  if (!resolvedWebhookUrl) {
    throw new Error('webhookUrl es obligatorio para crear el cliente de Discord webhook.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchImpl no esta disponible. Usa Node 18+ o inyecta un fetch custom.');
  }

  return {
    buildEmbed: buildDiscordEmbed,
    buildField: buildDiscordEmbedField,
    buildPayload: buildDiscordWebhookPayload,
    sanitizePayload: sanitizeDiscordWebhookPayload,
    async send(input = {}) {
      const payload = buildDiscordWebhookPayload(input);
      if (!payload.content && (!Array.isArray(payload.embeds) || payload.embeds.length === 0)) {
        return {
          ok: false,
          status: 400,
          error: 'El payload no contiene contenido ni embeds validos.',
        };
      }

      const response = await fetchImpl(resolvedWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return {
          ok: false,
          status: response.status,
          error: 'Discord rechazo el webhook.',
          details: detail.slice(0, 200),
        };
      }

      return { ok: true, status: response.status, payload };
    },
  };
}
