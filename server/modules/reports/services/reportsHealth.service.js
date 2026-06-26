import { checkHexbotIntegration } from '../../../reports/service.js';
import { checkWordpressIntegration } from '../../../reports/wordpressService.js';

/**
 * Evalua el estado de integraciones de reportes segun destino activo.
 * Retorna status y payload listos para responder por HTTP.
 */
export async function checkReportsHealth({ hexbotConfig, wordpressReportsConfig, logger = console }) {
  if (wordpressReportsConfig.enabled) {
    const result = await checkWordpressIntegration({
      config: wordpressReportsConfig,
      logger,
    });

    if (result.ok) {
      return {
        status: 200,
        payload: {
          ok: true,
          configured: true,
          destination: 'wordpress',
          upstream: {
            status: result.status,
            payload: result.payload,
          },
        },
      };
    }

    const status = result.errorCode === 'integration_not_configured' ? 503 : 502;
    const configured = result.errorCode !== 'integration_not_configured';

    return {
      status,
      payload: {
        ok: false,
        configured,
        destination: 'wordpress',
        error: result.message,
        details: result.details,
        upstreamStatus: result.status,
      },
    };
  }

  const result = await checkHexbotIntegration({
    config: hexbotConfig,
    logger,
  });

  if (result.ok) {
    return {
      status: 200,
      payload: {
        ok: true,
        configured: true,
        destination: 'hexbot',
        upstream: {
          status: result.status,
          payload: result.payload,
        },
      },
    };
  }

  const status = result.errorCode === 'integration_not_configured' ? 503 : 502;
  const configured = result.errorCode !== 'integration_not_configured';

  return {
    status,
    payload: {
      ok: false,
      configured,
      destination: 'hexbot',
      error: result.message,
      details: result.details,
      upstreamStatus: result.status,
    },
  };
}
