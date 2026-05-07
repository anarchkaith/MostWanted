import { hasHexbotConfig } from './config.js';
import { getHexbotHealth, postHexbotReport } from './client.js';
import { buildHexbotReportPayload } from './payload.js';

function toErrorDetails(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown_error';
}

function normalizeBotError(error) {
  const isTimeout = error instanceof Error && error.name === 'TimeoutError';
  const status = typeof error?.status === 'number' ? error.status : 0;
  const isUnauthorized = status === 401;
  const isPayloadError = status === 400;

  return {
    ok: false,
    errorCode: isTimeout ? 'timeout' : status > 0 ? 'upstream_error' : 'network_error',
    status,
    message: isTimeout
      ? 'HEXBOT no respondio dentro del timeout configurado.'
      : isUnauthorized
        ? 'HEXBOT rechazo la autenticacion del backend.'
        : isPayloadError
          ? 'HEXBOT rechazo el payload del reporte.'
          : status > 0
            ? 'HEXBOT respondio con error.'
            : 'No se pudo establecer conexion con HEXBOT.',
    details: typeof error?.details === 'string' && error.details
      ? error.details
      : toErrorDetails(error),
  };
}

export async function checkHexbotIntegration({ config, logger = console }) {
  if (!hasHexbotConfig(config)) {
    const missingConfigResult = {
      ok: false,
      errorCode: 'integration_not_configured',
      status: 0,
      message: 'La integracion con HEXBOT no esta configurada en este entorno.',
      details: 'Configura HEXBOT_API_SECRET y, si quieres sobreescribir el destino, HEXBOT_API_BASE_URL.',
    };

    logger.warn('[hexbot] Healthcheck skipped: missing configuration', missingConfigResult);
    return missingConfigResult;
  }

  try {
    const result = await getHexbotHealth({ config, logger });
    return {
      ok: true,
      status: result.status,
      payload: result.payload,
    };
  } catch (error) {
    const health = normalizeBotError(error);
    logger.error('[hexbot] Healthcheck failed', {
      errorCode: health.errorCode,
      status: health.status,
      details: health.details,
    });
    return health;
  }
}

export async function sendReportToHexbot({ config, submission, logger = console }) {
  const payload = buildHexbotReportPayload(submission);

  if (!hasHexbotConfig(config)) {
    const missingConfigResult = {
      ok: false,
      errorCode: 'integration_not_configured',
      status: 0,
      message: 'La integracion con HEXBOT no esta configurada en este entorno.',
      details: 'Configura HEXBOT_API_SECRET y, si quieres sobreescribir el destino, HEXBOT_API_BASE_URL.',
    };

    logger.warn('[hexbot] Integration skipped: missing configuration', missingConfigResult);
    return {
      payload,
      delivery: missingConfigResult,
    };
  }

  try {
    const result = await postHexbotReport({ config, payload, logger });

    logger.info('[hexbot] Report delivered successfully', {
      username: payload.username,
      reportId: result.payload?.reportId ?? null,
      evidenceCount: result.payload?.evidenceCount ?? payload.evidence.length,
    });

    return {
      payload,
      delivery: {
        ok: true,
        status: result.status,
        reportId: result.payload?.reportId ?? null,
        evidenceCount: result.payload?.evidenceCount ?? payload.evidence.length,
      },
    };
  } catch (error) {
    const delivery = normalizeBotError(error);

    logger.error('[hexbot] Report delivery failed', {
      username: payload.username,
      errorCode: delivery.errorCode,
      status: delivery.status,
      details: delivery.details,
    });

    return { payload, delivery };
  }
}
