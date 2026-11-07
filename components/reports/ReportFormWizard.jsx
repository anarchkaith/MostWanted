import { useState, useRef } from 'react';
import { Formik } from 'formik';
import { reportFormValidationSchema } from '../reportFormValidation';
import { reportPlayerDraft } from '../../src/services/reportPlayerDraft';
import useReportSubmission from '../../src/hooks/useReportSubmission';
import ReportSubmissionConfirmation from './ReportSubmissionConfirmation';
import ReportPlayerIdentity from '../ReportPlayerIdentity';
import ReportAdditionalDetails from './ReportAdditionalDetails';
import { ReportBehaviorFields, ReportInfractionFields } from './ReportInfractionFields';
import ReportEvidenceFields from './ReportEvidenceFields';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialTextContent from '../ui/SpecialTextContent';

const initialValues = {
  investigation_status: 'not_attempted',
  nickname: '',
  crews: '',
  avatar1: '',
  avatar2: '',
  rid: '',
  ip: '',
  aliases: '',
  time: '',
  typesOfInfraction: [],
  reason: '',
  evidence: [],
  labels: [],
};

const demoValues = {
  ...initialValues,
  investigation_status: 'resolved',
  nickname: '[DEMO] DemoPlayer_GTA',
  crews: '[DEMO] Rebels Elite, [DEMO] Demo Crew 1, [DEMO] Demo Crew 2',
  rid: '12345',
  ip: '192.168.1.1',
  aliases: '[DEMO] AltPlayer, DemoAlt',
  time: '1640000000',
  typesOfInfraction: ['MODDER'],
  reason: '[REPORTE DE PRUEBA - NO VÁLIDO] Este es un reporte de demostración generado automáticamente para testear el formulario.',
  labels: ['Aimbot', 'Godmode (hack)'],
};

const STEPS = [
  {
    id: 'identity',
    title: '🔍 Identificar al Jugador',
    subtitle: '¿Quién es?',
    description: 'Busca por nickname, RID o alias.',
  },
  {
    id: 'infraction',
    title: '📝 ¿Qué hizo?',
    subtitle: 'Describe la infracción',
    description: 'Aimbot, Godmode, Kick, etc.',
  },
  {
    id: 'evidence',
    title: '📸 Pruebas',
    subtitle: 'Adjunta evidencias',
    description: 'Una captura o video es mucho más convincente.',
  },
  {
    id: 'review',
    title: '✅ Revisar',
    subtitle: 'Último vistazo',
    description: 'Asegúrate de que todo sea correcto.',
  },
];

function StepIndicator({ steps, currentStep }) {
  return (
    <div className="wizard-steps">
      {steps.map((step, idx) => (
        <div key={step.id} className="wizard-step">
          <div className={`wizard-step__number ${currentStep === idx ? 'wizard-step__number--active' : currentStep > idx ? 'wizard-step__number--done' : ''}`}>
            {currentStep > idx ? '✓' : idx + 1}
          </div>
          <div className="wizard-step__label">{step.id === 'identity' ? 'Jugador' : step.id === 'infraction' ? 'Infracción' : step.id === 'evidence' ? 'Pruebas' : 'Revisar'}</div>
        </div>
      ))}
    </div>
  );
}

function StepHeader({ step }) {
  return (
    <div className="wizard-step-header">
      <h3 className="wizard-step-header__title">{step.title}</h3>
      <p className="wizard-step-header__subtitle">{step.subtitle}</p>
      <p className="wizard-step-header__description">{step.description}</p>
    </div>
  );
}

export default function ReportFormWizard({
  onSubmit,
  currentUser = null,
  isDemo = false,
  initialPlayer = null,
  onReturnToCase = null,
}) {
  const imageUploadRef = useRef(null);
  const [images, setImages] = useState([]);
  const [evidenceBlocked, setEvidenceBlocked] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const playerDraft = initialPlayer ? reportPlayerDraft(initialPlayer) : null;
  const formikRef = useRef(null);
  const submitErrorRef = useRef(null);
  const submitButtonRef = useRef(null);

  const { submit, error: submitError, confirmation, closeConfirmation } = useReportSubmission({
    user: currentUser,
    images,
    onSaved: onSubmit,
    imageUploadRef,
  });

  const handleGlobalPaste = (event) => {
    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;
    if (Array.from(clipboardItems).some(item => item.type.startsWith('image/'))) {
      imageUploadRef.current?.addFilesFromPaste?.(event);
    }
  };

  const handleAccept = () => {
    formikRef.current?.resetForm();
    setImages([]);
    imageUploadRef.current?.clearImages?.();
    closeConfirmation();
    onReturnToCase?.();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="report-wizard">
      {confirmation && (
        <ReportSubmissionConfirmation
          result={confirmation}
          onClose={closeConfirmation}
          onAccept={handleAccept}
          canReturn={Boolean(onReturnToCase)}
          returnFocusRef={submitButtonRef}
        />
      )}

      <Formik
        innerRef={formikRef}
        initialValues={playerDraft ? { ...initialValues, ...playerDraft } : isDemo ? demoValues : initialValues}
        validationSchema={reportFormValidationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            await submit(values);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting }) => (
          <form className="report-form" noValidate onPaste={handleGlobalPaste}>
            <div className="report-wizard__container">
              {/* Demo banner */}
              {isDemo && (
                <div className="cyber-banner-short mw-cyber-banner">
                  <span><SpecialTextContent><strong>Modo de demostración</strong></SpecialTextContent> Datos de prueba. Los envíos son reales.</span>
                </div>
              )}

              {/* Indicador de pasos */}
              <StepIndicator steps={STEPS} currentStep={currentStep} />

              {/* Encabezado del paso */}
              <StepHeader step={step} />

              {/* Submitting overlay */}
              {isSubmitting && (
                <div className="rfm-submitting" role="status" aria-live="polite">
                  <div className="rfm-submitting__spinner" aria-hidden="true" />
                  <span className="rfm-submitting__label">Enviando reporte...</span>
                </div>
              )}

              {/* Error message */}
              {submitError && (
                <div ref={submitErrorRef} className="rfm-submit-error" role="alert" tabIndex={-1}>
                  ⚠ {submitError}
                </div>
              )}

              {/* Contenido del paso */}
              <div className="report-wizard__content">
                {(step.id === 'identity' || currentStep === 0) && (
                  <ReportPlayerIdentity initialPlayer={initialPlayer} editMode={false} />
                )}

                {(step.id === 'infraction' || currentStep === 1) && (
                  <>
                    <ReportAdditionalDetails initialPlayer={initialPlayer} editMode={false} />
                    <ReportInfractionFields />
                    <ReportBehaviorFields />
                  </>
                )}

                {(step.id === 'evidence' || currentStep === 2) && (
                  <ReportEvidenceFields
                    imageUploadRef={imageUploadRef}
                    onImagesChange={setImages}
                    onBlockedChange={setEvidenceBlocked}
                    existingEvidence={[]}
                    maxImages={5}
                    maxReasonLength={500}
                  />
                )}

                {(step.id === 'review' || currentStep === 3) && (
                  <div className="wizard-review">
                    <h4 className="wizard-review__title">Resumen del Reporte</h4>
                    <p className="wizard-review__description">Por favor revisa toda la información antes de enviar.</p>
                    <div className="wizard-review__summary">
                      <div className="wizard-review__section">
                        <h5>Jugador Identificado</h5>
                        <ReportPlayerIdentity initialPlayer={initialPlayer} editMode={false} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie de página con navegación */}
              <div className="report-wizard__footer">
                <button
                  type="button"
                  className="cyber-button-secondary mw-cyber-button"
                  onClick={handlePrev}
                  disabled={isFirstStep || isSubmitting}
                >
                  <CyberButtonLabel>← Anterior</CyberButtonLabel>
                </button>

                <div style={{ flex: 1 }} />

                {!isLastStep ? (
                  <button
                    type="button"
                    className="cyber-button mw-cyber-button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                  >
                    <CyberButtonLabel>Siguiente →</CyberButtonLabel>
                  </button>
                ) : (
                  <button
                    ref={submitButtonRef}
                    type="submit"
                    className="cyber-button mw-cyber-button"
                    disabled={isSubmitting || evidenceBlocked}
                  >
                    <CyberButtonLabel>{isSubmitting ? 'Enviando...' : 'Enviar Reporte'}</CyberButtonLabel>
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}

