import { useState } from 'react';
import { ErrorMessage, Field, useFormikContext } from 'formik';
import CyberButtonLabel from './CyberButtonLabel';
import usePlayerInvestigation from './usePlayerInvestigation';
import { isBlockedReportedUsername } from './blockedUsernames';
import { completeReportPlayerDraft } from '../src/services/reportPlayerDraft';

export default function ReportPlayerIdentity({ initialPlayer, onReturnToCase }) {
  const { values, errors, touched, isSubmitting, setValues } = useFormikContext();
  const [request, setRequest] = useState(() => initialPlayer && !initialPlayer.investigationCompleted
    ? { username: initialPlayer.nickname, rid: initialPlayer.rid } : null);
  const { isLoading, error, investigation } = usePlayerInvestigation({
    request,
    onChange: result => {
      setValues(current => completeReportPlayerDraft(current, {
        nickname: request.username, rid: request.rid, investigation: result, investigationCompleted: true,
      }));
    },
  });
  const username = String(values.nickname || '').trim();
  return (
    <section className="rfm-panel rfm-panel--objetivo mw-cyber-panel" aria-labelledby="report-player-title">
      <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
      <h3 id="report-player-title" className="rfm-panel__title cyber-h mw-cyber-heading">Jugador del reporte</h3>
      <p className="rfm-section-description">Los antecedentes se consultan en el archivo. Aquí puedes aportar información nueva sin borrar el historial.</p>
      {onReturnToCase && <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={onReturnToCase} disabled={isSubmitting}><CyberButtonLabel>Volver a la ficha</CyberButtonLabel></button>}
      {initialPlayer?.rid && <p className="rfm-note">Este reporte corresponde al RID {initialPlayer.rid}. Cambiar el nombre no cambia la cuenta asociada.</p>}
      <div className="form-group">
        <label htmlFor="nickname" className="form-group__label">Nombre del jugador</label>
        <div className="cyber-input-full mw-cyber-input">
          <Field id="nickname" name="nickname" type="text" maxLength={30} autoComplete="off" translate="no" placeholder="Ej: CHEATER_123" disabled={isSubmitting} aria-invalid={Boolean(touched.nickname && errors.nickname)} />
        </div>
        <ErrorMessage name="nickname" component="span" className="form-group__hint" />
      </div>
      {!initialPlayer?.investigationCompleted && <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={isSubmitting || isLoading || username.length < 2 || isBlockedReportedUsername(username)} onClick={() => setRequest({ username, rid: initialPlayer?.rid || '' })}>
        <CyberButtonLabel>{isLoading ? 'Buscando...' : 'Completar datos disponibles'}</CyberButtonLabel>
      </button>}
      {isLoading && <p role="status">Consultando datos del jugador. Puedes seguir completando el reporte.</p>}
      {error && <p role="alert" className="rfm-submit-error">{error} Puedes aportar los datos manualmente.</p>}
      {investigation?.warnings?.length > 0 && <p role="status" className="rfm-note">{investigation.warnings.join(' · ')}</p>}
    </section>
  );
}
