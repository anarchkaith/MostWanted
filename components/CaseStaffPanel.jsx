import { useEffect, useState } from 'react';
import { requestCase } from '../src/services/casesService';
import { CASE_STATUSES, formatCaseDate } from '../src/services/casePresentation';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Button from './ui/Button';
import CyberSelect from './ui/CyberSelect';
import Section from './ui/Section';
import TextArea from './ui/TextArea';
import TextInput from './ui/TextInput';

export default function CaseStaffPanel({ caseId, currentStatus, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState(currentStatus || 'open');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    requestCase(`/${encodeURIComponent(caseId)}/staff`, { signal: controller.signal })
      .then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [caseId, version]);
  useEffect(() => setStatus(currentStatus || 'open'), [currentStatus]);
  const save = async (event, type) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestCase(`/${encodeURIComponent(caseId)}/${type}`, {
        method: type === 'notes' ? 'POST' : 'PATCH',
        body: type === 'notes' ? { text: text.trim() } : { status, reason: reason.trim() },
      });
      setText('');
      setReason('');
      setVersion(value => value + 1);
      onChanged();
    } catch (error) {
      setData(null);
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section className="case-staff" title={<>Gestión interna <Badge>Solo staff</Badge></>}>
      {error && <Alert>{error}</Alert>}
      {!data && !error && <p role="status">Verificando permisos…</p>}
      {!data && error && <Button variant="secondary" glitch={false} onClick={() => setVersion(value => value + 1)}>Reintentar</Button>}
      {data && <>
        {data.closedCaseNewReports?.count > 0 && <p className="case-association-note" role="status">Hay {data.closedCaseNewReports.count} reporte(s) posterior(es) al cierre del {formatCaseDate(data.closedCaseNewReports.closedAt, true)}. El caso sigue cerrado hasta que el staff decida reabrirlo. <a href="#linked-reports-title">Revisar reportes</a></p>}
        <form onSubmit={event => save(event, 'status')} className="case-form">
          <label htmlFor="case-status">Estado del caso</label>
          <CyberSelect id="case-status" value={status} onChange={setStatus} disabled={busy} options={Object.entries(CASE_STATUSES).map(([value, label]) => ({ value, label }))} />
          <label htmlFor="case-status-reason">Motivo del cambio</label>
          <TextInput id="case-status-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={busy} />
          <Button type="submit" variant="secondary" disabled={busy || status === currentStatus || !reason.trim()}>Guardar estado</Button>
        </form>
        <h4>Notas internas</h4>
        <p className="case-muted">Privadas. Se conservan con autor y fecha; no se pueden editar ni borrar.</p>
        <ul className="case-notes">
          {(data.notes || []).map((note, index) => <li key={note.id || index}><p>{note.text}</p><small>{note.author?.name || note.author?.username || (typeof note.author === 'string' ? note.author : 'Autor no disponible')} · {formatCaseDate(note.createdAt, true)}</small></li>)}
        </ul>
        {!data.notes?.length && <p className="case-muted">Sin notas internas.</p>}
        {data.legacyNotes?.length > 0 && <details><summary>Notas heredadas sin autor registrado</summary><ul className="case-notes">{data.legacyNotes.map((note, index) => <li key={index}>{typeof note === 'string' ? note : note.text}</li>)}</ul></details>}
        <form onSubmit={event => save(event, 'notes')} className="case-form">
          <label htmlFor="case-note">Añadir nota privada</label>
          <TextArea id="case-note" value={text} onChange={event => setText(event.target.value)} rows={4} required maxLength={2000} disabled={busy} />
          <Button type="submit" disabled={busy || !text.trim()}>{busy ? 'Guardando…' : 'Añadir nota'}</Button>
        </form>
        <details><summary>Historial de gestión</summary><ul className="case-notes">
          {(data.history || []).map((entry, index) => <li key={entry.id || index}>{CASE_STATUSES[entry.from] || entry.from} → {CASE_STATUSES[entry.to] || entry.to}<p>{entry.reason}</p><small>{entry.author?.name || 'Staff'} · {formatCaseDate(entry.createdAt, true)}</small></li>)}
        </ul>{!data.history?.length && <p>Sin cambios de estado.</p>}</details>
      </>}
    </Section>
  );
}
