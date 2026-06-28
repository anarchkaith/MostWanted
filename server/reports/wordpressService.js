import { buildHexbotReportPayload } from './payload.js';
import { createWordpressCustomPost, getWordpressHealth, postWordpressReport } from './wordpressClient.js';
import { hasWordpressReportsConfig } from './wordpressConfig.js';

function toErrorDetails(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown_error';
}

function normalizeWordpressError(error) {
  const isTimeout = error instanceof Error && error.name === 'TimeoutError';
  const status = typeof error?.status === 'number' ? error.status : 0;
  const isUnauthorized = status === 401;
  const isPayloadError = status === 400;

  return {
    ok: false,
    errorCode: isTimeout ? 'timeout' : status > 0 ? 'upstream_error' : 'network_error',
    status,
    message: isTimeout
      ? 'WordPress no respondio dentro del timeout configurado.'
      : isUnauthorized
        ? 'WordPress rechazo la autenticacion del backend.'
        : isPayloadError
          ? 'WordPress rechazo el payload del reporte.'
          : status > 0
            ? 'WordPress respondio con error.'
            : 'No se pudo establecer conexion con WordPress.',
    details: typeof error?.details === 'string' && error.details
      ? error.details
      : toErrorDetails(error),
  };
}

function toList(values = []) {
  return Array.isArray(values) && values.length > 0
    ? values.map((item) => {
      if (item && typeof item === 'object') {
        const name = String(item?.name || '').trim();
        const url = String(item?.url || '').trim();
        if (name && url) return `${name} (${url})`;
        return name || url || '';
      }
      return String(item);
    }).filter(Boolean).join(', ')
    : 'N/A';
}

function buildMarkdownReportContent(payload = {}) {
  const evidence = Array.isArray(payload?.evidence) ? payload.evidence : [];
  const evidenceLines = evidence.length > 0
    ? evidence.slice(0, 10).map((item, index) => {
      const name = String(item?.name || `evidencia-${index + 1}`);
      const url = String(item?.url || '').trim();
      const contentType = String(item?.contentType || '').trim();
      return url
        ? `- [${name}](${url})${contentType ? ` (${contentType})` : ''}`
        : `- ${name}${contentType ? ` (${contentType})` : ''}`;
    }).join('\n')
    : '- Sin evidencias';

  return [
    `# Reporte MostWanted - ${payload?.nickname || 'Sin nickname'}`,
    '',
    '## Resumen',
    `- **Nickname:** ${payload?.nickname || 'N/A'}`,
    `- **RID:** ${payload?.rid || 'N/A'}`,
    `- **Player ID:** ${payload?.playerId || 'N/A'}`,
    `- **Crews:** ${toList(payload?.crews || payload?.crewsAssigned || [])}`,
    `- **Aliases:** ${toList(payload?.aliases || [])}`,
    `- **Tipos de infraccion:** ${toList(payload?.typesOfInfraction || [])}`,
    `- **Etiquetas:** ${toList(payload?.labels || [])}`,
    '',
    '## Motivo',
    payload?.reason || 'Sin motivo',
    '',
    '## Evidencias',
    evidenceLines,
    '',
    '## Metadata',
    `- **Reported by:** ${payload?.reportedby || payload?.reporter?.name || 'N/A'}`,
    `- **Source:** ${payload?.source || 'mostwanted-web'}`,
    `- **Timestamp:** ${payload?.time ? new Date(Number(payload.time)).toISOString() : new Date().toISOString()}`,
  ].join('\n');
}

export async function checkWordpressIntegration({ config, logger = console }) {
  if (!hasWordpressReportsConfig(config)) {
    const missing = {
      ok: false,
      errorCode: 'integration_not_configured',
      status: 0,
      message: 'La integracion con WordPress no esta configurada en este entorno.',
      details: 'Configura WORDPRESS_REPORTS_ENABLED=true, WORDPRESS_API_BASE_URL y WORDPRESS_API_SECRET.',
    };
    logger.warn('[wordpress] Healthcheck skipped: missing configuration', missing);
    return missing;
  }

  try {
    const result = await getWordpressHealth({ config, logger });
    return {
      ok: true,
      status: result.status,
      payload: result.payload,
    };
  } catch (error) {
    const health = normalizeWordpressError(error);
    logger.error('[wordpress] Healthcheck failed', {
      errorCode: health.errorCode,
      status: health.status,
      details: health.details,
    });
    return health;
  }
}

export async function sendReportToWordpress({ config, submission, logger = console }) {
  const payload = buildHexbotReportPayload(submission);

  if (!hasWordpressReportsConfig(config)) {
    const missing = {
      ok: false,
      errorCode: 'integration_not_configured',
      status: 0,
      message: 'La integracion con WordPress no esta configurada en este entorno.',
      details: 'Configura WORDPRESS_REPORTS_ENABLED=true, WORDPRESS_API_BASE_URL y WORDPRESS_API_SECRET.',
    };

    logger.warn('[wordpress] Integration skipped: missing configuration', missing);
    return { payload, delivery: missing };
  }

  try {
    const result = await postWordpressReport({ config, payload, logger });
    logger.info('[wordpress] Report delivered successfully', {
      nickname: payload.nickname,
      playerId: result.payload?.playerPostId ?? null,
      reportId: result.payload?.reportId ?? null,
    });

    return {
      payload,
      delivery: {
        ok: true,
        status: result.status,
        reportId: result.payload?.reportId ?? null,
        playerPostId: result.payload?.playerPostId ?? null,
        player: result.payload?.player ?? null,
      },
    };
  } catch (error) {
    const canFallbackToCustomPost = Number(error?.status) === 404 || Number(error?.status) === 405;
    if (canFallbackToCustomPost) {
      try {
        const markdown = buildMarkdownReportContent(payload);
        const fallback = await createWordpressCustomPost({
          config,
          postType: 'mw_report',
          title: `${payload.nickname || 'Jugador'} - Reporte MostWanted`,
          content: markdown,
          status: 'publish',
          meta: {
            mw_rid: payload?.rid || null,
            mw_player_id: payload?.playerId || null,
            mw_labels: Array.isArray(payload?.labels) ? payload.labels : [],
          },
          logger,
        });

        logger.info('[wordpress] Report delivered using generic custom post fallback', {
          nickname: payload.nickname,
          postId: fallback.payload?.id ?? null,
        });

        return {
          payload,
          delivery: {
            ok: true,
            status: fallback.status,
            reportId: fallback.payload?.id ?? null,
            playerPostId: null,
            player: {
              nickname: payload.nickname || null,
              rid: payload.rid || null,
            },
            mode: 'wp_v2_mw_report_fallback',
          },
        };
      } catch (fallbackError) {
        const delivery = normalizeWordpressError(fallbackError);
        logger.error('[wordpress] Fallback custom post delivery failed', {
          nickname: payload.nickname,
          errorCode: delivery.errorCode,
          status: delivery.status,
          details: delivery.details,
        });
        return { payload, delivery };
      }
    }

    const delivery = normalizeWordpressError(error);
    logger.error('[wordpress] Report delivery failed', {
      nickname: payload.nickname,
      errorCode: delivery.errorCode,
      status: delivery.status,
      details: delivery.details,
    });
    return { payload, delivery };
  }
}
