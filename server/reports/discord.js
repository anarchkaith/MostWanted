const BLOCKED_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487549131655483583/zYfylIqIqPAM7Oy9icfNAiZb51kQvVD0oVVhq9HAW1UxheTp6U7RMIsoRBh2FIQQrx2O';

const DISCORD_WEBHOOK_NAME = '[SE BUSCA] :: Nueva amenaza detectada...';
const DISCORD_WEBHOOK_AVATAR = 'https://i.pinimg.com/736x/2b/6e/f6/2b6ef68a43b6b4363dcea23ee5c78421.jpg';
const HEX_AUTHOR_ICON = 'https://i.ibb.co/zT7r8F2P/X.png';
const HEX_FOOTER_ICON = 'https://i.ibb.co/v4KTFw0q/Vector.png';

function resolveDiscordWebhookUrl() {
  const configuredUrl = String(process.env.DISCORD_WEBHOOK_URL || '').trim();

  if (!configuredUrl) {
    return { ok: false, reason: 'Webhook de Discord no configurado (DISCORD_WEBHOOK_URL).' };
  }

  if (configuredUrl === BLOCKED_DISCORD_WEBHOOK_URL) {
    return { ok: false, reason: 'El webhook anterior fue bloqueado y ya no debe usarse.' };
  }

  return { ok: true, url: configuredUrl };
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

function isImageContentType(contentType) {
  const value = String(contentType || '').toLowerCase();
  return value.startsWith('image/');
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
  if (assignedCrews[0]) details.push(`Crew asignada #1: ${assignedCrews[0]}`);
  if (assignedCrews[1]) details.push(`Crew asignada #2: ${assignedCrews[1]}`);
  if (assignedCrews[2]) details.push(`Crew asignada #3: ${assignedCrews[2]}`);
  if (assignedCrews[3]) details.push(`Crew asignada #4: ${assignedCrews[3]}`);
  if (normalizedCrewEntries.length > 0) {
    for (const entry of normalizedCrewEntries.slice(0, 5)) {
      const line = [
        entry?.isActive ? 'Crew estructurada (actual)' : 'Crew estructurada',
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

function buildFooterText(report = {}, reporter = {}) {
  const actor = toUpperText(report.reportedby || reporter.tag || reporter.name || 'FORMULARIO WEB', 'FORMULARIO WEB');
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
  const videoItems = (Array.isArray(evidence) ? evidence : [])
    .filter((item) => item?.url && !isImageContentType(item?.contentType));

  if (videoItems.length === 0) {
    return 'Sin evidencias de video';
  }

  return truncateText(videoItems
    .slice(0, 5)
    .map((item) => item.name || item.url)
    .join(', '), 1024);
}

function resolveAvatarUrls(report = {}) {
  const avatarsFromArray = toArray(report.avatars);
  const avatarsFromLegacy = [report.avatar1, report.avatar2].map(toTrimmedString).filter(Boolean);
  const merged = [...avatarsFromArray, ...avatarsFromLegacy].filter(Boolean);
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
  const report = submission?.report || {};
  const reporter = submission?.reporter || {};
  const evidence = submission?.evidence || [];
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

  const embedColor = getColorByInfraction(report.typesOfInfraction);
  const aliases = toArray(report.aliases);
  const crews = toArray(report.crews);
  const labels = toArray(report.labels);
  const infractions = toArray(report.typesOfInfraction);
  const avatars = resolveAvatarUrls(report);
  const imageEvidence = evidence
    .filter((item) => item?.url && isImageContentType(item?.contentType))
    .map((item) => item.url);

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
      value: truncateText(String(report.status || 'En investigación'), 1024),
      inline: true,
    },
    {
      name: '☣ Riesgo',
      value: String(report.riskScore ?? 'N/A'),
      inline: true,
    },
    {
      name: '👥 Crews',
      value: truncateText(crews.join(', ') || 'N/A', 1024),
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
          name: toTrimmedString(reporter.name) || toTrimmedString(report.reportedby) || '-Kaith_Suki-',
          url: 'https://mostwanted.kaithsrebels.com',
          icon_url: 'https://i.ibb.co/sJDdYnPc/Vector-Padding.png',
        },
        title: '[ SUJETO MARCADO PARA ELIMINACIÓN ]',
        description: `\`\`\`${truncateText(report.nickname, 300)}\`\`\`\n## 🗒 Motivo:\n> ${truncateText(report.reason, 900)}`,
        url: 'https://mostwanted.kaithsrebels.com',
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
