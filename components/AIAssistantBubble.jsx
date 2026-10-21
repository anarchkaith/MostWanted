import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { buildReportesChatContext, readReportesFromLocalStorage } from './chatTools';
import { getIaChatEndpoint, getIaIntentEndpoint } from '../src/services/apiConfig';
import { requestAssistantReply } from '../src/services/assistantChat';
import CyberButtonLabel from './ui/CyberButtonLabel';

const HEX_LOGO_RED = '/HEX_LOGO_RED.png';
const IA_ENDPOINT = getIaChatEndpoint();
const INTENT_ENDPOINT = getIaIntentEndpoint();
const MAX_REQUEST_TIMEOUT_MS = 120000;
const PROGRESS_BASELINE_MS = MAX_REQUEST_TIMEOUT_MS;
const MARKDOWN_COMPONENTS = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  table: ({ children }) => (
    <div className="mw-cyber-table-scroll" role="region" aria-label="Tabla de respuesta" tabIndex={0}>
      <table className="cyber-table cyber-style-1 mw-cyber-table">{children}</table>
    </div>
  ),
};

const formatLatency = (ms) => `${(ms / 1000).toFixed(2)}s`;

export default function AIAssistantBubble({ isAuthenticated = false, onSessionExpired }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Soy H.E.X. el asistente de apoyo de Kaith's Rebels . Preguntame lo que necesites."
    }
  ]);

  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const latencyAvgRef = useRef(PROGRESS_BASELINE_MS);
  const latencySamplesRef = useRef(0);
  const activeRequestRef = useRef(null);
  const completionTimerRef = useRef(null);

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

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const mobileViewport = window.matchMedia('(max-width: 640px)');
    const syncOverflow = () => {
      document.body.style.overflow = isFullscreen || mobileViewport.matches ? 'hidden' : previousOverflow;
    };
    syncOverflow();
    mobileViewport.addEventListener('change', syncOverflow);
    return () => {
      mobileViewport.removeEventListener('change', syncOverflow);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isFullscreen]);

  useEffect(() => () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    stopProgressTicker();
    clearTimeout(completionTimerRef.current);
  }, []);

  const formik = useFormik({
    initialValues: {
      message: ''
    },
    onSubmit: async (values, helpers) => {
      const userText = values.message.trim();

      if (!userText || activeRequestRef.current) return;

      clearTimeout(completionTimerRef.current);
      setIsCompleting(false);
      const updatedMessages = [...messages, { role: 'user', content: userText }];
      setMessages(updatedMessages);
      helpers.resetForm();
      setIsSending(true);
      startProgressTicker();

      const assistantIndex = updatedMessages.length;
      const startedAt = performance.now();
      const controller = new AbortController();
      activeRequestRef.current = controller;
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
        const assistantText = await requestAssistantReply({
          userText,
          messages: updatedMessages,
          candidateUsuarios,
          buildContext: buildReportesChatContext,
          chatEndpoint: IA_ENDPOINT,
          intentEndpoint: INTENT_ENDPOINT,
          signal: controller.signal,
          onSessionExpired,
        });
        if (activeRequestRef.current !== controller) return;

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
        if (activeRequestRef.current !== controller) return;
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
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
          stopProgressTicker();
          setIsCompleting(true);
          setSendProgress(100);
          completionTimerRef.current = setTimeout(() => {
            setSendProgress(0);
            setIsCompleting(false);
          }, 500);
          setIsSending(false);
          helpers.setSubmitting(false);
        }
      }
    }
  });

  const canSend = useMemo(
    () => formik.values.message.trim().length > 0 && !isSending,
    [formik.values.message, isSending]
  );

  if (!isAuthenticated) return null;

  return (
    <div className={`ai-bubble${isFullscreen ? ' ai-bubble--fullscreen' : ''}`} aria-live="polite">
      {isOpen && (
        <>
          {isFullscreen && (
            <button
              type="button"
              className="ai-bubble__backdrop"
              data-ui-sound="reject"
              onClick={() => setIsFullscreen(false)}
              aria-label="Cerrar pantalla completa"
            />
          )}
          <section
            className={`ai-bubble__panel${isFullscreen ? ' ai-bubble__panel--fullscreen' : ''}`}
            role="dialog"
            aria-modal={isFullscreen}
            aria-labelledby="ai-bubble-title"
          >
          <header className="ai-bubble__header">
            <div>
              <strong id="ai-bubble-title">Asistente H.E.X.</strong>
            </div>
            <div className="ai-bubble__header-actions">
              <button
                type="button"
                className="ai-bubble__fullscreen"
                onClick={() => setIsFullscreen((prev) => !prev)}
                aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
              >
                {isFullscreen ? '↙' : '⛶'}
              </button>
              <button
                type="button"
                className="ai-bubble__close"
                onClick={() => {
                  setIsOpen(false);
                  setIsFullscreen(false);
                }}
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
                    <div className="ai-bubble__message-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={MARKDOWN_COMPONENTS}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
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
              <div className="cyber-input-full mw-cyber-input">
              <input
                type="text"
                name="message"
                aria-label="Mensaje para H.E.X."
                value={formik.values.message}
                onChange={formik.handleChange}
                placeholder="Escribe tu pregunta…"
                maxLength={1200}
              />
              </div>
              <button className="cyber-button-small mw-cyber-button" type="submit" disabled={!canSend}>
                <CyberButtonLabel>Enviar</CyberButtonLabel>
              </button>
            </form>
          </>
          </section>
        </>
      )}

      <button
        type="button"
        className={`ai-bubble__fab${isSending ? ' ai-bubble__fab--loading' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Abrir chat con H.E.X."
        hidden={isFullscreen}
      >
        <img className="ai-bubble__fab-logo" src={HEX_LOGO_RED} alt="" />
      </button>
    </div>
  );
}
