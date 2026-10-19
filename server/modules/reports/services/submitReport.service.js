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
    return {
      status: 201,
      payload: {
        ok: true,
        player,
        discordDelivery,
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
