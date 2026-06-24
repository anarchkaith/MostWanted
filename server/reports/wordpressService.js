import { buildHexbotReportPayload } from './payload.js';
import { getWordpressHealth, postWordpressReport } from './wordpressClient.js';
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
