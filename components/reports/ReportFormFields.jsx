import { Form, useFormikContext } from 'formik';
import ReportPlayerIdentity from '../ReportPlayerIdentity';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import ReportAdditionalDetails from './ReportAdditionalDetails';
import { ReportBehaviorFields, ReportInfractionFields } from './ReportInfractionFields';
import ReportEvidenceFields from './ReportEvidenceFields';
import SpecialTextContent from '../ui/SpecialTextContent';

export default function ReportFormFields({ initialPlayer, isDemo, onPaste, imageUploadRef, onImagesChange, submitError, submitErrorRef, submitButtonRef }) {
  const { isSubmitting } = useFormikContext();
  return <Form className="report-form" noValidate onPaste={onPaste} style={{ position: 'relative' }}>
    {isDemo && <div className="cyber-banner-short mw-cyber-banner">
      <span><SpecialTextContent><strong>Modo de demostración</strong></SpecialTextContent> Datos de prueba. Los envíos son reales.</span>
    </div>}
    {isSubmitting && <div className="rfm-submitting" role="status" aria-live="polite">
      <div className="rfm-submitting__spinner" aria-hidden="true" />
      <span className="rfm-submitting__label">Enviando reporte...</span>
    </div>}
    <div className="rfm-stack">
      {submitError && <div ref={submitErrorRef} className="rfm-submit-error" role="alert" tabIndex={-1}>⚠ {submitError}</div>}
      <ReportPlayerIdentity initialPlayer={initialPlayer} />
      <ReportAdditionalDetails initialPlayer={initialPlayer} />
      <ReportInfractionFields />
      <ReportEvidenceFields imageUploadRef={imageUploadRef} onImagesChange={onImagesChange} />
      <ReportBehaviorFields />
      <div className="rfm-submit-wrap">
        <button ref={submitButtonRef} type="submit" className="cyber-button mw-cyber-button notranslate"
          translate="no" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}>
          <CyberButtonLabel>{isSubmitting ? 'Enviando...' : 'Enviar reporte'}</CyberButtonLabel>
        </button>
      </div>
    </div>
  </Form>;
}
