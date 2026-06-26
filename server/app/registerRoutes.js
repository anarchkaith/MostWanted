import { registerAuthRoutes } from '../modules/auth/http/auth.routes.js';
import { registerAiRoutes } from '../modules/ai/http/ai.routes.js';
import { registerExpedientesRoutes } from '../modules/expedientes/http/expedientes.routes.js';
import { registerReportsRoutes } from '../modules/reports/http/reports.routes.js';
import { registerDiscordWebhookRoutes } from '../modules/webhooks/http/discordWebhook.routes.js';
import { registerSystemRoutes } from '../modules/system/http/system.routes.js';

/**
 * Registra en orden los endpoints de todos los modulos funcionales.
 * Recibe dependencias compartidas para evitar acoplamiento en index.
 */
export function registerRoutes(app, deps) {
  registerAuthRoutes(app, deps);
  registerAiRoutes(app, deps);
  registerExpedientesRoutes(app, deps);
  registerReportsRoutes(app, deps);
  registerSystemRoutes(app, deps);
  registerDiscordWebhookRoutes(app, deps);
}
