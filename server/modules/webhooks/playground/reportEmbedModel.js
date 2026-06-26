import { createDiscordWebhookEmbed } from '../services/discordWebhook.service.js';

/**
 * Esquema base completo de datos de reporte para construir embeds.
 * Usalo como referencia para mapear cualquier fuente de datos.
 */
export const REPORT_EMBED_BASE_SCHEMA = {
  report: {
    caseId: 'EXP-2026-0001',
    rid: '123456',
    nickname: 'JugadorObjetivo',
    crews: ['Crew Example', 'Crew Example 2'],
    aliases: ['Alias_1', 'Alias_2'],
    avatars: ['https://prod.cloud.rockstargames.com/members/sc/6266/263863117/publish/gta5/mpchars/0.png', 'https://prod.cloud.rockstargames.com/members/sc/6266/263863117/publish/gta5/mpchars/1.png'],
    status: 'En investigacion',
    riskScore: 8.4,
    reason: 'Descripcion completa del motivo del reporte.',
    labels: ['#Toxicidad', '#Evasion', '#Cheat sospechado'],
    typesOfInfraction: ['Cheating', 'Abuso'],
    notes: [
      {
        name: "-Kaith_Suki-",
        text: "Notas adicionales del reporte.",
        timestamp: "2026-06-24T20:15:00.000Z"
      }
    ],
    createdAt: '2026-06-24T20:15:00.000Z',
    updatedAt: '2026-06-24T20:15:00.000Z',
  },
  reporter: {
    id: 'usr-001',
    name: '-Kaith_Suki-',
    discordId: '123456789012345678',
    ip: '192.168.1.1',
  },
  evidence: [
    {
      name: 'clip-1.mp4',
      url: 'https://example.com/clip-1.mp4',
      contentType: 'video/mp4',
    },
    {
      name: 'captura-1.png',
      url: 'https://example.com/captura-1.png',
      contentType: 'image/png',
    },
  ],
  visuals: {
    username: 'MostWanted',
    avatarUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    color: '#e74c3c',
    titlePrefix: 'Nuevo reporte de MostWanted',
    sourceUrl: 'https://mostwanted.kaithsrebels.com',
    authorName: '-Kaith_Suki-',
    authorIconUrl: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png',
    thumbnailUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    imageUrl: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=60',
    footerText: 'MostWanted • Sistema de Reportes',
    footerIconUrl: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png',
  },
  metadata: {
    server: 'LATAM-1',
    environment: 'production',
    requestedBy: 'Panel web',
    correlationId: 'corr-abc-123',
  },
};

function toInlineList(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return 'N/A';
  }
  return values.map((value) => String(value)).join(', ');
}

function isImageEvidence(contentType = '') {
  if (!contentType) return false;
  const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  return imageTypes.includes(contentType.toLowerCase());
}

function getVideoEvidenceLinks(evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return 'Sin evidencias de video';
  }

  const videoEvidences = evidence.filter((item) => !isImageEvidence(item?.contentType));
  if (videoEvidences.length === 0) {
    return 'Solo imágenes adjuntas';
  }

  const lines = videoEvidences.slice(0, 5).map((item) => {
    const name = item?.name ? String(item.name) : 'video-evidencia';
    const url = item?.url ? String(item.url) : null;
    return url ? `[${name}](${url})` : name;
  });

  return lines.join(' • ');
}

/**
 * Construye embeds adicionales para galería visual de evidencias (solo imágenes).
 * Embeds minimalistas solo con imagen para verse como grilla.
 */
function buildEvidenceGalleryEmbeds(evidence = [], sharedUrl = '') {
  if (!Array.isArray(evidence)) {
    return [];
  }

  const imageEvidences = evidence.filter((item) => isImageEvidence(item?.contentType));
  if (imageEvidences.length === 0) {
    return [];
  }

  return imageEvidences.slice(0, 5).map((item) => {
    const url = item?.url ? String(item.url) : null;
    if (!url) {
      return null;
    }

    return {
      color: '#95a5a6',
      ...(sharedUrl ? { url: sharedUrl } : {}),
      image: { url },
    };
  }).filter(Boolean);
}

/**
 * Formatea las notas del reporte en un text estructurado.
 */
function formatReportNotes(notes = []) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return 'Sin notas adicionales';
  }

  return notes
    .slice(0, 5)
    .map((note) => {
      const author = note?.name ? String(note.name) : 'Anonimo';
      const text = note?.text ? String(note.text) : '';
      const timestamp = note?.timestamp ? new Date(note.timestamp).toLocaleString('es-ES') : '';
      return `**${author}** (${timestamp}):\n${text}`;
    })
    .join('\n\n');
}

/**
 * Construye payload de Discord webhook usando todos los datos del esquema.
 * Incluye embed principal con datos del reporte y embeds adicionales para galeria de avatares.
 */
export function buildReportEmbedPayload(input = {}) {
  const report = input.report || {};
  const reporter = input.reporter || {};
  const visuals = input.visuals || {};
  const metadata = input.metadata || {};
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  const avatars = Array.isArray(report.avatars) ? report.avatars : [];

  const caseId = report.caseId || 'SIN-CASE-ID';
  const nickname = report.nickname || 'Desconocido';
  const rid = report.rid || 'N/A';
  const firstAvatarUrl = avatars.length > 0 ? String(avatars[0]) : visuals.thumbnailUrl;

  const mainEmbedFields = [
    { name: 'Case ID', value: String(caseId), inline: true },
    { name: 'RID', value: String(rid), inline: true },
    { name: 'Estado', value: String(report.status || 'N/A'), inline: true },
    { name: 'Riesgo', value: String(report.riskScore ?? 'N/A'), inline: true },
    { name: 'Crew', value: toInlineList(report.crews), inline: true },
    { name: 'Etiquetas', value: toInlineList(report.labels), inline: false },
    { name: 'Tipos de infraccion', value: toInlineList(report.typesOfInfraction), inline: false },
    { name: 'Aliases', value: toInlineList(report.aliases), inline: false },
    { name: 'Reportado por', value: String(reporter.name || 'N/A'), inline: true },
    { name: 'Discord ID', value: String(reporter.discordId || 'N/A'), inline: true },
    { name: 'Servidor', value: String(metadata.server || 'N/A'), inline: true },
  ];

  if (evidence.length > 0) {
    const videoLinks = getVideoEvidenceLinks(evidence);
    mainEmbedFields.push({ name: 'Evidencias de Video', value: videoLinks || 'N/A', inline: false });
  }

  if (report.notes && report.notes.length > 0) {
    mainEmbedFields.push({ name: 'Notas del Reporte', value: formatReportNotes(report.notes), inline: false });
  }

  const mainEmbed = {
    title: `${visuals.titlePrefix || 'Reporte'} | ${nickname}`,
    description: report.reason || 'Sin descripcion de motivo.',
    color: visuals.color || '#e74c3c',
    url: visuals.sourceUrl || undefined,
    timestamp: report.createdAt || new Date().toISOString(),
    author: {
      name: visuals.authorName || 'MostWanted Intelligence',
      icon_url: visuals.authorIconUrl || undefined,
      url: visuals.sourceUrl || undefined,
    },
    thumbnail: firstAvatarUrl ? { url: firstAvatarUrl } : undefined,
    image: undefined,
    footer: {
      text: `${visuals.footerText || 'MostWanted • Sistema de Reportes'}`,
      icon_url: visuals.footerIconUrl || undefined,
    },
    fields: mainEmbedFields,
  };

  const embeds = [mainEmbed];
  const sharedUrl = visuals.sourceUrl || 'https://mostwanted.kaithsrebels.com';

  const evidenceGalleryEmbeds = buildEvidenceGalleryEmbeds(evidence, sharedUrl);
  embeds.push(...evidenceGalleryEmbeds);

  return {
    content: `Nuevo reporte recibido para ${nickname}`,
    username: visuals.username || 'MostWanted Report Bot',
    avatar_url: visuals.avatarUrl || undefined,
    allowed_mentions: { parse: [] },
    embeds,
  };
}

/**
 * Envia el embed del reporte al webhook de Discord.
 */
export async function sendReportEmbed({ webhookUrl, reportData }) {
  const client = createDiscordWebhookEmbed({ webhookUrl });
  const payload = buildReportEmbedPayload(reportData);
  return client.send(payload);
}

/**
 * Ejemplo 1 de uso con dataset de investigacion.
 */
export const EXAMPLE_REPORT_DATA_A = {
  ...REPORT_EMBED_BASE_SCHEMA,
  report: {
    ...REPORT_EMBED_BASE_SCHEMA.report,
    caseId: 'EXP-2026-0107',
    nickname: 'KaithRider_01',
    rid: 'RID-90821',
    status: 'En revision',
  },
};

/**
 * Ejemplo 2 de uso con otro dataset.
 */
export const EXAMPLE_REPORT_DATA_B = {
  ...REPORT_EMBED_BASE_SCHEMA,
  report: {
    ...REPORT_EMBED_BASE_SCHEMA.report,
    caseId: 'EXP-2026-0322',
    nickname: 'GhostDriver_77',
    rid: 'RID-77891',
    status: 'Escalado',
    riskScore: 9.1,
    labels: ['Ban evasion', 'Multicuenta'],
  },
  metadata: {
    ...REPORT_EMBED_BASE_SCHEMA.metadata,
    server: 'NA-2',
    requestedBy: 'Batch nocturno',
    correlationId: 'corr-night-77891',
  },
};

/**
 * Ejemplo de invocacion para dos datasets distintos:
 *
 * const resultA = await sendReportEmbed({
 *   webhookUrl: 'https://discord.com/api/webhooks/xxx/yyy',
 *   reportData: EXAMPLE_REPORT_DATA_A,
 * });
 *
 * const resultB = await sendReportEmbed({
 *   webhookUrl: 'https://discord.com/api/webhooks/xxx/yyy',
 *   reportData: EXAMPLE_REPORT_DATA_B,
 * });
 */
