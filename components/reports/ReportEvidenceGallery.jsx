import { useState } from 'react';
import { reportEvidence } from '../../src/services/reportEvidence';
import Skeleton from '../ui/Skeleton';

function EvidenceItem({ item, onOpen }) {
  const [status, setStatus] = useState('loading');
  const isImage = item.type.toLowerCase().startsWith('image/');
  return (
    <div className="report-detail__evidence-item">
      {!item.src ? <p className="report-detail__evidence-placeholder" role="status">Referencia antigua sin URL disponible. No se puede cargar esta evidencia.</p>
        : !isImage ? <a href={item.src} target="_blank" rel="noopener noreferrer">{item.label}</a>
          : status === 'error' ? <p className="report-detail__evidence-placeholder" role="alert">No se pudo cargar {item.label}.</p>
            : <button type="button" className="report-detail__evidence-open" onClick={() => onOpen({ src: item.src, label: item.label })} aria-label={`Ampliar ${item.label}`}>
              {status === 'loading' && <Skeleton label={`Cargando ${item.label}…`} rows={2} />}
              <img className="report-detail__evidence-img" src={item.src} alt={item.label} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
            </button>}
      <span className="report-detail__evidence-name">{item.label}</span>
    </div>
  );
}

export default function ReportEvidenceGallery({ report, onOpen }) {
  const items = reportEvidence(report);
  return items.length ? <div className="report-detail__evidence-gallery">
    {items.map(item => <EvidenceItem key={`${item.id}-${item.src}`} item={item} onOpen={onOpen} />)}
  </div> : <div className="report-detail__evidence">
    <div className="report-detail__evidence-icon" aria-hidden="true">📷</div>
    <div className="report-detail__evidence-text">Sin evidencia adjunta</div>
  </div>;
}
