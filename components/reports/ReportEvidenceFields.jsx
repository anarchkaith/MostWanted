import { ErrorMessage, Field, useFormikContext } from 'formik';
import ImageUpload from '../ImageUpload';

export default function ReportEvidenceFields({ imageUploadRef, onImagesChange }) {
  const { values, errors, touched, isSubmitting } = useFormikContext();
  return <div className="rfm-motivo-row">
    <div className="rfm-panel mw-cyber-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
      <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Motivo</h3>
      <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="cyber-input-full mw-cyber-input rfm-reason-input">
          <Field as="textarea" id="reason" name="reason" aria-invalid={Boolean(touched.reason && errors.reason)}
            className="form-group__textarea" aria-label="Motivo del Reporte"
            placeholder="Describe lo que viste: qué hizo, cuándo, en qué sesión..." maxLength={500}
            disabled={isSubmitting} style={{ flex: 1, resize: 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <ErrorMessage name="reason" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
          <span className="form-group__hint" style={{ marginLeft: 'auto' }}>{values.reason.length}/500</span>
        </div>
      </div>
    </div>
    <div className="rfm-panel mw-cyber-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
      <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Evidencias<span className="rfm-optional">Opcional</span></h3>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ImageUpload ref={imageUploadRef} onImagesChange={onImagesChange} maxImages={5} globalPaste={false} disabled={isSubmitting} />
      </div>
    </div>
  </div>;
}
