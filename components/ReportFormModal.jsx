import EtiquetasSelector from './EtiquetasSelector';
import { useState, useRef, useCallback } from 'react';
import Tooltip from './Tooltip';
import HelpIcon from './HelpIcon';
import ImageUpload from './ImageUpload';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { reportFormValidationSchema } from './reportFormValidation';
import TipoInfraccionSelector from './TipoInfraccionSelector';
import { useMutation } from '@tanstack/react-query';
import { TIPOS_ETIQUETAS } from './tiposEtiquetas';
import PlayerBackgroundPanel from './PlayerBackgroundPanel';
import { isBlockedReportedUsername } from './blockedUsernames';
import {
  fetchWordpressPlayersSnapshot,
  submitDiscordReportFromWordpressResult,
  submitWordpressReport,
  uploadEvidenceImages,
} from '../src/services/reportSubmissionService';

const initialValues = {
  investigation_status: 'not_attempted',
  // Información del jugador reportado
  nickname: '',
  crews: '',
  avatar1: '',
  avatar2: '',
  rid: '',
  ip: '',
  aliases: '',
  time: '',
  // Información del reporte
  typesOfInfraction: [],
  reason: '',
  evidence: [],
  labels: [],
  reportedby: '',
};

const demoValues = {
  investigation_status: 'resolved',
  // Información del jugador reportado
  nickname: '[DEMO] DemoPlayer_GTA',
  crews: '[DEMO] Rebels Elite, [DEMO] Demo Crew 1, [DEMO] Demo Crew 2',
  avatar1: '',
  avatar2: '',
  rid: '12345',
  ip: '192.168.1.1',
  aliases: '[DEMO] AltPlayer, DemoAlt',
  time: '1640000000',
  // Información del reporte
  typesOfInfraction: ['Modder'],
  reason: '[REPORTE DE PRUEBA - NO VÁLIDO] Este es un reporte de demostración generado automáticamente para testear el formulario. El jugador ficticio utilizó Aimbot y Godmode durante una sesión de Freeroam de prueba. Este reporte no debe tomarse en cuenta.',
  evidence: [],
  labels: ['Aimbot', 'Godmode (hack)'],
  reportedby: '[DEMO] TestUser#0001',
};

const ReportFormModal = ({ onSubmit, currentUser = null, isDemo = false }) => {
  const imageUploadRef = useRef(null);
  const [images, setImages] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(null); // nombre del usuario reportado
  const [botDeliveryState, setBotDeliveryState] = useState(null);
  const [showOptional, setShowOptional] = useState(false);
  const [investigationToken, setInvestigationToken] = useState(0);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationGate, setInvestigationGate] = useState({
    username: '',
    completed: false,
  });
  const formikRef = useRef(null);

  const handleGlobalPaste = useCallback((e) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    const hasImages = Array.from(clipboardItems).some(item => item.type.startsWith('image/'));
    if (hasImages && imageUploadRef.current) {
      imageUploadRef.current.addFilesFromPaste(e);
    }
  }, []);

  const crearReporte = useMutation({
    mutationFn: async (nuevoReporte) => {
      const apiKey = import.meta.env.VITE_API_KEY_IMGBB;
      const contactName = String(nuevoReporte?.reportedby || '').trim();
      const { reportedby: _reportedby, ...reportPayload } = nuevoReporte;
      const reporter = {
        id: currentUser?.id || '',
        name: currentUser?.username || contactName || 'Anónimo',
        email: currentUser?.email || '',
      };
      const evidence = await uploadEvidenceImages(images, apiKey);

      const wordpressResult = await submitWordpressReport({
        report: reportPayload,
        reporter,
        evidence,
      });

      let discordResult = null;
      let discordDelivery = null;
      try {
        discordResult = await submitDiscordReportFromWordpressResult(wordpressResult);
        discordDelivery = discordResult?.discordDelivery || null;
      } catch (discordError) {
        discordDelivery = {
          ok: false,
          message: discordError?.message || 'No se pudo confirmar el envio a Discord.',
        };
      }

      return {
        ...wordpressResult,
        discordDelivery,
        discordResult,
      };
    },
    onError: (error) => {
      setSubmitError(error.message || 'Error al enviar el reporte. Intenta de nuevo.');
    },
  });

  const handleAceptar = () => {
    formikRef.current?.resetForm();
    setImages([]);
    imageUploadRef.current?.clearImages?.();
    setShowSuccess(null);
    setBotDeliveryState(null);
  };

  const severidadColorMap = {
    baja: 0x2ecc40,
    media: 0xffe066,
    alta: 0xffa500,
    critica: 0xff3333,
    inviable: 0x000000,
  };

  return (
    <div className="rfm-shell" style={{ maxWidth: 1600, margin: '0 auto' }}>

      {/* ── POPUP ÉXITO ── fuera del Form para evitar problemas de z-index/Formik */}
      {showSuccess && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0f0f0f',
            border: '2px solid #ff3333',
            padding: '2.5rem 2rem',
            maxWidth: 420, width: '90%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
            boxShadow: '0 0 40px rgba(255,51,51,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', lineHeight: 1 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-stencil)', fontSize: '1.3rem', color: '#ff3333', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {botDeliveryState?.ok ? 'Reporte cargado satisfactoriamente' : 'Reporte cargado con observaciones'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#9a9a9a' }}>
              {botDeliveryState?.ok ? (
                <>El reporte contra <span className="notranslate" translate="no" style={{ color: '#e8e8b8', fontWeight: 700 }}>{showSuccess.nickname}</span> fue enviado al equipo de Staff de Kaith&apos;s Rebels</>
              ) : (
                <>El reporte contra <span className="notranslate" translate="no" style={{ color: '#e8e8b8', fontWeight: 700 }}>{showSuccess.nickname}</span> fue registrado en la web, pero la sincronizacion con el bot requiere revision.</>
              )}
            </div>
            <div style={{
              width: '100%',
              padding: '0.75rem 0.9rem',
              border: `1px solid ${botDeliveryState?.ok ? 'rgba(34,197,94,0.5)' : 'rgba(255,179,71,0.45)'}`,
              background: botDeliveryState?.ok ? 'rgba(34,197,94,0.08)' : 'rgba(255,179,71,0.08)',
              color: botDeliveryState?.ok ? '#9ef0b1' : '#ffcf85',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              lineHeight: 1.5,
            }}>
              {botDeliveryState?.ok
                ? 'Sincronizado con el bot de Discord.'
                : `No se pudo confirmar el envio al bot de Discord${botDeliveryState?.message ? `: ${botDeliveryState.message}` : '.'}`}
            </div>
            <a
              href="https://support.rockstargames.com/request/gta-v/online-play-support/report-another-player/pc"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                border: '1px solid #e8e8b8',
                color: '#e8e8b8',
                textDecoration: 'none',
                fontFamily: 'var(--font-stencil)',
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(232,232,184,0.06)',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(232,232,184,0.16)';
                e.currentTarget.style.borderColor = '#fff7c2';
                e.currentTarget.style.color = '#fff7c2';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(232,232,184,0.06)';
                e.currentTarget.style.borderColor = '#e8e8b8';
                e.currentTarget.style.color = '#e8e8b8';
              }}
            >
              Reportarlo tambien en Rockstar Support
            </a>
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowSuccess(null)}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  background: 'transparent', border: '1px solid #3a3a3a',
                  color: '#9a9a9a', fontFamily: 'var(--font-stencil)',
                  fontSize: '0.85rem', textTransform: 'uppercase',
                  letterSpacing: '0.06em', cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#9a9a9a'; e.currentTarget.style.color = '#e8e8b8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#9a9a9a'; }}
              >
                ✏️ Volver y editar
              </button>
              <button
                type="button"
                onClick={handleAceptar}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  background: '#ff3333', border: '2px solid #ff3333',
                  color: '#000', fontFamily: 'var(--font-stencil)',
                  fontSize: '0.85rem', textTransform: 'uppercase',
                  letterSpacing: '0.06em', cursor: 'pointer', fontWeight: 700,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#cc0000'}
                onMouseLeave={e => e.currentTarget.style.background = '#ff3333'}
              >
                ✔ Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rfm-shell {
          padding: 0.35rem;
          position: relative;
        }

        .rfm-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid rgba(0, 255, 255, 0.1);
          pointer-events: none;
          border-radius: 10px;
        }

        .rfm-intro {
          margin-bottom: 1.15rem;
          padding: 0.95rem 1rem;
          border: 1px solid rgba(255, 51, 51, 0.35);
          background:
            linear-gradient(120deg, rgba(255, 51, 51, 0.1), transparent 45%),
            rgba(8, 8, 8, 0.92);
          border-radius: 10px;
        }

        .rfm-intro__title {
          font-family: var(--font-stencil);
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--color-cream);
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .rfm-intro__text {
          font-family: var(--font-mono);
          color: var(--color-text-muted);
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .rfm-stack {
          display: flex;
          flex-direction: column;
          gap: 0.95rem;
        }

        .rfm-panel {
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.95), rgba(12, 12, 12, 0.96));
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-left: 3px solid rgba(255, 51, 51, 0.75);
          border-radius: 10px;
          padding: 1rem 1rem 0.95rem;
          box-shadow: inset 0 0 0 1px rgba(0, 255, 255, 0.04);
        }

        .rfm-panel__title {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-family: var(--font-stencil);
          font-size: 0.88rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--color-cream);
          margin-bottom: 0.7rem;
        }

        .rfm-field-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .rfm-field-full {
          grid-column: 1 / -1;
        }

        .rfm-note {
          margin-top: 0.55rem;
          font-family: var(--font-mono);
          color: var(--color-text-muted);
          font-size: 0.73rem;
          border-top: 1px dashed rgba(255, 255, 255, 0.18);
          padding-top: 0.45rem;
        }

        .rfm-submit-wrap {
          margin-top: 0.35rem;
        }

        .rfm-motivo-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 1.25rem;
          align-items: stretch;
        }

        .rfm-panel--objetivo {
          border-left-color: rgba(0, 255, 255, 0.7);
        }

        .rfm-input--hero {
          font-size: 1.08rem !important;
          letter-spacing: 0.06em;
          padding: 0.65rem 0.85rem !important;
        }

        .rfm-optional-toggle {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          padding: 0.6rem 0.85rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: var(--color-text-muted);
          font-family: var(--font-mono);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, color 0.2s;
        }

        .rfm-optional-toggle:hover {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.06);
          color: var(--color-cream);
        }

        .rfm-optional-toggle__arrow {
          font-size: 0.75rem;
          color: rgba(0, 255, 255, 0.6);
          flex-shrink: 0;
        }

        .rfm-optional-toggle__badge {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.3);
          padding: 0.1rem 0.45rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .rfm-optional-toggle__label {
          margin-left: auto;
          font-size: 0.7rem;
          color: rgba(0, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .rfm-investigate-btn {
          min-width: 134px;
          border: 1px solid rgba(0, 255, 255, 0.45);
          background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(255, 51, 51, 0.14));
          color: #b8fbff;
          font-family: var(--font-stencil);
          font-size: 0.76rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          transition: opacity 0.2s, filter 0.2s;
        }

        .rfm-investigate-btn:disabled {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.45);
          cursor: not-allowed;
          opacity: 0.7;
        }

        .rfm-investigate-btn__spinner {
          width: 0.8rem;
          height: 0.8rem;
          border: 2px solid rgba(0, 255, 255, 0.25);
          border-top-color: #9efeff;
          border-radius: 50%;
          animation: rfm-investigate-spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        .rfm-investigate-btn__spinner--hidden {
          visibility: hidden;
        }

        .rfm-button-label {
          display: inline-flex;
          align-items: center;
          min-height: 1em;
        }

        @keyframes rfm-investigate-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 868px) {
          .rfm-motivo-row { grid-template-columns: 1fr; }
          .rfm-field-row { grid-template-columns: 1fr; }
          .rfm-intro { padding: 0.85rem 0.85rem; }
          .rfm-panel { padding: 0.85rem 0.8rem 0.8rem; }
        }
      `}</style>

      <Formik
        innerRef={formikRef}
        initialValues={isDemo ? demoValues : initialValues}
        validationSchema={reportFormValidationSchema}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          setSubmitError('');
          setBotDeliveryState(null);
          try {
            // No incluir el campo evidence del formulario, se enviarán las imágenes subidas por separado
            const { evidence: _, ...reporteData } = values;
            const nuevoReporte = {
              ...reporteData,
              nickname: String(values.nickname || '').trim(),
            };
            const submissionResult = await crearReporte.mutateAsync(nuevoReporte);
            setBotDeliveryState(submissionResult?.discordDelivery || null);

            if (submissionResult?.ok) {
              try {
                const playersSnapshot = await fetchWordpressPlayersSnapshot({
                  perPage: 100,
                  reportsLimit: 20,
                });

                console.group('[MostWanted] Snapshot de jugadores en WordPress tras envio exitoso');
                console.log('Submission result:', submissionResult);
                console.log('Players snapshot:', playersSnapshot);
                console.groupEnd();
              } catch (snapshotError) {
                console.warn('[MostWanted] El envio fue exitoso, pero no se pudo consultar la API de jugadores de WordPress.', snapshotError);
              }
            }

            try {
              onSubmit?.(nuevoReporte, submissionResult);
            } catch (callbackError) {
              console.warn('[MostWanted] onSubmit callback fallo despues del envio exitoso.', callbackError);
            }
            setShowSuccess({ nickname: nuevoReporte.nickname });
          } catch (error) {
            setSubmitError(error.message || 'Error al enviar el reporte. Intenta de nuevo.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, isSubmitting, setFieldValue }) => {
          const trimmedUsername = String(values.nickname || '').trim();
          const blockedUsername = isBlockedReportedUsername(trimmedUsername);
          const canInvestigate = trimmedUsername.length >= 2 && !blockedUsername && !isSubmitting && !isInvestigating;
          const isInvestigationForCurrentUsername = (
            investigationGate.username
            && investigationGate.username.toLowerCase() === trimmedUsername.toLowerCase()
          );
          const canShowFullForm = isDemo || (
            investigationGate.completed
            && isInvestigationForCurrentUsername
          );

          return (
            <Form className="report-form" noValidate onPaste={handleGlobalPaste} style={{ position: 'relative' }}>

              {isDemo && (
                <div style={{
                  marginBottom: '0.85rem',
                  padding: '0.6rem 1rem',
                  background: 'rgba(255, 200, 0, 0.08)',
                  border: '1px solid rgba(255, 200, 0, 0.45)',
                  borderLeft: '3px solid #ffc800',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: '#ffc800',
                  letterSpacing: '0.05em',
                }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>🧪</span>
                  <span>
                    <strong>MODO DEMO ACTIVO</strong> — El formulario está precargado con datos de prueba.
                    Los envíos realizados en este modo son reales; no envíes sin intención.
                  </span>
                </div>
              )}

              {/* ── LOADER OVERLAY ── */}
              {isSubmitting && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 50,
                  background: 'rgba(0,0,0,0.75)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '1rem', backdropFilter: 'blur(2px)',
                }}>
                  <div style={{
                    width: 56, height: 56,
                    border: '4px solid #3a3a3a',
                    borderTop: '4px solid #ff3333',
                    borderRadius: '50%',
                    animation: 'rfm-spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontFamily: 'var(--font-stencil)', fontSize: '1.1rem', color: '#ff3333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Enviando reporte...
                  </span>
                  <style>{`@keyframes rfm-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              <div className="rfm-stack">

                {submitError && (
                  <div style={{ color: '#ff3333', background: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderLeft: '3px solid #ff3333', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                    ⚠ {submitError}
                  </div>
                )}

                <div className="rfm-panel rfm-panel--objetivo">
                  <div className="rfm-panel__title">
                    Nombre del objetivo
                    <Tooltip text="Nombre exacto del jugador en el servidor.">
                      <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 15, height: 15, opacity: 0.6 }} /></span>
                    </Tooltip>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'stretch' }}>
                      <Field name="nickname">
                        {({ field }) => (
                          <input
                            {...field}
                            type="text"
                            id="nickname"
                            className="form-group__input rfm-input--hero"
                            placeholder="Ej: CHEATER_123"
                            maxLength={30}
                            autoComplete="off"
                            translate="no"
                            disabled={isSubmitting}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              const nextTrimmed = String(nextValue || '').trim();
                              setFieldValue('nickname', nextValue);

                              const changedFromLastAttempt = (
                                investigationGate.username
                                && investigationGate.username.toLowerCase() !== nextTrimmed.toLowerCase()
                              );

                              if (changedFromLastAttempt) {
                                setFieldValue('investigation_status', 'not_attempted');
                                setInvestigationGate({ username: '', completed: false });
                                setInvestigationToken(0);
                                setIsInvestigating(false);
                              }
                            }}
                          />
                        )}
                      </Field>
                      <button
                        type="button"
                        className="rfm-investigate-btn notranslate"
                        translate="no"
                        disabled={!canInvestigate}
                        onClick={() => {
                          setIsInvestigating(true);
                          setFieldValue('investigation_status', 'pending');
                          setFieldValue('rid', '');
                          setFieldValue('crews', '');
                          setFieldValue('aliases', '');
                          setFieldValue('avatar1', '');
                          setFieldValue('avatar2', '');
                          setInvestigationToken((current) => current + 1);
                          setInvestigationGate({
                            username: trimmedUsername,
                            completed: false,
                          });
                        }}
                      >
                        <span className={`rfm-investigate-btn__spinner ${isInvestigating ? '' : 'rfm-investigate-btn__spinner--hidden'}`} aria-hidden="true" />
                        <span className="rfm-button-label">{isInvestigating ? 'Buscando...' : 'Investigar'}</span>
                      </button>
                    </div>
                    <ErrorMessage name="nickname" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
                  </div>
                </div>

                {/* Panel de investigación de antecedentes */}
                {trimmedUsername && !blockedUsername && investigationToken > 0 && (
                  <PlayerBackgroundPanel
                    username={trimmedUsername}
                    investigateToken={investigationToken}
                    onInvestigatingChange={setIsInvestigating}
                    onInvestigationChange={(result) => {
                      const isCurrentInvestigation = (
                        isDemo
                        || (
                          investigationGate.username
                          && investigationGate.username.toLowerCase() === String(values.nickname || '').trim().toLowerCase()
                        )
                      );

                      if (!isCurrentInvestigation) {
                        return;
                      }

                      if (result?.rid) {
                        setFieldValue('investigation_status', 'resolved');
                        setFieldValue('rid', String(result.rid));

                        if (Array.isArray(result?.profile?.aliases) && result.profile.aliases.length > 0) {
                          const aliasText = result.profile.aliases
                            .map((alias) => String(alias || '').trim())
                            .filter(Boolean)
                            .join(', ');
                          if (aliasText) setFieldValue('aliases', aliasText);
                        }

                        const avatars = Array.isArray(result?.avatares) ? result.avatares : [];
                        if (avatars[0]?.avatarUrl) setFieldValue('avatar1', avatars[0].avatarUrl);
                        if (avatars[1]?.avatarUrl) setFieldValue('avatar2', avatars[1].avatarUrl);
                        setInvestigationGate((current) => ({ ...current, completed: true }));
                        return;
                      }

                      setFieldValue('investigation_status', 'not_found');
                      setInvestigationGate((current) => ({ ...current, completed: true }));
                    }}
                  />
                )}

                {!canShowFullForm && (
                  <div className="rfm-panel" style={{ borderLeftColor: 'rgba(0,255,255,0.45)' }}>
                    <div className="rfm-note" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
                      Primero investiga al jugador para desbloquear el formulario completo. Si no se encuentra RID, podrás continuar igual con RID opcional.
                    </div>
                  </div>
                )}

                {canShowFullForm && (
                  <>
                    <div className="rfm-panel">
                      <div className="rfm-panel__title">
                        Datos del jugador (editable)
                        <Tooltip text="Completa las crews separadas por coma. Se generara un enlace de Social Club para cada una.">
                          <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 15, height: 15, opacity: 0.6 }} /></span>
                        </Tooltip>
                      </div>

                      <div className="rfm-field-row" style={{ marginBottom: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="rid" className="form-group__label">RID</label>
                          <Field
                            type="text"
                            id="rid"
                            name="rid"
                            className="form-group__input"
                            placeholder={values.investigation_status === 'not_found' ? 'RID opcional si lo conoces' : 'RID detectado por investigacion'}
                            autoComplete="off"
                            disabled={isSubmitting || values.investigation_status === 'resolved'}
                          />
                          <div className="form-group__hint" style={{ fontSize: '0.74rem' }}>
                            {values.investigation_status === 'resolved'
                              ? 'RID bloqueado: fue asignado por la investigacion.'
                              : 'RID opcional: solo asignable cuando la investigacion no lo encuentra.'}
                          </div>
                          <ErrorMessage name="rid" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="crews" className="form-group__label">Crews</label>
                          <Field
                            type="text"
                            id="crews"
                            name="crews"
                            className="form-group__input"
                            placeholder="Ej: Kaiths Rebels, Crew Secundaria"
                            autoComplete="off"
                            disabled={isSubmitting}
                          />
                          <ErrorMessage name="crews" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
                        </div>
                      </div>

                      <div className="rfm-note" style={{ marginTop: '0.45rem' }}>
                        Las crews son opcionales. Separa multiples nombres con coma.
                      </div>
                    </div>

                    <div className="rfm-panel">
                      <div className="rfm-panel__title">
                        Tipo(s) de Infracción
                        <Tooltip text="Selecciona una o varias categorías que describan la infracción.">
                          <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 15, height: 15, opacity: 0.6 }} /></span>
                        </Tooltip>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <TipoInfraccionSelector
                          value={values.typesOfInfraction}
                          onChange={nuevas => { setFieldValue('typesOfInfraction', nuevas); setFieldValue('labels', []); }}
                          options={TIPOS_ETIQUETAS}
                          disabled={isSubmitting}
                        />
                        <div className="rfm-note">Seleccionadas: {values.typesOfInfraction.length} categoría(s)</div>
                        <ErrorMessage name="typesOfInfraction" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
                      </div>
                    </div>

                    {/* ── MOTIVO + EVIDENCIAS en la misma fila ── */}
                    <div className="rfm-motivo-row">
                      <div className="rfm-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="rfm-panel__title">
                          Motivo del Reporte
                          <Tooltip text="Describe con detalle lo que sucedió: ¿qué hizo, cuándo, dónde?">
                            <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 15, height: 15, opacity: 0.6 }} /></span>
                          </Tooltip>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Field
                            as="textarea"
                            id="reason"
                            name="reason"
                            className="form-group__textarea"
                            aria-label="Motivo del Reporte"
                            placeholder="Describe lo que viste: qué hizo, cuándo, en qué sesión..."
                            maxLength={500}
                            disabled={isSubmitting}
                            style={{ flex: 1, resize: 'none' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <ErrorMessage name="reason" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
                            <span className="form-group__hint" style={{ marginLeft: 'auto' }}>{values.reason.length}/500</span>
                          </div>
                        </div>
                      </div>

                      <div className="rfm-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="rfm-panel__title">
                          📎 Adjuntar Evidencias
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(0,255,255,0.45)', fontWeight: 400, textTransform: 'none', letterSpacing: '0.05em', marginLeft: '0.4rem' }}>opcional</span>
                          <Tooltip text="Arrastra imágenes, selecciona archivos o pega con Ctrl+V. Hasta 5 imágenes, máx. 5MB c/u.">
                            <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 16, height: 16 }} /></span>
                          </Tooltip>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <ImageUpload ref={imageUploadRef} onImagesChange={setImages} maxImages={5} globalPaste={false} disabled={isSubmitting} />
                        </div>
                        <span className="form-group__hint" style={{ fontSize: '0.8em', color: '#9a9a9a', fontStyle: 'italic', display: 'block', marginTop: '0.4rem', flexShrink: 0 }}>
                          JPG, PNG, GIF, WEBP · máx. 5MB
                        </span>
                      </div>
                    </div>

                    {/* ── ETIQUETAS: visibles cuando hay categorías seleccionadas ── */}
                    {values.typesOfInfraction.length > 0 && (
                      <div className="rfm-panel">
                        <div className="rfm-panel__title">Etiquetas de amenaza</div>
                        <EtiquetasSelector
                          categorias={values.typesOfInfraction}
                          etiquetas={values.labels}
                          setFieldValue={setFieldValue}
                          tiposEtiquetas={TIPOS_ETIQUETAS}
                          disabled={isSubmitting}
                        />
                      </div>
                    )}

                    {/* ── DATOS ADICIONALES (COLAPSABLE) ── */}
                    <button
                      type="button"
                      className="rfm-optional-toggle notranslate"
                      translate="no"
                      onClick={() => setShowOptional(v => !v)}
                      disabled={isSubmitting}
                    >
                      <span className="rfm-optional-toggle__arrow">{showOptional ? '▾' : '▸'}</span>
                      Datos adicionales
                      <span className="rfm-optional-toggle__badge">contacto</span>
                      <span className="rfm-optional-toggle__label">{showOptional ? 'ocultar' : 'opcional'}</span>
                    </button>

                    {showOptional && (
                      <div className="rfm-panel">
                        <div className="rfm-panel__title">
                          Tu contacto
                          <Tooltip text="Opcional. Solo el staff podrá verlo si necesitan contactarte para dar seguimiento.">
                            <span style={{ cursor: 'help' }}><HelpIcon style={{ width: 15, height: 15, opacity: 0.6 }} /></span>
                          </Tooltip>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <Field type="text" id="reportedby" name="reportedby" className="form-group__input" placeholder="Tu Discord, Gamertag, etc." maxLength={50} autoComplete="off" disabled={isSubmitting} />
                          <div className="form-group__hint form-group__hint--privacy">
                            Tu identidad está protegida. Solo se usará para seguimiento interno.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rfm-submit-wrap">
                      <button
                        type="submit"
                        className="form__submit notranslate"
                        translate="no"
                        disabled={isSubmitting}
                        style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
                      >
                        <span className="rfm-button-label">{isSubmitting ? '⏳ Enviando...' : '📨 Enviar Reporte a H.E.X.'}</span>
                      </button>
                    </div>

                  </>
                )}

              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default ReportFormModal;
