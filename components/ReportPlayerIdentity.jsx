import { useState } from 'react';
import { ErrorMessage, Field, useFormikContext } from 'formik';
import CyberButtonLabel from './CyberButtonLabel';
import usePlayerInvestigation from './usePlayerInvestigation';
import { isBlockedReportedUsername } from './blockedUsernames';
import { completeReportPlayerDraft } from '../src/services/reportPlayerDraft';

export default function ReportPlayerIdentity({ initialPlayer }) {
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
      <h3 id="report-player-title" className="rfm-panel__title cyber-h mw-cyber-heading">Jugador</h3>
      {initialPlayer?.nickname || initialPlayer?.rid ? <div className="form-group">
        <strong className="rfm-player-name notranslate" translate="no">{values.nickname || `RID ${values.rid}`}</strong>
        <ErrorMessage name="nickname" component="span" className="form-group__hint" />
      </div> : <div className="form-group">
        <label htmlFor="nickname" className="form-group__label">Nombre del jugador</label>
        <div className="cyber-input-full mw-cyber-input">
          <Field id="nickname" name="nickname" type="text" maxLength={30} autoComplete="off" translate="no" placeholder="Ej: CHEATER_123" disabled={isSubmitting} aria-invalid={Boolean(touched.nickname && errors.nickname)} />
        </div>
        <ErrorMessage name="nickname" component="span" className="form-group__hint" />
      </div>}
      {!initialPlayer?.investigationCompleted && <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={isSubmitting || isLoading || username.length < 2 || isBlockedReportedUsername(username)} onClick={() => setRequest({ username, rid: initialPlayer?.rid || '' })}>
        <CyberButtonLabel>{isLoading ? 'Buscando...' : 'Completar datos disponibles'}</CyberButtonLabel>
      </button>}
      {isLoading && <p role="status">Consultando jugador…</p>}
      {error && <p role="alert" className="rfm-submit-error">{error} Puedes aportar los datos manualmente.</p>}
      {investigation?.warnings?.length > 0 && <p role="status" className="rfm-note">{investigation.warnings.join(' · ')}</p>}
    </section>
  );
}
