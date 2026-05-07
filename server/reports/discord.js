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
  if (labels.length === 0) {
    return '#Sin etiquetas de amenaza';
  }

  return truncateText(labels.map((label) => `#${label}`).join('\n'), 1024);
}

function buildTargetDetails(report = {}) {
  const details = [];

  if (report.crews) details.push(`Crew: ${report.crews}`);
  if (report.rid) details.push(`RID: ${report.rid}`);
  if (report.ip) details.push(`IP: ${report.ip}`);
  if (report.aliases) details.push(`Aliases: ${report.aliases}`);

  return truncateText(details.join('\n'), 1024);
}

function buildFooterText(report = {}, reporter = {}) {
  const actor = toUpperText(report.reportedby || reporter.tag || reporter.name || 'ANONIMO', 'ANONIMO');
  return `LOG_BY: ${actor} // NO MERCY FOR TOXICS - ${formatIncidentDate(report.time)}`;
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
  const targetDetails = buildTargetDetails(report);

  const fields = [
    {
      name: '▌ 👤 SUJETO IDENTIFICADO ▌',
      value: truncateText(report.nickname, 1024),
      inline: false,
    },
    {
      name: '🏷 CARGO IMPUTADO',
      value: buildInfractionField(report),
      inline: true,
    },
    {
      name: '☣ NIVEL DE CORRUPCIÓN',
      value: buildCorruptionLevel(report),
      inline: true,
    },
    {
      name: '🗒 INFORME DE OPERACIONES',
      value: `\`\`\`\n"${truncateText(report.reason, 900)}"\n\`\`\``,
      inline: false,
    },
    {
      name: '🏷 CÓDIGOS DE AMENAZA',
      value: buildThreatCodes(report),
      inline: false,
    },
  ];

  if (targetDetails) {
    fields.push({
      name: '🧾 FICHA DEL OBJETIVO',
      value: targetDetails,
      inline: false,
    });
  }

  const payload = {
    username: DISCORD_WEBHOOK_NAME,
    avatar_url: DISCORD_WEBHOOK_AVATAR,
    embeds: [
      {
        author: {
          name: '✖ ✖ H.E.X. ✖ ✖',
          icon_url: HEX_AUTHOR_ICON,
        },
        title: '✖ [ TARGET MARKED FOR TERMINATION ] ✖',
        color: embedColor,
        fields,
        footer: {
          text: buildFooterText(report, reporter),
          icon_url: HEX_FOOTER_ICON,
        },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: {
      parse: [],
    },
  };

  for (const item of evidence.slice(0, 4)) {
    if (!item?.url) continue;
    payload.embeds.push({
      color: embedColor,
      image: {
        url: item.url,
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
