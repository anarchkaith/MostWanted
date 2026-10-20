import { sendReportToWordpress } from '../../../reports/wordpressService.js';
import { validateIncomingReportSubmission } from '../../../reports/validation.js';
import { sendDiscordReportForWordpressPlayer } from '../../../reports/discordReportEmbed.js';
import { attachSessionAvatarToReporter } from '../../../shared/auth/discordAvatar.js';

/**
 * Valida y envia un reporte a WordPress y luego lo notifica a Discord desde el backend.
 */
export async function submitWordpressReport({
  body,
  sessionUser = null,
  wordpressReportsConfig,
  discordWebhookUrl = '',
  logger = console,
  refreshPlayerCase,
}) {
  const validation = validateIncomingReportSubmission(body);

  if (!validation.ok) {
    return {
      status: validation.status,
      payload: { ok: false, error: validation.error },
    };
  }

  const submission = {
    ...validation.value,
    reporter: attachSessionAvatarToReporter(validation.value.reporter, sessionUser),
  };

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

  const player = wordpressResult.delivery?.player ?? null;
  const discordDelivery = await sendDiscordDelivery({ discordWebhookUrl, player, logger });

  if (wordpressResult.delivery.ok) {
    let warning = null;
    if (refreshPlayerCase) {
      try {
        await refreshPlayerCase({ nickname: submission.report.nickname, rid: submission.report.rid || '', reportId: wordpressResult.delivery.reportId });
      } catch (error) {
        logger.error('[reports] Reporte guardado, pero no se pudo actualizar la clasificación IA:', error);
        warning = 'El reporte se guardó, pero la clasificación IA quedó pendiente de actualización.';
      }
    }
    return {
      status: 201,
      payload: {
        ok: true,
        player,
        discordDelivery,
        ...(warning ? { warning } : {}),
      },
    };
  }

  return {
    status: 202,
    payload: {
      ok: true,
      player,
      discordDelivery,
    },
  };
}

async function sendDiscordDelivery({ discordWebhookUrl, player, logger }) {
  if (!discordWebhookUrl) {
    return { ok: false, message: 'Webhook de Discord no configurado en el servidor.' };
  }

  const delivery = await sendDiscordReportForWordpressPlayer({
    webhookUrl: discordWebhookUrl,
    player,
  });

  if (!delivery.ok) {
    logger.warn?.('[reports] Envio a Discord fallido:', delivery.message);
  }

  return delivery;
}
