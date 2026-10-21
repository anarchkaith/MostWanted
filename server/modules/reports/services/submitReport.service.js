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
    ownerDiscordId: /^\d+$/.test(String(sessionUser?.id || '')) ? String(sessionUser.id) : '',
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
  if (!wordpressResult.delivery.ok) {
    return {
      status: 502,
      payload: { ok: false, error: wordpressResult.delivery.message || 'No se pudo guardar el reporte en WordPress.' },
    };
  }
  const discordDelivery = await sendDiscordDelivery({ discordWebhookUrl, player, logger });

  let warning = null;
  if (refreshPlayerCase) {
    try {
      await refreshPlayerCase({ nickname: submission.report.nickname, rid: submission.report.rid || '', reportId: wordpressResult.delivery.reportId });
    } catch (error) {
      logger.error('[reports] Reporte guardado, pero no se pudo actualizar la clasificación HEX:', error);
      warning = 'El reporte se guardó, pero la clasificación HEX quedó pendiente de actualización.';
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
