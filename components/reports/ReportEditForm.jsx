import { useRef, useState } from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { reportFormValidationSchema } from '../reportFormValidation';
import { reportEditDraft, saveReportEdits, requestReportEdit } from '../../src/services/reportEditing';
import { uploadEvidenceImages } from '../../src/services/reportSubmissionService';
import { reportEvidence } from '../../src/services/reportEvidence';
import ReportFormFields from './ReportFormFields';

export default function ReportEditForm({ editor, onSaved, onCancel }) {
  const report = editor.report;
  const [images, setImages] = useState([]);
  const [originals, setOriginals] = useState(() => (report.evidence || []).map((_, index) => index));
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const imageUploadRef = useRef(null);
  const errorRef = useRef(null);
  const submitRef = useRef(null);
  const draft = reportEditDraft(report);
  const evidence = reportEvidence(report);
  const validationSchema = reportFormValidationSchema.pick(['nickname', 'crews', 'typesOfInfraction', 'labels']).shape({
    reason: Yup.string().required('El motivo es obligatorio')
      .test('reason-length', 'El motivo debe tener entre 10 y 500 caracteres.', value =>
        value === draft.reason || (value?.trim().length >= 10 && value.length <= Math.max(500, draft.reason.length))),
  });
  return <Formik initialValues={draft} validationSchema={validationSchema} onSubmit={async values => {
    setError('');
    try {
      const evidenceError = imageUploadRef.current?.getValidationError();
      if (evidenceError) throw new Error(evidenceError);
      const result = await saveReportEdits({
        values, originalEvidence: originals, images: imageUploadRef.current?.getImages() || images,
        revision: editor.revision,
        upload: files => uploadEvidenceImages(files, import.meta.env.VITE_API_KEY_IMGBB),
        save: changes => requestReportEdit(report.id, changes),
      });
      onSaved(result);
    } catch (cause) {
      setError(cause.message || 'No se pudieron guardar los cambios.');
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }}>
    {({ isSubmitting }) => <>
      <p className="rfm-note">Editando el reporte #{report.id}. Se conservan su autoría, fecha, votos y cuenta asociada.</p>
      <ReportFormFields editMode initialPlayer={{ rid: report.rid, investigationCompleted: true }}
        imageUploadRef={imageUploadRef} onImagesChange={setImages}
        evidenceBlocked={blocked} onEvidenceBlockedChange={setBlocked}
        submitError={error} submitErrorRef={errorRef} submitButtonRef={submitRef}
        maxImages={Math.max(5, (report.evidence || []).length) - originals.length}
        maxReasonLength={Math.max(500, draft.reason.length)}
        existingEvidence={<div className="report-detail__field">
          {originals.map(index => <div key={index}>
            {evidence[index]?.src
              ? <a href={evidence[index].src} target="_blank" rel="noopener noreferrer">{evidence[index].label}</a>
              : <span>Referencia antigua sin URL disponible.</span>}
            {' '}<button type="button" className="cyber-button-small mw-cyber-button" disabled={isSubmitting}
              onClick={() => setOriginals(current => current.filter(item => item !== index))}>Quitar evidencia {index + 1}</button>
          </div>)}
        </div>} />
      <button type="button" className="cyber-button-small mw-cyber-button" disabled={isSubmitting} onClick={onCancel}>Cancelar edición</button>
    </>}
  </Formik>;
}
