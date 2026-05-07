import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildReportesChatContext, readReportesFromLocalStorage } from './chatTools';
import { getIaChatEndpoint, getIaIntentEndpoint } from '../src/services/apiConfig';

const HEX_LOGO_RED = '/HEX_LOGO_RED.png';
const IA_ENDPOINT = getIaChatEndpoint();
const INTENT_ENDPOINT = getIaIntentEndpoint();
const MAX_REQUEST_TIMEOUT_MS = 120000;
const PROGRESS_BASELINE_MS = MAX_REQUEST_TIMEOUT_MS;

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeMessages = (messages = []) => (
  Array.isArray(messages)
    ? messages
      .filter((item) => item && typeof item.content === 'string' && item.content.trim())
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : (item.role === 'system' ? 'system' : 'user'),
        content: item.content.trim(),
      }))
    : []
);

const findMentionedUsuario = (userText = '', candidateUsuarios = []) => {
  const question = normalizeText(userText);
  if (!question) return null;

  return candidateUsuarios.find((usuario) => {
    const normalizedUsuario = normalizeText(usuario);
    if (!normalizedUsuario) return false;

    const compact = normalizedUsuario.replace(/\s+/g, '_');
    return question.includes(normalizedUsuario) || question.includes(compact);
  }) || null;
};

const buildFallbackIntent = (userText = '', candidateUsuarios = []) => {
  const mentionedUsuario = findMentionedUsuario(userText, candidateUsuarios);
  const normalizedQuestion = normalizeText(userText);
  const reportKeywords = [
    'reporte',
    'reportes',
    'reportado',
    'reportados',
    'ranking',
    'top',
    'modder',
    'griefer',
    'tramposo',
    'tramposos',
    'usuarios reportados',
  ];
  const needsReportContext = Boolean(mentionedUsuario) || reportKeywords.some((keyword) => normalizedQuestion.includes(keyword));

  return {
    needsReportContext,
    related: needsReportContext,
    intentType: needsReportContext ? 'reportes-query' : 'general',
    tool: mentionedUsuario ? 'get_report_detail' : 'read_all_reports',
    params: {
      usuario: mentionedUsuario,
      reportId: null,
      recentDays: null,
    },
    confidence: 0,
    reason: 'Clasificacion local de respaldo.',
  };
};

async function resolveIntentData({ userText, messages, candidateUsuarios }) {
  const fallbackIntent = buildFallbackIntent(userText, candidateUsuarios);

  try {
    const response = await fetch(INTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userText,
        history: normalizeMessages(messages).slice(-6),
        candidateUsuarios: candidateUsuarios.slice(0, 100),
      }),
    });

    if (!response.ok) {
      return fallbackIntent;
    }

    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : fallbackIntent;
  } catch {
    return fallbackIntent;
  }
}

const buildChatRequest = (messages = [], reportesContextData = {}) => {
  const requestBody = {
    messages: normalizeMessages(messages),
  };

  if (!reportesContextData?.useReportesDb) {
    return requestBody;
  }

  requestBody.useReportesDb = true;

  if (reportesContextData.reportQuery) {
    requestBody.reportQuery = reportesContextData.reportQuery;
  }

  const scopedReportes = Array.isArray(reportesContextData?.reportesContext?.reportes)
    ? reportesContextData.reportesContext.reportes
    : [];

  if (scopedReportes.length > 0) {
    requestBody.reportesContext = {
      source: 'localStorage',
      reportes: scopedReportes,
    };
  }

  return requestBody;
};

const getAssistantReply = (payload = {}) => {
  if (typeof payload.response === 'string' && payload.response.trim()) {
    return payload.response.trim();
  }

  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.trim();
  }

  if (typeof payload.output === 'string' && payload.output.trim()) {
    return payload.output.trim();
  }

  if (payload.message && typeof payload.message.content === 'string' && payload.message.content.trim()) {
    return payload.message.content.trim();
  }

  return 'No pude generar una respuesta en este momento.';
};

const formatLatency = (ms) => `${(ms / 1000).toFixed(2)}s`;

export default function AIAssistantBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Soy H.E.X. la IA de apoyo de Most Wanted. Preguntame lo que necesites.'
    }
  ]);

  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const latencyAvgRef = useRef(PROGRESS_BASELINE_MS);
  const latencySamplesRef = useRef(0);

  const copyMessage = (content, idx) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1500);
    });
  };

  const stopProgressTicker = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const registerLatencySample = (responseMs) => {
    if (!Number.isFinite(responseMs) || responseMs <= 0) return;

    const samples = latencySamplesRef.current;
    const currentAvg = latencyAvgRef.current;
    const nextAvg = Math.round((currentAvg * samples + responseMs) / (samples + 1));

    latencySamplesRef.current = samples + 1;
    latencyAvgRef.current = Math.max(1000, Math.min(MAX_REQUEST_TIMEOUT_MS, nextAvg));
  };

  const startProgressTicker = () => {
    stopProgressTicker();

    const startedAt = performance.now();
    let estimatedMs = Math.max(PROGRESS_BASELINE_MS, latencyAvgRef.current);
    const baseProgress = 8;
    const capProgress = 98;

    setSendProgress(8);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startedAt;

      // If the request takes longer than expected, stretch up to the max timeout.
      if (elapsed > estimatedMs * 0.9 && estimatedMs < MAX_REQUEST_TIMEOUT_MS) {
        estimatedMs = Math.min(
          MAX_REQUEST_TIMEOUT_MS,
          Math.max(estimatedMs + 4000, elapsed * 1.15)
        );
      }

      const ratio = Math.min(1, elapsed / estimatedMs);
      const easedRatio = 1 - Math.exp(-2.4 * ratio);
      const projected = Math.round(baseProgress + easedRatio * (capProgress - baseProgress));
      setSendProgress((prev) => Math.max(prev, projected));
    }, 100);
  };

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isSending, isOpen]);

  useEffect(() => () => stopProgressTicker(), []);

  const formik = useFormik({
    initialValues: {
      message: ''
    },
    onSubmit: async (values, helpers) => {
      const userText = values.message.trim();

      if (!userText || isSending) return;

      const updatedMessages = [...messages, { role: 'user', content: userText }];
      setMessages(updatedMessages);
      helpers.resetForm();
      setIsSending(true);
      startProgressTicker();

      const assistantIndex = updatedMessages.length;
      const startedAt = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MAX_REQUEST_TIMEOUT_MS);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          responseMs: null
        }
      ]);

      try {
        const localReportes = readReportesFromLocalStorage();
        const candidateUsuarios = localReportes
          .map((reporte) => String(reporte?.usuario || '').trim())
          .filter(Boolean);
        const intentData = await resolveIntentData({
          userText,
          messages: updatedMessages,
          candidateUsuarios,
        });
        const reportesChatContext = buildReportesChatContext(userText, intentData);

        const response = await fetch(IA_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(buildChatRequest(updatedMessages, reportesChatContext))
        });

        if (!response.ok) {
          const GATEWAY_ERRORS = { 502: 'Bad Gateway', 503: 'Servicio no disponible', 504: 'Gateway Time-out' };
          if (response.status in GATEWAY_ERRORS) {
            throw new Error(
              `El servidor no respondio a tiempo (${response.status} ${GATEWAY_ERRORS[response.status]}). Intenta de nuevo en unos segundos.`
            );
          }

          const rawText = await response.text();
          let data = {};

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            data = {};
          }

          const detail = typeof data?.details === 'string' ? data.details.slice(0, 200) : '';
          const message = data?.error || `Error IA (${response.status}).`;
          throw new Error(detail ? `${message} Detalle: ${detail}` : message);
        }

        const rawText = await response.text();
        let payload = {};

        try {
          payload = rawText ? JSON.parse(rawText) : {};
        } catch {
          payload = { raw: rawText };
        }

        const assistantText = getAssistantReply(payload);

        setMessages((prev) => prev.map((msg, idx) => (
          idx === assistantIndex
            ? { ...msg, content: assistantText }
            : msg
        )));

        const responseMs = Math.round(performance.now() - startedAt);
        registerLatencySample(responseMs);
        setMessages((prev) => prev.map((msg, idx) => (
          idx === assistantIndex
            ? { ...msg, responseMs }
            : msg
        )));
      } catch (error) {
        const responseMs = Math.round(performance.now() - startedAt);
        registerLatencySample(responseMs);
        const timeoutError = error?.name === 'AbortError';
        const networkError = error instanceof TypeError;
        const message = timeoutError
          ? 'La consulta supero el tiempo maximo de 120s. Intenta con una pregunta mas corta.'
          : networkError
            ? `No hay conexion con la API. Verifica que la ruta ${IA_ENDPOINT} este disponible.`
            : (error.message || 'fallo inesperado al consultar a H.E.X.');

        setMessages((prev) => prev.map((msg, idx) => (
          idx === assistantIndex
            ? { ...msg, content: `Error: ${message}`, responseMs }
            : msg
        )));
      } finally {
        clearTimeout(timeoutId);
        stopProgressTicker();
        setIsCompleting(true);
        setSendProgress(100);
        setTimeout(() => {
          setSendProgress(0);
          setIsCompleting(false);
        }, 500);
        setIsSending(false);
        helpers.setSubmitting(false);
      }
    }
  });

  const canSend = useMemo(
    () => formik.values.message.trim().length > 0 && !isSending,
    [formik.values.message, isSending]
  );

  return (
    <div className="ai-bubble" aria-live="polite">
      {isOpen && (
        <section className="ai-bubble__panel" role="dialog" aria-label="Chat Most Wanted">
          <header className="ai-bubble__header">
            <div>
              <strong>Asistente H.E.X.</strong>
              <p className="ai-bubble__status">System online</p>
            </div>
            <div className="ai-bubble__header-actions">
              <button
                type="button"
                className="ai-bubble__close"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar chat"
              >
                ✕
              </button>
            </div>
          </header>

          <>
            <div className="ai-bubble__messages" ref={messagesRef}>
              {messages.map((message, index) => message.content === '' ? null : (
                <article
                  key={`${message.role}-${index}`}
                  className={`ai-bubble__message ai-bubble__message--${message.role}`}
                >
                  <span className="ai-bubble__message-role">
                    {message.role === 'assistant' ? 'H.E.X.' : 'Tu'}
                    {message.role === 'assistant' && typeof message.responseMs === 'number' && (
                      <span className="ai-bubble__message-meta">{` · ${formatLatency(message.responseMs)}`}</span>
                    )}
                  </span>
                  {message.role === 'assistant' ? (
                    <div className="ai-bubble__message-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
                  ) : (
                    <p>{message.content}</p>
                  )}
                  <button
                    type="button"
                    className={`ai-bubble__copy-btn${copiedIdx === index ? ' ai-bubble__copy-btn--copied' : ''}`}
                    onClick={() => copyMessage(message.content, index)}
                    aria-label="Copiar mensaje"
                  >
                    {copiedIdx === index ? '✓ copiado' : 'copiar'}
                  </button>
                </article>
              ))}

              {isSending && (
                <article className="ai-bubble__message ai-bubble__message--assistant ai-bubble__message--loading">
                  <span className="ai-bubble__message-role">H.E.X.</span>
                  <div className="ai-bubble__loading-hero" aria-hidden="true">
                    <p>
                      <span className="ai-bubble__typing-dot" />
                      <span className="ai-bubble__typing-dot" />
                      <span className="ai-bubble__typing-dot" />
                    </p>
                  </div>
                  <div className="ai-bubble__progress" aria-label="Progreso de consulta a H.E.X.">
                    <div
                      className={`ai-bubble__progress-bar${isCompleting ? ' ai-bubble__progress-bar--completing' : ''}`}
                      style={{ width: `${sendProgress}%` }}
                    />
                  </div>
                  <small>{sendProgress}%</small>
                </article>
              )}
            </div>

            <form className="ai-bubble__form" onSubmit={formik.handleSubmit}>
              <input
                type="text"
                name="message"
                value={formik.values.message}
                onChange={formik.handleChange}
                placeholder="Escribe tu pregunta y presiona Enter..."
                maxLength={1200}
              />
              <button type="submit" disabled={!canSend}>
                Enviar
              </button>
            </form>
          </>
        </section>
      )}

      <button
        type="button"
        className={`ai-bubble__fab${isSending ? ' ai-bubble__fab--loading' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Abrir chat con H.E.X."
      >
        <img className="ai-bubble__fab-logo" src={HEX_LOGO_RED} alt="" />
      </button>
    </div>
  );
}
