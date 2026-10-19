import { TIPOS_ETIQUETAS } from '../shared/constants/tiposEtiquetas.js';
import { buildCrewLink } from './crewLink.js';

const MAX_DISCORD_EMBEDS_PER_MESSAGE = 10;

const INFRACTION_NAME_BY_KEY = TIPOS_ETIQUETAS.reduce((acc, item) => {
  const key = String(item?.key || '').trim().toUpperCase();
  const name = String(item?.nombre || '').trim();
  if (key && name) {
    acc.set(key, name);
  }
  return acc;
}, new Map());

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toDisplayText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value || typeof value !== 'object') return '';

  const keys = ['nombre', 'name', 'label', 'value', 'text', 'title', 'content', 'reason', 'alias'];
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
  }

  return '';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeTextArray(value) {
  return toArray(value).map((item) => toDisplayText(item)).filter(Boolean);
}

function normalizeInfractionArray(value) {
  return toArray(value)
    .map((item) => {
      const text = toDisplayText(item);
      if (!text) return '';
      return INFRACTION_NAME_BY_KEY.get(text.toUpperCase()) || text;
    })
    .filter(Boolean);
}

function truncateText(text, maxLength = 1024) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Date.now();
  return numeric > 1e12 ? numeric : numeric * 1000;
}

function getInvestigationStatusLabel(report = {}) {
  const status = String(report?.investigation_status || '').trim().toLowerCase();

  if (status === 'resolved') return 'Encontrado';
  if (status === 'not_found') return 'No encontrado';
  if (status === 'pending') return 'Pendiente';
  if (status === 'not_attempted') return 'No iniciado';
  return 'En investigación';
}

function getColorByInfraction(infractions = []) {
  const severityMap = {
    modder: 0xff0000,
    aimbot: 0xff3333,
    griffer: 0x39d353,
    'team killer': 0xff6600,
    exploiting: 0xffff00,
    toxic: 0x39d353,
    hacker: 0xff0000,
    'acoso-raid': 0xff6600,
  };

  for (const infraction of infractions) {
    const key = String(infraction || '').trim().toLowerCase();
    if (severityMap[key]) return severityMap[key];
  }

  return 0xff3333;
}

function isImageContentType(contentType) {
  return String(contentType || '').toLowerCase().startsWith('image/');
}

function isVideoContentType(contentType) {
  return String(contentType || '').toLowerCase().startsWith('video/');
}

function normalizeCrewEntry(crew) {
  const raw = typeof crew === 'string'
    ? crew.trim()
    : toDisplayText(crew?.nombre) || toDisplayText(crew?.name) || toDisplayText(crew?.raw) || toDisplayText(crew?.url);
  const link = buildCrewLink(raw);
  if (!link) return null;
  return { name: link.name.replace(/[[\]]/g, '').trim(), url: link.url };
}

function buildCrewFieldValue(crews = []) {
  const unique = new Set();
  const lines = crews
    .map((crew) => normalizeCrewEntry(crew))
    .filter(Boolean)
    .filter((crew) => {
      const key = crew.name.toLowerCase();
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    })
    .map((crew) => (crew.url ? `[${crew.name}](${crew.url})` : crew.name));

  return lines.length > 0 ? truncateText(lines.join('\n'), 1024) : 'N/A';
}

function buildVideoEvidenceField(evidence = []) {
  const items = evidence.filter((item) => item?.url && isVideoContentType(item?.contentType));
  if (items.length === 0) return '';
  return truncateText(items.slice(0, 5).map((item) => `[${item.name || 'Video'}](${item.url})`).join('\n'), 1024);
}

function buildReasonQuote(text, maxLength = 1024) {
  return truncateText(`>>> ${text}`, maxLength);
}

function getWordpressReportFromPlayer(player = {}) {
  const reports = Array.isArray(player?.reports) ? player.reports : [];
  if (reports.length === 0) return null;

  return [...reports].sort((left, right) => {
    const leftTime = Date.parse(String(left?.createdAt || '')) || 0;
    const rightTime = Date.parse(String(right?.createdAt || '')) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return Number(right?.id || 0) - Number(left?.id || 0);
  })[0];
}

/**
 * Obtiene el ultimo reporte del jugador devuelto por WordPress y lo normaliza
 * al formato que usa el embed de Discord.
 */
export function buildDiscordSourceFromWordpressPlayer(player = null) {
  const reportFromWordpress = getWordpressReportFromPlayer(player);

  if (!player || !reportFromWordpress) {
    throw new Error('WordPress no devolvio un reporte util para construir el embed de Discord.');
  }

  const report = {
    ...reportFromWordpress,
    nickname: toTrimmedString(reportFromWordpress?.nickname) || toTrimmedString(player?.nickname),
    rid: toTrimmedString(reportFromWordpress?.rid) || toTrimmedString(player?.rid),
    aliases: Array.isArray(reportFromWordpress?.aliases) && reportFromWordpress.aliases.length > 0
      ? reportFromWordpress.aliases
      : (Array.isArray(player?.aliases) ? player.aliases : []),
    crews: Array.isArray(reportFromWordpress?.crews) && reportFromWordpress.crews.length > 0
      ? reportFromWordpress.crews
      : (Array.isArray(player?.crews) ? player.crews : []),
    avatar1: toTrimmedString(reportFromWordpress?.avatar1) || toTrimmedString(player?.avatar1),
    avatar2: toTrimmedString(reportFromWordpress?.avatar2) || toTrimmedString(player?.avatar2),
    investigation_status: toTrimmedString(reportFromWordpress?.investigation_status)
      || toTrimmedString(reportFromWordpress?.investigationStatus)
      || toTrimmedString(player?.investigationStatus),
    reason: toTrimmedString(reportFromWordpress?.reason) || toTrimmedString(reportFromWordpress?.content),
    time: reportFromWordpress?.time || reportFromWordpress?.createdAt || Date.now(),
    typesOfInfraction: Array.isArray(reportFromWordpress?.typesOfInfraction) && reportFromWordpress.typesOfInfraction.length > 0
      ? reportFromWordpress.typesOfInfraction
      : (Array.isArray(reportFromWordpress?.categories) ? reportFromWordpress.categories : []),
    labels: Array.isArray(reportFromWordpress?.labels) ? reportFromWordpress.labels : [],
  };

  const reporter = reportFromWordpress?.reporter && typeof reportFromWordpress.reporter === 'object'
    ? reportFromWordpress.reporter
    : { name: 'Anónimo' };

  const evidence = Array.isArray(reportFromWordpress?.evidence) ? reportFromWordpress.evidence : [];

  return { report, reporter, evidence };
}

/**
 * Construye el payload del webhook de Discord para un reporte.
 */
export function buildDiscordReportPayload({ report = {}, reporter = {}, evidence = [] }) {
  const infractions = normalizeInfractionArray(report.typesOfInfraction || report.categories || []);
  const labels = normalizeTextArray(report.labels);
  const aliases = toArray(report.aliases).map((item) => toDisplayText(item)).filter(Boolean);
  const crews = Array.isArray(report.crews) ? report.crews : toArray(report.crews);
  const reasonText = toTrimmedString(report.reason) || toTrimmedString(report.content) || toTrimmedString(report.motivo) || 'Sin motivo especificado';
  const imageEvidence = evidence
    .filter((item) => item?.url && isImageContentType(item?.contentType))
    .map((item) => item.url)
    .filter(Boolean);

  const embedColor = getColorByInfraction(infractions);
  const avatarUrls = [report.avatar1, report.avatar2]
    .map((url) => toTrimmedString(url))
    .filter((url) => /^https?:\/\//i.test(url));
  const imageUrls = [...avatarUrls, ...imageEvidence];
  const [mainImageUrl, ...galleryImageUrls] = imageUrls;
  const profileUrl = `https://socialclub.rockstargames.com/members/${report.nickname}/`;

  const fields = [
    { name: 'RID', value: `||${truncateText(String(report.rid || 'N/A'), 1018)}||`, inline: false },
    { name: '🗒 Motivo', value: buildReasonQuote(reasonText), inline: false },
  ];
  if (aliases.length > 0) {
    fields.push({ name: '🎭 Aliases', value: truncateText(aliases.join(', '), 1024), inline: true });
  }
  fields.push(
    { name: '🕵️ Estado', value: truncateText(getInvestigationStatusLabel(report), 1024), inline: true },
    { name: '👥 Crews', value: buildCrewFieldValue(crews), inline: false },
    { name: '🏷 Etiquetas', value: truncateText(`-# ${labels.join(', ') || '#Sin etiquetas de amenaza'}`, 1024), inline: false },
    { name: '🚥 Tipos de infraccion', value: truncateText(infractions.join(', ') || 'NO ESPECIFICADO', 1024), inline: false },
  );
  const videoValue = buildVideoEvidenceField(evidence);
  if (videoValue) {
    fields.push({ name: '📼 Evidencias de Video', value: videoValue, inline: false });
  }

  // Discord agrupa en una galería los embeds de un mismo mensaje que comparten la misma url.
  const galleryEmbeds = galleryImageUrls
    .slice(0, MAX_DISCORD_EMBEDS_PER_MESSAGE - 1)
    .map((url) => ({ url: profileUrl, color: embedColor, image: { url } }));

  const payload = {
    content: '',
    username: 'H.E.X. | MostWanted',
    avatar_url: 'https://i.ibb.co/fV98zMbz/HEX-LOGO-RED.png',
    embeds: [
      {
        author: {
          name: toTrimmedString(reporter.name) || 'Anónimo',
          url: 'https://mostwanted.kaithsrebels.com',
          icon_url: 'https://i.ibb.co/sJDdYnPc/Vector-Padding.png',
        },
        title: '[ SUJETO MARCADO PARA ELIMINACIÓN ]',
        description: `\`\`\`${truncateText(report.nickname, 300)}\`\`\``,
        url: profileUrl,
        color: embedColor,
        fields,
        ...(mainImageUrl ? { image: { url: mainImageUrl } } : {}),
        footer: {
          text: 'MostWanted • Sistema de reportes de bad players',
          icon_url: 'https://i.ibb.co/fV98zMbz/HEX-LOGO-RED.png',
        },
        timestamp: new Date(normalizeTimestamp(report.time)).toISOString(),
      },
      ...galleryEmbeds,
    ],
    allowed_mentions: { parse: [] },
  };

  return payload;
}

/**
 * Envía un reporte (report, reporter, evidence) al webhook de DISCORD_WEBHOOK_URL.
 */
export async function sendReportToDiscordWebhook(submission = {}, { fetchImpl = globalThis.fetch } = {}) {
  const webhookUrl = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    return {
      ok: false,
      errorCode: 'integration_not_configured',
      message: 'Webhook de Discord no configurado (DISCORD_WEBHOOK_URL).',
    };
  }

  if (!submission.report?.nickname) {
    throw new Error('Reporte inválido: falta nickname');
  }

  return postDiscordPayload({ webhookUrl, payload: buildDiscordReportPayload(submission), fetchImpl });
}

/**
 * Envía a Discord el reporte guardado en WordPress.
 * Devuelve el mismo formato de discordDelivery que usaba el frontend.
 */
export async function sendDiscordReportForWordpressPlayer({
  webhookUrl,
  player = null,
  fetchImpl = globalThis.fetch,
}) {
  let source;
  try {
    source = buildDiscordSourceFromWordpressPlayer(player);
  } catch (error) {
    return { ok: false, message: error.message };
  }

  return postDiscordPayload({ webhookUrl, payload: buildDiscordReportPayload(source), fetchImpl });
}

async function postDiscordPayload({ webhookUrl, payload, fetchImpl }) {
  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        message: errorText || `Discord webhook devolvio ${response.status}.`,
      };
    }

    return {
      ok: true,
      status: response.status,
      message: 'Reporte enviado a Discord exitosamente.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo confirmar el envio a Discord.',
    };
  }
}
