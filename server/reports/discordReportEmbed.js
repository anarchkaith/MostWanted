import { TIPOS_ETIQUETAS } from '../shared/constants/tiposEtiquetas.js';

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

function extractUrlFromText(value) {
  const text = toTrimmedString(value);
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : '';
}

function normalizeCrewEntry(crew) {
  if (!crew) return null;

  if (typeof crew === 'string') {
    const raw = crew.trim();
    if (!raw) return null;
    const url = extractUrlFromText(raw);
    const name = raw.replace(/https?:\/\/[^\s)]+/ig, '').trim() || raw;
    return { name, url };
  }

  if (typeof crew === 'object') {
    const name = toDisplayText(crew?.nombre) || toDisplayText(crew?.name) || toDisplayText(crew?.raw) || '';
    if (!name) return null;
    const url = toTrimmedString(crew?.url) || extractUrlFromText(crew?.raw);
    return { name, url };
  }

  return null;
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
  const items = evidence.filter((item) => item?.url && !isImageContentType(item?.contentType));
  if (items.length === 0) return 'Sin evidencias de video';
  return truncateText(items.slice(0, 5).map((item) => item.name || item.url).join(', '), 1024);
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
  const thumbnailUrl = toTrimmedString(report.avatar1) || toTrimmedString(report.avatar2) || imageEvidence[0] || undefined;

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
        url: `https://socialclub.rockstargames.com/members/${report.nickname}/`,
        color: embedColor,
        fields: [
          { name: 'RID', value: `||${truncateText(String(report.rid || 'N/A'), 1018)}||`, inline: false },
          { name: '🗒 Motivo', value: truncateText(reasonText, 1024), inline: false },
          { name: '🎭 Aliases', value: truncateText(aliases.join(', ') || 'N/A', 1024), inline: true },
          { name: '🕵️ Estado', value: truncateText(getInvestigationStatusLabel(report), 1024), inline: true },
          { name: '☣ Riesgo', value: String(report.riskScore ?? 'N/A'), inline: true },
          { name: '👥 Crews', value: buildCrewFieldValue(crews), inline: false },
          { name: '🏷 Etiquetas', value: truncateText(labels.join(', ') || '#Sin etiquetas de amenaza', 1024), inline: false },
          { name: '🚥 Tipos de infraccion', value: truncateText(infractions.join(', ') || 'NO ESPECIFICADO', 1024), inline: false },
          { name: '📼 Evidencias de Video', value: buildVideoEvidenceField(evidence), inline: false },
        ],
        ...(thumbnailUrl ? { thumbnail: { url: thumbnailUrl } } : {}),
        footer: {
          text: 'MostWanted • Sistema de reportes de bad players',
          icon_url: 'https://i.ibb.co/fV98zMbz/HEX-LOGO-RED.png',
        },
        timestamp: new Date(normalizeTimestamp(report.time)).toISOString(),
      },
    ],
    allowed_mentions: { parse: [] },
  };

  for (const imageUrl of imageEvidence.slice(0, 5)) {
    payload.embeds.push({
      url: 'https://mostwanted.kaithsrebels.com',
      color: embedColor,
      image: { url: imageUrl },
    });
  }

  return payload;
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

  const payload = buildDiscordReportPayload(source);

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
