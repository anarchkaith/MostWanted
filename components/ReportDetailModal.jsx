import { useCallback, useState } from 'react';
import Modal from './ui/Modal';
import ImageViewer from './ImageViewer';
import VoteSystem from './VoteSystem';
import ReportShareLink from './reports/ReportShareLink';
import ReportSummary, { ReportValidation } from './reports/ReportSummary';
import ReportEvidenceGallery from './reports/ReportEvidenceGallery';
import { formatReportDate } from '../src/services/casePresentation';

export default function ReportDetailModal({ reporte, onClose, onVote }) {
  const [expandedImage, setExpandedImage] = useState(null);
  const closeImage = useCallback(() => setExpandedImage(null), []);
  if (!reporte) return null;
  return <>
    <Modal title={`REPORTE #${reporte.id}`} onClose={onClose} closeLabel="Cerrar modal"
      headerContent={<div className="report-detail__date">📅 {formatReportDate(reporte.fecha)}</div>}
      afterHeader={<ReportShareLink reportId={reporte.id} />}
      overlayProps={{
        'data-ui-sound': 'reject',
        onClick: event => { if (event.target === event.currentTarget) onClose(); },
      }}>
      <ReportSummary report={reporte} />
      <div className="report-detail__field">
        <div className="report-detail__label">Evidencias</div>
        <ReportEvidenceGallery report={reporte} onOpen={setExpandedImage} />
      </div>
      <ReportValidation report={reporte} />
      <VoteSystem key={reporte.id} reporteId={reporte.id} votos={reporte.votos} userVote={reporte.userVote} onVote={onVote} umbralVerificacion={5} />
    </Modal>
    {expandedImage && <ImageViewer image={expandedImage} onClose={closeImage} variant="evidence" />}
  </>;
}
