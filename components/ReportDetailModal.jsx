import { useCallback, useEffect, useState } from 'react';
import Modal from './ui/Modal';
import ImageViewer from './ImageViewer';
import VoteSystem from './VoteSystem';
import ReportShareLink from './reports/ReportShareLink';
import ReportSummary from './reports/ReportSummary';
import ReportEvidenceGallery from './reports/ReportEvidenceGallery';
import { formatReportDate } from '../src/services/casePresentation';
import SpecialText from './ui/SpecialText';
import SpecialTextContent from './ui/SpecialTextContent';
import { requestReportEdit } from '../src/services/reportEditing';
import ReportEditForm from './reports/ReportEditForm';

export default function ReportDetailModal({ reporte, onClose, onVote, currentUser, onUpdated }) {
  const [expandedImage, setExpandedImage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');
  const [permissionRevision, setPermissionRevision] = useState(0);
  const closeImage = useCallback(() => setExpandedImage(null), []);
  useEffect(() => {
    if (!currentUser?.id || !reporte?.id) return;
    const controller = new AbortController();
    setEditError('');
    requestReportEdit(reporte.id, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setEditor(result);
    }).catch(error => {
      if (!controller.signal.aborted) setEditError(error.message);
    });
    return () => controller.abort();
  }, [currentUser?.id, reporte?.id, permissionRevision]);
  if (!reporte) return null;
  return <>
    <Modal title={<SpecialText>{`REPORTE #${reporte.id}`}</SpecialText>} onClose={onClose} closeLabel="Cerrar modal"
      headerContent={<SpecialTextContent><div className="report-detail__date">📅 {formatReportDate(reporte.fecha)}</div></SpecialTextContent>}
      afterHeader={<ReportShareLink reportId={reporte.id} />}
      overlayProps={{
        'data-ui-sound': 'reject',
        onClick: event => { if (event.target === event.currentTarget) onClose(); },
      }}>
      {editError && <p className="rfm-submit-error" role="alert">{editError}{' '}
        <button type="button" className="cyber-button-small mw-cyber-button" onClick={() => setPermissionRevision(value => value + 1)}>Reintentar permisos</button></p>}
      {notice && <p role="status">{notice}</p>}
      {editing ? <ReportEditForm key={editor.revision} editor={editor} onCancel={() => {
        setEditing(false);
        setEditor(null);
        setPermissionRevision(value => value + 1);
      }} onSaved={result => {
        setEditor(result);
        setEditing(false);
        setNotice(result.warning || 'Cambios guardados.');
        onUpdated?.(result.report);
      }} /> : <>
      {editor?.canEdit && <button type="button" className="cyber-button-small mw-cyber-button" onClick={() => { setNotice(''); setEditing(true); }}>Editar reporte</button>}
      <ReportSummary report={reporte} onOpenAvatar={image => setExpandedImage({ ...image, variant: 'avatar' })} />
      <div className="report-detail__field">
        <div className="report-detail__label"><SpecialText>Evidencias</SpecialText></div>
        <ReportEvidenceGallery report={reporte} onOpen={setExpandedImage} />
      </div>
      <VoteSystem key={reporte.id} reporteId={reporte.id} votos={reporte.votos} userVote={reporte.userVote} onVote={onVote} umbralVerificacion={5} />
      </>}
    </Modal>
    {expandedImage && <ImageViewer image={expandedImage} onClose={closeImage} variant={expandedImage.variant || 'evidence'} />}
  </>;
}
