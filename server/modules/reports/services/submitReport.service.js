import { sendReportToWordpress } from '../../../reports/wordpressService.js';
import { validateIncomingReportSubmission } from '../../../reports/validation.js';

/**
 * Valida y envia un reporte a WordPress.
 */
export async function submitWordpressReport({
  body,
  wordpressReportsConfig,
  logger = console,
}) {
  const validation = validateIncomingReportSubmission(body);

  if (!validation.ok) {
    return {
      status: validation.status,
      payload: { ok: false, error: validation.error },
    };
  }

  const submission = validation.value;

  if (!wordpressReportsConfig.enabled) {
    return {
      status: 503,
      payload: {
        ok: false,
        error: 'WordPress no esta configurado en este entorno.',
      },
    };
  }

  const wordpressResult = await sendReportToWordpress({
    config: wordpressReportsConfig,
    submission,
    logger,
  });

  if (wordpressResult.delivery.ok) {
    return {
      status: 201,
      payload: {
        ok: true,
        player: wordpressResult.delivery.player ?? null,
      },
    };
  }

  return {
    status: 202,
    payload: {
      ok: true,
      player: wordpressResult.delivery?.player ?? null,
    },
  };
}
