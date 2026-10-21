import { inferReportIntent } from '../../shared/reportIntent.js';
import { unwrapMarkdownFence } from '../../components/markdownUtils.js';
import { readApiResponse } from './jsonResponse.js';

const normalizeMessages = (messages = []) => (
  Array.isArray(messages)
    ? messages
      .filter(item => item && typeof item.content === 'string' && item.content.trim())
      .map(item => ({
        role: item.role === 'assistant' ? 'assistant' : (item.role === 'system' ? 'system' : 'user'),
        content: item.content.trim(),
      }))
    : []
);

function buildFallbackIntent(userText, candidateUsuarios) {
  return inferReportIntent(userText, candidateUsuarios) || {
    needsReportContext: false,
    related: false,
    intentType: 'general',
    tool: 'general_response',
    params: { usuario: null, reportId: null, recentDays: null },
    confidence: 0,
    reason: 'Clasificacion local de respaldo.',
  };
}

function requireSession(response, onSessionExpired) {
  if (response.status === 401) {
    onSessionExpired?.();
    throw new Error('Tu sesión de Discord expiró. Inicia sesión de nuevo para usar a HEX.');
  }
}

async function resolveIntent({ userText, messages, candidateUsuarios, intentEndpoint, signal, request, logger, onSessionExpired }) {
  let response;
  try {
    response = await request(intentEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        query: userText,
        history: normalizeMessages(messages).slice(-6),
        candidateUsuarios: candidateUsuarios.slice(0, 100),
      }),
    });
    signal.throwIfAborted();
  } catch (error) {
    if (signal.aborted || error.name === 'AbortError') throw error;
    logger.warn('[HEX] Clasificación no disponible; se usa la clasificación local.', error);
    return buildFallbackIntent(userText, candidateUsuarios);
  }
  requireSession(response, onSessionExpired);
  try {
    const intent = await readApiResponse(response, 'No se pudo clasificar la consulta.');
    signal.throwIfAborted();
    return intent;
  } catch (error) {
    if (signal.aborted || error.name === 'AbortError') throw error;
    logger.warn('[HEX] Clasificación no válida; se usa la clasificación local.', error);
    return buildFallbackIntent(userText, candidateUsuarios);
  }
}

function buildChatRequest(messages, context) {
  const body = { messages: normalizeMessages(messages) };
  if (!context?.useReportesDb) return body;
  body.useReportesDb = true;
  if (context.reportQuery) body.reportQuery = context.reportQuery;
  const reports = context.reportesContext?.reportes;
  if (Array.isArray(reports) && reports.length) {
    body.reportesContext = { source: 'localStorage', reportes: reports };
  }
  return body;
}

export async function requestAssistantReply({
  userText, messages, candidateUsuarios, buildContext, chatEndpoint, intentEndpoint,
  signal, onSessionExpired, request = fetch, logger = console,
}) {
  signal.throwIfAborted();
  const intent = await resolveIntent({
    userText, messages, candidateUsuarios, intentEndpoint, signal, request, logger, onSessionExpired,
  });
  signal.throwIfAborted();
  const response = await request(chatEndpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(buildChatRequest(messages, buildContext(userText, intent))),
  });
  signal.throwIfAborted();
  requireSession(response, onSessionExpired);
  const gatewayErrors = { 502: 'Bad Gateway', 503: 'Servicio no disponible', 504: 'Gateway Time-out' };
  if (!response.ok && response.status in gatewayErrors) {
    throw new Error(`El servidor no respondio a tiempo (${response.status} ${gatewayErrors[response.status]}). Intenta de nuevo en unos segundos.`);
  }
  const payload = await readApiResponse(response, 'No se pudo consultar a H.E.X.');
  signal.throwIfAborted();
  const reply = [payload.response, payload.text, payload.output, payload.message?.content]
    .find(value => typeof value === 'string' && value.trim());
  const content = reply && unwrapMarkdownFence(reply.trim()).trim();
  if (!content) throw new Error('H.E.X. devolvió una respuesta vacía o con un formato inválido.');
  return content;
}
