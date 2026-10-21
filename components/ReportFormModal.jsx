import { useState, useRef, useCallback, useEffect } from 'react';
import { Formik } from 'formik';
import { reportFormValidationSchema } from './reportFormValidation';
import { reportPlayerDraft } from '../src/services/reportPlayerDraft';
import useReportSubmission from '../src/hooks/useReportSubmission';
import ReportSubmissionConfirmation from './reports/ReportSubmissionConfirmation';
import ReportFormFields from './reports/ReportFormFields';

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
  reason: '[REPORTE DE PRUEBA - NO VÁLIDO] Este es un reporte de demostración generado automáticamente para testear el formulario. El jugador ficticio utilizó Aimbot y Godmode durante una sesión de Freeroam de prueba. Este reporte no debe tomarse en cuenta.',
  labels: ['Aimbot', 'Godmode (hack)'],
};

export default function ReportFormModal({ onSubmit, currentUser = null, isDemo = false, initialPlayer = null, onReturnToCase = null }) {
  const imageUploadRef = useRef(null);
  const [images, setImages] = useState([]);
  const { submit, error: submitError, confirmation, closeConfirmation } = useReportSubmission({
    user: currentUser, images, onSaved: onSubmit,
  });
  const [playerDraft] = useState(() => initialPlayer ? reportPlayerDraft(initialPlayer) : null);
  const formikRef = useRef(null);
  const submitErrorRef = useRef(null);
  const submitButtonRef = useRef(null);

  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  const handleGlobalPaste = useCallback(event => {
    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;
    if (Array.from(clipboardItems).some(item => item.type.startsWith('image/'))) {
      imageUploadRef.current?.addFilesFromPaste(event);
    }
  }, []);

  const handleAccept = () => {
    formikRef.current?.resetForm();
    setImages([]);
    imageUploadRef.current?.clearImages?.();
    closeConfirmation();
    onReturnToCase?.();
  };

  return <div className="rfm-shell">
    {confirmation && <ReportSubmissionConfirmation result={confirmation} onClose={closeConfirmation}
      onAccept={handleAccept} canReturn={Boolean(onReturnToCase)} returnFocusRef={submitButtonRef} />}
    <Formik innerRef={formikRef}
      initialValues={playerDraft ? { ...initialValues, ...playerDraft } : isDemo ? demoValues : initialValues}
      validationSchema={reportFormValidationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await submit(values);
        } finally {
          setSubmitting(false);
        }
      }}>
      <ReportFormFields initialPlayer={initialPlayer} isDemo={isDemo} onPaste={handleGlobalPaste}
        imageUploadRef={imageUploadRef} onImagesChange={setImages} submitError={submitError}
        submitErrorRef={submitErrorRef} submitButtonRef={submitButtonRef} />
    </Formik>
  </div>;
}
