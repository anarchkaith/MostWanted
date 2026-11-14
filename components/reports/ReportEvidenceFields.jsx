import { ErrorMessage, Field, useFormikContext } from 'formik';
import ImageUpload from '../ImageUpload';
import ReasonImproveButton from './ReasonImproveButton';
import { MAX_VIDEO_LINKS } from '../../shared/videoLinks.js';

export default function ReportEvidenceFields({ imageUploadRef, onImagesChange, onBlockedChange, existingEvidence, maxImages = 5, maxReasonLength = 500, showVideoLinks = false }) {
  const { values, errors, touched, isSubmitting } = useFormikContext();
  return <div className="rfm-motivo-row">
    <div className="rfm-panel mw-cyber-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
      <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Motivo</h3>
      <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="cyber-input-full mw-cyber-input rfm-reason-input">
          <Field as="textarea" id="reason" name="reason" aria-invalid={Boolean(touched.reason && errors.reason)}
            className="form-group__textarea" aria-label="Motivo del Reporte"
            placeholder="Describe lo que viste: qué hizo, cuándo, en qué sesión..." maxLength={maxReasonLength}
            disabled={isSubmitting} style={{ flex: 1, resize: 'none' }} />
        </div>
        <ReasonImproveButton maxReasonLength={maxReasonLength} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <ErrorMessage name="reason" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
          <span className="form-group__hint" style={{ marginLeft: 'auto' }}>{values.reason.length}/{maxReasonLength}</span>
        </div>
      </div>
    </div>
    <div className="rfm-panel mw-cyber-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
      <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Evidencias<span className="rfm-optional">Opcional</span></h3>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {existingEvidence}
        {maxImages > 0
          ? <ImageUpload ref={imageUploadRef} onImagesChange={onImagesChange} onBlockedChange={onBlockedChange} maxImages={maxImages} globalPaste={false} disabled={isSubmitting} />
          : <p className="rfm-note">Quita una evidencia guardada para añadir otra.</p>}
        {showVideoLinks && <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <label htmlFor="videoLinks" className="form-group__label">Links de video <span className="rfm-optional">Hasta {MAX_VIDEO_LINKS}</span></label>
          <div className="cyber-input-full mw-cyber-input">
            <Field as="textarea" id="videoLinks" name="videoLinks" rows={2} disabled={isSubmitting}
              aria-invalid={Boolean(touched.videoLinks && errors.videoLinks)} aria-describedby="videoLinks-hint"
              className="form-group__textarea" placeholder={'https://youtu.be/...\nhttps://medal.tv/...'} style={{ resize: 'vertical' }} />
          </div>
          <span id="videoLinks-hint" className="form-group__hint">YouTube, Medal, Streamable u otro sitio. Uno por línea.</span>
          <ErrorMessage name="videoLinks" component="span" className="form-group__hint" style={{ color: '#ff3333', display: 'block' }} />
        </div>}
      </div>
    </div>
  </div>;
}
