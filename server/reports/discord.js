import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS_ETIQUETAS } from '../shared/constants/tiposEtiquetas.js';

const BLOCKED_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487549131655483583/zYfylIqIqPAM7Oy9icfNAiZb51kQvVD0oVVhq9HAW1UxheTp6U7RMIsoRBh2FIQQrx2O';

const DISCORD_WEBHOOK_NAME = '[SE BUSCA] :: Nueva amenaza detectada...';
const DISCORD_WEBHOOK_AVATAR = 'https://i.pinimg.com/736x/2b/6e/f6/2b6ef68a43b6b4363dcea23ee5c78421.jpg';
const HEX_AUTHOR_ICON = 'https://i.ibb.co/zT7r8F2P/X.png';
const HEX_FOOTER_ICON = 'https://i.ibb.co/v4KTFw0q/Vector.png';

const INFRACTION_NAME_BY_KEY = TIPOS_ETIQUETAS.reduce((acc, item) => {
  const key = String(item?.key || '').trim().toUpperCase();
  const name = String(item?.nombre || '').trim();
  if (key && name) {
    acc.set(key, name);
  }
  return acc;
}, new Map());

function resolveDiscordWebhookUrl() {
  const configuredUrl = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
  const fallbackUrl = configuredUrl || readDiscordWebhookFromEnvFile();

  if (!fallbackUrl) {
    return { ok: false, reason: 'Webhook de Discord no configurado (DISCORD_WEBHOOK_URL).' };
  }

  if (fallbackUrl === BLOCKED_DISCORD_WEBHOOK_URL) {
    return { ok: false, reason: 'El webhook anterior fue bloqueado y ya no debe usarse.' };
  }

  return { ok: true, url: fallbackUrl };
}

function readDiscordWebhookFromEnvFile() {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    const rootDir = path.resolve(currentDir, '..', '..');
    const envPath = path.join(rootDir, '.env');

    if (!fs.existsSync(envPath)) {
      return '';
    }

    const envRaw = fs.readFileSync(envPath, 'utf8');
    const line = envRaw
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith('DISCORD_WEBHOOK_URL='));

    if (!line) {
      return '';
    }

    return line.replace(/^DISCORD_WEBHOOK_URL=/, '').trim();
  } catch {
    return '';
  }
}

function truncateText(text, maxLength = 1024) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toUpperText(value, fallback = 'NO IDENTIFICADO') {
  const text = String(value || '').trim();
  return (text || fallback).toUpperCase();
}

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function toDisplayText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value || typeof value !== 'object') return '';

  const keys = ['nombre', 'name', 'label', 'value', 'text', 'title', 'content', 'reason'];
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
  }

  return '';
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

function isImageContentType(contentType) {
  const value = String(contentType || '').toLowerCase();
  return value.startsWith('image/');
}

function isPlaceholderImageHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  return host === 'example.com'
    || host === 'www.example.com'
    || host === 'example.org'
    || host === 'www.example.org'
    || host === 'localhost'
    || host === '127.0.0.1';
}

function normalizeRealImageUrl(value) {
  const raw = toTrimmedString(value);
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return '';
    }

    if (isPlaceholderImageHost(parsed.hostname)) {
      return '';
    }

    if (parsed.pathname.toLowerCase().includes('fake')) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeTimestamp(value) {
  if (!Number.isFinite(value)) return Date.now();
  return value > 1e12 ? value : value * 1000;
}

function formatIncidentDate(value) {
  const date = new Date(normalizeTimestamp(value));
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function buildCorruptionLevel(report = {}) {
  const infractionWeights = {
    modder: 42,
    aimbot: 36,
    hacker: 40,
    exploiting: 22,
    griffer: 18,
    'team killer': 20,
    toxic: 16,
  };

  const infractions = Array.isArray(report.typesOfInfraction) ? report.typesOfInfraction : [];
  const labels = Array.isArray(report.labels) ? report.labels : [];
  const highestInfractionWeight = infractions.reduce((highest, infraction) => {
    const weight = infractionWeights[String(infraction || '').trim().toLowerCase()] || 12;
    return Math.max(highest, weight);
  }, 10);

  const percent = clamp(highestInfractionWeight + labels.length * 6, 10, 100);
  const filled = clamp(Math.round(percent / 10), 1, 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${percent}%`;
}

function buildInfractionField(report = {}) {
  const infractions = Array.isArray(report.typesOfInfraction) ? report.typesOfInfraction : [];
  if (infractions.length === 0) {
    return 'NO ESPECIFICADO';
  }

  return truncateText(infractions.join(' / ').toUpperCase(), 1024);
}

function buildThreatCodes(report = {}) {
  const labels = Array.isArray(report.labels) ? report.labels : [];
  const labelIds = Array.isArray(report.labelIds) ? report.labelIds : [];

  if (labels.length === 0 && labelIds.length === 0) {
    return '#Sin etiquetas de amenaza';
  }

  const labelCodes = [
    ...labels.map((label) => `#${label}`),
    ...labelIds.map((id) => `#ID-${id}`),
  ];

  return truncateText(labelCodes.join('\n'), 1024);
}

function buildTargetDetails(report = {}) {
  const details = [];
  const normalizedCrewEntries = Array.isArray(report?.crewsData) ? report.crewsData : [];
  const assignedCrews = [report.crew1, report.crew2, report.crew3, report.crew4]
    .map((item) => toTrimmedString(item))
    .filter(Boolean);

  if (report.crewCurrent) details.push(`Crew actual: ${report.crewCurrent}`);
  if (normalizedCrewEntries.length > 0) {
    for (const entry of normalizedCrewEntries.slice(0, 5)) {
      const line = [
        entry?.name || entry?.raw || '',
        entry?.tag ? `[${entry.tag}]` : '',
        entry?.url || '',
      ]
        .filter(Boolean)
        .join(' | ');

      if (line) {
        details.push(line);
      }
    }
  }
  if (report.crews) details.push(`Crew: ${report.crews}`);
  if (report.rid) details.push(`RID: ${report.rid}`);
  if (report.ip) details.push(`IP: ${report.ip}`);
  if (report.aliases) details.push(`Aliases: ${report.aliases}`);

  return truncateText(details.join('\n'), 1024);
}

function buildCrewFieldValue(crews = []) {
  if (crews.length === 0) {
    return 'N/A';
  }

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

  if (lines.length === 0) {
    return 'N/A';
  }

  return truncateText(lines.join('\n'), 1024);
}

function buildFooterText(report = {}, reporter = {}) {
  const actor = toUpperText(reporter.name, 'Anónimo');
  return `LOG_BY: ${actor} // NO MERCY FOR TOXICS - ${formatIncidentDate(report.time)}`;
}

function buildReportNotesFieldValue(report = {}) {
  const notes = Array.isArray(report.notes) ? report.notes : [];
  if (notes.length === 0) {
    return 'Sin notas adicionales';
  }

  const lines = notes.slice(0, 3).map((note) => {
    const author = toTrimmedString(note?.name) || 'Anónimo';
    const text = toTrimmedString(note?.text) || 'Sin contenido';
    const timestamp = note?.timestamp
      ? new Date(note.timestamp).toLocaleString('es-ES')
      : formatIncidentDate(report.time);
    return `${author} (${timestamp})\n${text}`;
  });

  return truncateText(`\`\`\`${lines.join('\n\n')}\`\`\``, 1024);
}

function buildVideoEvidenceField(evidence = []) {
  const videoItems = evidence
    .filter((item) => item?.url && !isImageContentType(item?.contentType));

  if (videoItems.length === 0) {
    return 'Sin evidencias de video';
  }

  return truncateText(videoItems
    .slice(0, 5)
    .map((item) => item.name || item.url)
    .join(', '), 1024);
}

function getInvestigationStatusLabel(report = {}) {
  const status = String(report?.investigation_status || '').trim().toLowerCase();

  if (status === 'resolved') return 'Encontrado';
  if (status === 'not_found') return 'No encontrado';
  if (status === 'pending') return 'Pendiente';
  if (status === 'not_attempted') return 'No iniciado';
  return 'En investigación';
}

function resolveAvatarUrls(report = {}) {
  const avatarsFromArray = toArray(report.avatars);
  const avatarsFromLegacy = [report.avatar1, report.avatar2].map(toTrimmedString).filter(Boolean);
  const merged = [...avatarsFromArray, ...avatarsFromLegacy]
    .map((url) => normalizeRealImageUrl(url))
    .filter(Boolean);
  return Array.from(new Set(merged));
}

function getColorByInfraction(infractions = []) {
  const severityMap = {
    'Modder': 0xff0000,      // Rojo
    'Aimbot': 0xff3333,      // Rojo intenso
    'Griffer': 0x39d353,     // Verde
    'Team Killer': 0xff6600, // Naranja rojo
    'Exploiting': 0xffff00,  // Amarillo
    'Toxic': 0x39d353,       // Verde
    'Hacker': 0xff0000,      // Rojo
  };

  for (const infraction of infractions) {
    if (severityMap[infraction]) {
      return severityMap[infraction];
    }
  }

  return 0xff3333; // Rojo por defecto
}

export async function sendReportToDiscordWebhook(submission = {}) {
  const {
    report = {},
    reporter = {},
    evidence = [],
  } = submission;
  const webhookUrlResult = resolveDiscordWebhookUrl();

  if (!webhookUrlResult.ok) {
    return {
      ok: false,
      errorCode: 'integration_not_configured',
      message: webhookUrlResult.reason,
    };
  }

  if (!report.nickname) {
    throw new Error('Reporte inválido: falta nickname');
  }

  const infractions = normalizeInfractionArray(report.typesOfInfraction);
  const labels = normalizeTextArray(report.labels);
  const reasonText = toTrimmedString(report.reason)
    || toTrimmedString(report.content)
    || toTrimmedString(report.motivo)
    || 'Sin motivo especificado';
  const embedColor = getColorByInfraction(infractions);
  const aliases = toArray(report.aliases);
  const crews = report.crews || [];
  const avatars = resolveAvatarUrls(report);
  const imageEvidence = evidence
    .filter((item) => item?.url && isImageContentType(item?.contentType))
    .map((item) => normalizeRealImageUrl(item.url))
    .filter(Boolean);

  const thumbnailUrl = avatars[0] || imageEvidence[0] || undefined;

  const fields = [
    {
      name: 'RID',
      value: `||${truncateText(String(report.rid || 'N/A'), 1018)}||`,
      inline: false,
    },
    {
      name: '🎭 Aliases',
      value: truncateText(aliases.join(', ') || 'N/A', 1024),
      inline: true,
    },
    {
      name: '🕵️ Estado',
      value: truncateText(getInvestigationStatusLabel(report), 1024),
      inline: true,
    },
    {
      name: '☣ Riesgo',
      value: String(report.riskScore ?? 'N/A'),
      inline: true,
    },
    {
      name: '👥 Crews',
      value: buildCrewFieldValue(crews),
      inline: false,
    },
    {
      name: '🏷 Etiquetas',
      value: truncateText(labels.join(', ') || '#Sin etiquetas de amenaza', 1024),
      inline: false,
    },
    {
      name: '🚥 Tipos de infraccion',
      value: truncateText(infractions.join(', ') || 'NO ESPECIFICADO', 1024),
      inline: false,
    },
    {
      name: '📼 Evidencias de Video',
      value: buildVideoEvidenceField(evidence),
      inline: false,
    },
    {
      name: '💬 Notas del reporte',
      value: buildReportNotesFieldValue(report),
      inline: false,
    },
  ];

  const payload = {
    content: '',
    username: 'H.E.X. | MostWanted',
    avatar_url: 'https://i.ibb.co/fV98zMbz/HEX-LOGO-RED.png',
    tts: false,
    embeds: [
      {
        author: {
          name: toTrimmedString(reporter.name) || 'Anónimo',
          url: 'https://mostwanted.kaithsrebels.com',
          icon_url: 'https://i.ibb.co/sJDdYnPc/Vector-Padding.png',
        },
        title: '[ SUJETO MARCADO PARA ELIMINACIÓN ]',
        description: `\`\`\`${truncateText(report.nickname, 300)}\`\`\`\n## 🗒 Motivo:\n> ${truncateText(reasonText, 900)}`,
        url: `https://socialclub.rockstargames.com/members/${report.nickname}/`,
        color: embedColor,
        fields,
        ...(thumbnailUrl ? { thumbnail: { url: thumbnailUrl } } : {}),
        footer: {
          text: 'MostWanted • Sistema de reportes de bad players',
          icon_url: 'https://i.ibb.co/fV98zMbz/HEX-LOGO-RED.png',
        },
        timestamp: new Date(normalizeTimestamp(report.time)).toISOString(),
      },
    ],
    allowed_mentions: {
      parse: [],
    },
    components: [],
    actions: {},
    flags: 0,
  };

  const galleryImages = imageEvidence.slice(0, 5);
  for (const imageUrl of galleryImages) {
    payload.embeds.push({
      url: 'https://mostwanted.kaithsrebels.com',
      color: embedColor,
      image: {
        url: imageUrl,
      },
    });
  }

  try {
    const response = await fetch(webhookUrlResult.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook returned ${response.status}`);
    }

    return {
      ok: true,
      message: 'Reporte enviado a Discord exitosamente',
    };
  } catch (error) {
    return {
      ok: false,
      message: `Error al enviar a Discord: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Envía el reporte a Discord y también a HEXBOT si está configurado
 */
export async function sendReportToAllChannels(submission = {}, config = {}, logger = console) {
  const results = {
    discord: null,
    hexbot: null,
  };

  // Enviar a Discord webhook
  try {
    results.discord = await sendReportToDiscordWebhook(submission);
    logger.info('[discord-webhook] Report delivered', results.discord);
  } catch (error) {
    results.discord = {
      ok: false,
      message: 'Error al enviar a Discord',
      error: error.message,
    };
    logger.error('[discord-webhook] Failed to send report', results.discord);
  }

  return results;
}
