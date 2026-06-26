import { sendReportToHexbot } from '../../../reports/service.js';
import { sendReportToWordpress } from '../../../reports/wordpressService.js';
import { sendReportToDiscordWebhook } from '../../../reports/discord.js';
import { validateIncomingReportSubmission } from '../../../reports/validation.js';

/**
 * Valida y orquesta el envio de un reporte a Discord y al destino principal.
 * Soporta flujo WordPress o HEXBOT segun configuracion del entorno.
 */
export async function submitReport({ body, hexbotConfig, wordpressReportsConfig, logger = console }) {
  const validation = validateIncomingReportSubmission(body);

  if (!validation.ok) {
    return {
      status: validation.status,
      payload: { ok: false, error: validation.error },
    };
  }

  if (wordpressReportsConfig.enabled) {
    const [discordDelivery, wordpressResult] = await Promise.all([
      sendReportToDiscordWebhook(validation.value),
      sendReportToWordpress({
        config: wordpressReportsConfig,
        submission: validation.value,
        logger,
      }),
    ]);

    if (discordDelivery.ok || wordpressResult.delivery.ok) {
      return {
        status: 201,
        payload: {
          ok: true,
          destination: 'wordpress',
          reportId: wordpressResult.delivery.reportId ?? null,
          playerPostId: wordpressResult.delivery.playerPostId ?? null,
          player: wordpressResult.delivery.player ?? null,
          evidenceCount: Array.isArray(wordpressResult.payload?.evidence) ? wordpressResult.payload.evidence.length : 0,
          discordDelivery,
          wordpressDelivery: wordpressResult.delivery,
          botDelivery: wordpressResult.delivery,
        },
      };
    }

    return {
      status: 202,
      payload: {
        ok: true,
        destination: 'wordpress',
        reportId: null,
        playerPostId: null,
        evidenceCount: Array.isArray(wordpressResult.payload?.evidence) ? wordpressResult.payload.evidence.length : 0,
        discordDelivery,
        wordpressDelivery: wordpressResult.delivery,
        botDelivery: wordpressResult.delivery,
        warning: 'El reporte fue aceptado por la web, pero no se pudo confirmar el envio a WordPress y/o Discord.',
      },
    };
  }

  const [discordDelivery, hexbotResult] = await Promise.all([
    sendReportToDiscordWebhook(validation.value),
    sendReportToHexbot({
      config: hexbotConfig,
      submission: validation.value,
      logger,
    }),
  ]);

  if (discordDelivery.ok || hexbotResult.delivery.ok) {
    return {
      status: 201,
      payload: {
        ok: true,
        reportId: hexbotResult.delivery.reportId ?? null,
        evidenceCount: Array.isArray(hexbotResult.payload?.evidence) ? hexbotResult.payload.evidence.length : 0,
        discordDelivery,
        hexbotDelivery: hexbotResult.delivery,
        botDelivery: hexbotResult.delivery,
      },
    };
  }

  return {
    status: 202,
    payload: {
      ok: true,
      reportId: null,
      evidenceCount: Array.isArray(hexbotResult.payload?.evidence) ? hexbotResult.payload.evidence.length : 0,
      discordDelivery,
      hexbotDelivery: hexbotResult.delivery,
      botDelivery: hexbotResult.delivery,
      warning: 'El reporte fue aceptado por la web, pero no se pudo confirmar el envio a todos los destinos configurados.',
    },
  };
}
