import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import ReportPlayerIdentity from '../ReportPlayerIdentity';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialTextContent from '../ui/SpecialTextContent';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import { firstInvalidReportStep, REPORT_EVIDENCE_STEP, REPORT_INFRACTION_STEP, REPORT_WIZARD_STEPS, reportStepIssues } from '../../src/services/reportWizard.js';
import ReportAdditionalDetails from './ReportAdditionalDetails';
import { ReportBehaviorFields, ReportInfractionFields } from './ReportInfractionFields';
import ReportEvidenceFields from './ReportEvidenceFields';
import ReportInfractionPreload from './ReportInfractionPreload';
import SubmitErrorMessage from './SubmitErrorMessage';
import { applyInfractionSuggestion, removeInfractionSuggestion } from '../../src/services/reportKeywords.js';
import { parseVideoLinks } from '../../shared/videoLinks.js';

function StepIndicator({ currentStep, onSelect, disabled }) {
  return <ol className="wizard-steps" aria-label="Progreso del reporte" style={{ gridTemplateColumns: `repeat(${REPORT_WIZARD_STEPS.length}, 1fr)` }}>
    {REPORT_WIZARD_STEPS.map((step, index) => {
      const content = <>
        <span className={`wizard-step__number${currentStep === index ? ' wizard-step__number--active' : currentStep > index ? ' wizard-step__number--done' : ''}`}>
          {currentStep > index ? '✓' : index + 1}
        </span>
        <span className="wizard-step__label">{step.label}</span>
      </>;
      return <li key={step.id} className="wizard-step" aria-current={currentStep === index ? 'step' : undefined}>
        {currentStep > index
          ? <button type="button" className="wizard-step__button" disabled={disabled}
            aria-label={`Volver al paso ${index + 1}: ${step.label}`} onClick={() => onSelect(index)}>{content}</button>
          : content}
      </li>;
    })}
  </ol>;
}

function ReviewDialog({ open, values, images, isSubmitting, onEdit, onConfirm, confirmRef }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const categories = values.typesOfInfraction.map(key => TIPOS_ETIQUETAS.find(type => type.key === key)?.nombre || key);
  const optional = [['RID', values.rid], ['Crews', values.crews], ['Otros nombres', values.aliases]].filter(([, value]) => value);
  const videoLinkCount = parseVideoLinks(values.videoLinks).links.length;
  return <dialog ref={dialogRef} className="wizard-review-dialog" aria-labelledby="wizard-review-title"
    onCancel={event => { event.preventDefault(); if (!isSubmitting) onEdit(); }}>
    {open && <div className="wizard-review-dialog__panel">
      <header className="wizard-review-dialog__header">
        <p className="wizard-review-dialog__eyebrow">Último vistazo</p>
        <h3 id="wizard-review-title" className="wizard-review-dialog__title">¿Todo en orden?</h3>
      </header>
      <dl className="wizard-review__list">
        <div className="wizard-review__row wizard-review__row--target">
          <dt>Jugador</dt><dd className="notranslate" translate="no">{values.nickname}</dd>
        </div>
        {optional.map(([label, value]) => <div key={label} className="wizard-review__row"><dt>{label}</dt><dd>{value}</dd></div>)}
        <div className="wizard-review__row">
          <dt>Infracciones</dt>
          <dd><ul className="wizard-review__chips">
            {categories.map(name => <li key={name}>{name}</li>)}
            {values.labels.map(label => <li key={label} className="wizard-review__chip--soft">{label}</li>)}
          </ul></dd>
        </div>
        <div className="wizard-review__row"><dt>Lo que pasó</dt><dd className="wizard-review__reason">{values.reason}</dd></div>
        <div className="wizard-review__row">
          <dt>Pruebas</dt>
          <dd>{images.length ? `${images.length} ${images.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}` : <span className="wizard-review__warn">Sin imágenes · tu reporte tendrá menos peso</span>}
            {videoLinkCount > 0 && <> · {videoLinkCount} {videoLinkCount === 1 ? 'link de video' : 'links de video'}</>}</dd>
        </div>
      </dl>
      <footer className="wizard-review-dialog__footer">
        <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"
          onClick={onEdit} disabled={isSubmitting}>
          <CyberButtonLabel>Editar</CyberButtonLabel>
        </button>
        <button ref={confirmRef} type="button" className="cyber-button mw-cyber-button" onClick={onConfirm} disabled={isSubmitting}>
          <CyberButtonLabel>{isSubmitting ? 'Enviando...' : 'Enviar reporte'}</CyberButtonLabel>
        </button>
      </footer>
    </div>}
  </dialog>;
}

export default function ReportFormWizard({
  initialPlayer, isDemo, onPaste, imageUploadRef, images, onImagesChange,
  evidenceBlocked, onEvidenceBlockedChange, submitError, submitRetryAt, submitErrorRef, submitButtonRef,
}) {
  const { values, touched, isSubmitting, setTouched, setFieldValue, validateForm, submitForm } = useFormikContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [suggestion, setSuggestion] = useState(null);
  const [ridLocked] = useState(() => Boolean(values.rid || initialPlayer?.rid));
  const [validationMessages, setValidationMessages] = useState([]);
  const [checking, setChecking] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const checkingRef = useRef(false);
  const confirmRef = useRef(null);
  const titleRef = useRef(null);
  const validationRef = useRef(null);
  const focusValidationRef = useRef(false);
  const liveValidationRef = useRef(false);
  const firstRender = useRef(true);
  const step = REPORT_WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === REPORT_WIZARD_STEPS.length - 1;

  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else titleRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (validationMessages.length && focusValidationRef.current) {
      focusValidationRef.current = false;
      validationRef.current?.focus();
    }
  }, [validationMessages]);

  useEffect(() => {
    if (!liveValidationRef.current) return undefined;
    let active = true;
    validateForm().then(errors => {
      if (!active || !liveValidationRef.current) return;
      setValidationMessages(reportStepIssues(errors, currentStep).flatMap(issue => issue.messages));
    });
    return () => { active = false; };
  }, [values, currentStep, validateForm]);

  const goToStep = index => {
    liveValidationRef.current = false;
    setValidationMessages([]);
    setCurrentStep(index);
  };

  const showIssues = async (issues, index) => {
    await setTouched({
      ...touched,
      ...Object.fromEntries(issues.map(issue => [issue.field, true])),
    }, false);
    setCurrentStep(index);
    focusValidationRef.current = true;
    liveValidationRef.current = true;
    setValidationMessages(issues.flatMap(issue => issue.messages));
  };

  const applyHexSuggestion = () => {
    const next = applyInfractionSuggestion({
      text: values.reason,
      catalog: TIPOS_ETIQUETAS,
      typesOfInfraction: values.typesOfInfraction,
      labels: values.labels,
      previous: suggestion,
    });
    setFieldValue('typesOfInfraction', next.typesOfInfraction);
    setFieldValue('labels', next.labels);
    setSuggestion(next.applied);
  };

  const undoHexSuggestion = () => {
    const next = removeInfractionSuggestion({
      typesOfInfraction: values.typesOfInfraction,
      labels: values.labels,
      applied: suggestion,
    });
    setFieldValue('typesOfInfraction', next.typesOfInfraction);
    setFieldValue('labels', next.labels);
    setSuggestion(null);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (checkingRef.current || isSubmitting) return;
    checkingRef.current = true;
    liveValidationRef.current = false;
    setChecking(true);
    try {
      if (currentStep >= REPORT_EVIDENCE_STEP && evidenceBlocked) {
        setCurrentStep(REPORT_EVIDENCE_STEP);
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

      if (isLastStep) {
        setValidationMessages([]);
        setReviewOpen(true);
      } else {
        if (currentStep === REPORT_EVIDENCE_STEP) applyHexSuggestion();
        goToStep(currentStep + 1);
      }
    } catch (error) {
      console.error('[reports] No se pudo validar o enviar el reporte.', error);
      setValidationMessages(['No se pudo procesar el reporte. Revisa los datos e inténtalo de nuevo.']);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  const confirmSubmit = async () => {
    if (isSubmitting) return;
    try {
      await submitForm();
    } finally {
      setReviewOpen(false);
    }
  };

  return <div className="report-wizard">
    <form className="report-form" noValidate onPaste={onPaste} onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <div className="report-wizard__container">
        {isDemo && <div className="cyber-banner-short mw-cyber-banner">
          <span><SpecialTextContent><strong>Modo de demostración</strong></SpecialTextContent> Datos de prueba. Los envíos son reales.</span>
        </div>}
        <StepIndicator currentStep={currentStep} onSelect={goToStep} disabled={isSubmitting || checking} />
        <div className="wizard-step-header">
          <p className="wizard-step-header__progress">Paso {currentStep + 1} de {REPORT_WIZARD_STEPS.length}</p>
          <h3 ref={titleRef} tabIndex={-1} className="wizard-step-header__title">{step.title}</h3>
          <p className="wizard-step-header__description">{step.description}</p>
        </div>
        {isSubmitting && <div className="rfm-submitting" role="status" aria-live="polite">
          <div className="rfm-submitting__spinner" aria-hidden="true" />
          <span className="rfm-submitting__label">Enviando reporte...</span>
        </div>}
        {submitError && <SubmitErrorMessage message={submitError} retryAt={submitRetryAt} errorRef={submitErrorRef} />}
        {validationMessages.length > 0 && <div ref={validationRef} className="rfm-submit-error" role="alert" tabIndex={-1}>
          <strong>Revisa estos datos para continuar:</strong>
          <ul>{validationMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
        </div>}

        <div className="report-wizard__content">
          <div className="wizard-section" hidden={currentStep !== REPORT_EVIDENCE_STEP}>
            <ReportPlayerIdentity initialPlayer={initialPlayer} ridLocked={ridLocked}>
              <ReportAdditionalDetails variant="inline" ridLocked={ridLocked} />
            </ReportPlayerIdentity>
            <ReportEvidenceFields imageUploadRef={imageUploadRef} onImagesChange={onImagesChange}
              showVideoLinks
              onBlockedChange={onEvidenceBlockedChange} />
          </div>
          <div className="wizard-section" hidden={currentStep !== REPORT_INFRACTION_STEP}>
            <ReportInfractionPreload applied={suggestion} onUndo={undoHexSuggestion} />
            <ReportInfractionFields />
            <ReportBehaviorFields />
          </div>
        </div>

        <div className="report-wizard__footer">
          <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"
            onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0 || isSubmitting || checking}>
            <CyberButtonLabel>← Anterior</CyberButtonLabel>
          </button>
          <button ref={submitButtonRef} type="submit"
            className="cyber-button mw-cyber-button" disabled={isSubmitting || checking}>
            <CyberButtonLabel>{isSubmitting ? 'Enviando...' : isLastStep ? 'Revisar y enviar' : 'Siguiente →'}</CyberButtonLabel>
          </button>
        </div>
      </div>
      <ReviewDialog open={reviewOpen} values={values} images={images} isSubmitting={isSubmitting}
        onEdit={() => setReviewOpen(false)} onConfirm={confirmSubmit} confirmRef={confirmRef} />
    </form>
  </div>;
}
