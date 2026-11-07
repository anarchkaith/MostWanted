import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import ReportPlayerIdentity from '../ReportPlayerIdentity';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialTextContent from '../ui/SpecialTextContent';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import { firstInvalidReportStep, REPORT_WIZARD_STEPS, reportStepIssues } from '../../src/services/reportWizard.js';
import ReportAdditionalDetails from './ReportAdditionalDetails';
import { ReportBehaviorFields, ReportInfractionFields } from './ReportInfractionFields';
import ReportEvidenceFields from './ReportEvidenceFields';

function StepIndicator({ currentStep }) {
  return <ol className="wizard-steps" aria-label="Progreso del reporte">
    {REPORT_WIZARD_STEPS.map((step, index) => <li key={step.id} className="wizard-step"
      aria-current={currentStep === index ? 'step' : undefined}>
      <span className={`wizard-step__number${currentStep === index ? ' wizard-step__number--active' : currentStep > index ? ' wizard-step__number--done' : ''}`}>
        {currentStep > index ? '✓' : index + 1}
      </span>
      <span className="wizard-step__label">{step.label}</span>
    </li>)}
  </ol>;
}

function Review({ values, images }) {
  const categories = values.typesOfInfraction.map(key => TIPOS_ETIQUETAS.find(type => type.key === key)?.nombre || key);
  return <section className="wizard-review" aria-label="Resumen del reporte">
    <dl className="wizard-review__list">
      <div><dt>Jugador</dt><dd className="notranslate" translate="no">{values.nickname}</dd></div>
      <div><dt>RID</dt><dd>{values.rid || 'No especificado'}</dd></div>
      <div><dt>Crews</dt><dd>{values.crews || 'No especificadas'}</dd></div>
      <div><dt>Otros nombres</dt><dd>{values.aliases || 'No especificados'}</dd></div>
      <div><dt>Infracciones</dt><dd>{categories.join(', ')}</dd></div>
      <div><dt>Conductas</dt><dd>{values.labels.length ? values.labels.join(', ') : 'No especificadas'}</dd></div>
      <div><dt>Motivo</dt><dd className="wizard-review__reason">{values.reason}</dd></div>
      <div><dt>Evidencias</dt><dd>{images.length ? images.map(image => image.name).join(', ') : 'Sin imágenes adjuntas'}</dd></div>
    </dl>
  </section>;
}

export default function ReportFormWizard({
  initialPlayer, isDemo, onPaste, imageUploadRef, images, onImagesChange,
  evidenceBlocked, onEvidenceBlockedChange, submitError, submitErrorRef, submitButtonRef,
}) {
  const { values, touched, isSubmitting, setTouched, validateForm, submitForm } = useFormikContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [showAdditional, setShowAdditional] = useState(false);
  const [validationMessages, setValidationMessages] = useState([]);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const titleRef = useRef(null);
  const validationRef = useRef(null);
  const firstRender = useRef(true);
  const step = REPORT_WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === REPORT_WIZARD_STEPS.length - 1;

  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else titleRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (validationMessages.length) validationRef.current?.focus();
  }, [validationMessages, currentStep]);

  const goToStep = index => {
    setValidationMessages([]);
    setCurrentStep(index);
  };

  const showIssues = async (issues, index) => {
    await setTouched({
      ...touched,
      ...Object.fromEntries(issues.map(issue => [issue.field, true])),
    }, false);
    if (index === 0 && issues.some(issue => issue.field !== 'nickname')) setShowAdditional(true);
    setCurrentStep(index);
    setValidationMessages(issues.flatMap(issue => issue.messages));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (checkingRef.current || isSubmitting) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      if (currentStep >= 2 && evidenceBlocked) {
        setCurrentStep(2);
        setValidationMessages(['Revisa las evidencias o espera a que terminen de procesarse.']);
        return;
      }

      const errors = await validateForm();
      const invalidStep = isLastStep ? firstInvalidReportStep(errors) : currentStep;
      const issues = invalidStep < 0 ? [] : reportStepIssues(errors, invalidStep);
      if (issues.length) {
        await showIssues(issues, invalidStep);
        return;
      }

      if (isLastStep) await submitForm();
      else goToStep(currentStep + 1);
    } catch (error) {
      console.error('[reports] No se pudo validar o enviar el reporte.', error);
      setValidationMessages(['No se pudo procesar el reporte. Revisa los datos e inténtalo de nuevo.']);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  return <div className="report-wizard">
    <form className="report-form" noValidate onPaste={onPaste} onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <div className="report-wizard__container">
        {isDemo && <div className="cyber-banner-short mw-cyber-banner">
          <span><SpecialTextContent><strong>Modo de demostración</strong></SpecialTextContent> Datos de prueba. Los envíos son reales.</span>
        </div>}
        <StepIndicator currentStep={currentStep} />
        <div className="wizard-step-header">
          <p className="wizard-step-header__progress">Paso {currentStep + 1} de {REPORT_WIZARD_STEPS.length}</p>
          <h3 ref={titleRef} tabIndex={-1} className="wizard-step-header__title">{step.title}</h3>
          <p className="wizard-step-header__description">{step.description}</p>
        </div>
        {isSubmitting && <div className="rfm-submitting" role="status" aria-live="polite">
          <div className="rfm-submitting__spinner" aria-hidden="true" />
          <span className="rfm-submitting__label">Enviando reporte...</span>
        </div>}
        {submitError && <div ref={submitErrorRef} className="rfm-submit-error" role="alert" tabIndex={-1}>⚠ {submitError}</div>}
        {validationMessages.length > 0 && <div ref={validationRef} className="rfm-submit-error" role="alert" tabIndex={-1}>
          <strong>Revisa estos datos para continuar:</strong>
          <ul>{validationMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
        </div>}

        <div className="report-wizard__content">
          <div className="wizard-section" hidden={currentStep !== 0}>
            <ReportPlayerIdentity initialPlayer={initialPlayer} />
            <details className="wizard-optional" open={showAdditional} onToggle={event => setShowAdditional(event.currentTarget.open)}>
              <summary>Datos adicionales del jugador <span>Opcional</span></summary>
              <ReportAdditionalDetails initialPlayer={initialPlayer} />
            </details>
          </div>
          <div className="wizard-section" hidden={currentStep !== 1}>
            <ReportInfractionFields />
            <ReportBehaviorFields />
          </div>
          <div className="wizard-section" hidden={currentStep !== 2}>
            <ReportEvidenceFields imageUploadRef={imageUploadRef} onImagesChange={onImagesChange}
              onBlockedChange={onEvidenceBlockedChange} />
          </div>
          <div className="wizard-section" hidden={!isLastStep}>
            <Review values={values} images={images} />
          </div>
        </div>

        <div className="report-wizard__footer">
          <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"
            onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0 || isSubmitting || checking}>
            <CyberButtonLabel>← Anterior</CyberButtonLabel>
          </button>
          <button ref={isLastStep ? submitButtonRef : undefined} type="submit"
            className="cyber-button mw-cyber-button" disabled={isSubmitting || checking}>
            <CyberButtonLabel>{isSubmitting ? 'Enviando...' : isLastStep ? 'Enviar reporte' : 'Siguiente →'}</CyberButtonLabel>
          </button>
        </div>
      </div>
    </form>
  </div>;
}
