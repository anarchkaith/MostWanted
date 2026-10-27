import { useCallback, useEffect, useMemo, useState } from 'react';
import { unwrapMarkdownFence } from '../markdownUtils';
import PlayerBackgroundPanel from '../PlayerBackgroundPanel';
import CaseStaffPanel from '../CaseStaffPanel';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialText from '../ui/SpecialText';
import HighlightedText from '../ui/HighlightedText';
import Skeleton from '../ui/Skeleton';
import usePlayerCase from '../../src/hooks/usePlayerCase';
import { PlayerCaseClassification, PlayerCommunityVerification } from '../player/PlayerCaseAssessment';
import PlayerCaseReports from '../player/PlayerCaseReports';
import { CASE_STATUSES, summarizeVotes, formatCaseDate } from '../../src/services/casePresentation';
import { mergePlayerProfile } from '../../src/services/playerProfile';
import { playerPath, readPlayerRoute } from '../../src/services/playerRoute';
import { resolvePlayerRid } from '../../shared/playerIdentity';

export default function InvestigationDesk({ initialPlayer, onPlayerResolved, reportsError, path, onNavigate, onOpenReport, onStartReport, mapReport, canManageCases, revision }) {
  const [selection] = useState(() => {
    const routePlayer = readPlayerRoute(path).player;
    return routePlayer && (routePlayer.nickname !== initialPlayer?.nickname || routePlayer.rid && routePlayer.rid !== initialPlayer?.rid) ? routePlayer : initialPlayer;
  });
  const [foundPlayer, setFoundPlayer] = useState(null);
  const [investigationCompleted, setInvestigationCompleted] = useState(false);
  const onInvestigationChange = useCallback(result => {
    const identity = result ? {
      nickname: result.nombre === `RID ${result.rid}` ? result.username || '' : result.nombre,
      rid: String(result.rid || ''), names: result.profile?.aliases || [], investigation: result,
    } : null;
    setFoundPlayer(identity);
    setInvestigationCompleted(true);
    if (identity) onPlayerResolved(identity);
  }, [onPlayerResolved]);
  const route = useMemo(() => readPlayerRoute(path), [path]);
  const caseId = route.caseId;
  const lookupPlayer = foundPlayer || selection || route.player;
  const { payload, loading, error, refresh } = usePlayerCase({
    caseId, nickname: lookupPlayer?.nickname, rid: lookupPlayer?.rid, revision,
  });
  const dossier = payload?.case || null;
  const player = dossier?.player || lookupPlayer;
  const linkedReports = useMemo(() => (payload?.reports || []).map(mapReport), [payload, mapReport]);
  const votes = useMemo(() => summarizeVotes(linkedReports), [linkedReports]);
  useEffect(() => {
    if (!foundPlayer?.nickname || path === '/denunciar' || /^\/(reporte|expediente)\//.test(path)) return;
    const canonical = playerPath(foundPlayer.nickname);
    if (path !== canonical) onNavigate(canonical, true);
  }, [foundPlayer, path, onNavigate]);

  const classificationText = unwrapMarkdownFence(dossier?.classification?.text || '').trim();
  const classification = player && (loading || classificationText || dossier?.classification?.pending || dossier?.classification?.error) &&
    <PlayerCaseClassification classification={dossier?.classification} text={classificationText} loading={loading} />;
  const verification = player && (loading || votes.total > 0) && <PlayerCommunityVerification votes={votes} loading={loading} />;
  const caseManagement = player && (
    <div className="pbp-identity-actions">
      {loading ? <Skeleton label="Cargando estado del caso…" rows={2} /> : dossier && <div className="case-management__status">
        <h3>Estado del caso</h3>
        <p className="case-status" data-status={dossier.status}>{CASE_STATUSES[dossier.status] || dossier.status}</p>
      </div>}
      <button type="button" className="cyber-button-small mw-cyber-button" onClick={() => {
        const target = foundPlayer || player;
        const investigation = target.investigation;
        onStartReport({
          ...target, investigationCompleted,
          ...(investigation ? {
            investigation: {
              ...investigation,
              profile: mergePlayerProfile({
                username: target.nickname, rid: target.rid,
                profile: investigation.currentProfile, reportInsights: investigation.reportInsights,
                reports: target.rid ? linkedReports.filter(report => resolvePlayerRid(report) === resolvePlayerRid(target)) : [],
              }),
            }
          } : {}),
        });
      }}><CyberButtonLabel>Registrar reporte</CyberButtonLabel></button>
    </div>
  );

  return (
    <main className="investigation-desk" id="reportes-lista">
      {!player && !caseId && <header className="desk-intro"><h2><SpecialText>Busca un jugador</SpecialText></h2><p>Usa su nombre o RID para <HighlightedText>consultar su ficha</HighlightedText> o <HighlightedText>registrar un reporte</HighlightedText>.</p></header>}
      {reportsError && <p className="rfm-submit-error" role="alert">{reportsError}</p>}
      {route.error && <p className="rfm-submit-error" role="alert">{route.error}</p>}
      {error && <div className="rfm-submit-error" role="alert"><p>{error}</p>{payload && <p>Los datos anteriores pueden estar desactualizados.</p>}<button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={refresh}>Reintentar consulta</button></div>}
      {payload?.source?.stale && <div className="rfm-submit-error" role="alert"><p>Los reportes pueden estar desactualizados. {payload.source.error || 'No se pudo completar la actualización.'}</p><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={refresh}>Actualizar expediente</button></div>}
      <div className="desk-columns" aria-busy={loading}>
        <section className="case-file" aria-label="Expediente del jugador">
          <header className="case-file__header">
            <div><p className="case-file__eyebrow">H.E.X. / Archivo de jugadores</p><h2><SpecialText>Ficha del jugador</SpecialText></h2></div>
            {dossier && <>
              <dl className="case-file__metadata"><div><dt>Primera denuncia</dt><dd>{formatCaseDate(linkedReports.map(report => report.fecha).filter(Boolean).sort()[0])}</dd></div><div><dt>Última actualización</dt><dd>{formatCaseDate(dossier.updatedAt, true)}</dd></div></dl>
            </>}
          </header>
          {!player && !caseId && <p className="desk-empty">Sin jugador seleccionado.</p>}
          {!player && caseId && loading && <Skeleton label="Cargando ficha del jugador…" rows={8} />}
          {player && <>
            <PlayerBackgroundPanel
              key={`${player.nickname}:${player.rid}:${revision}`}
              username={player.nickname || ''}
              rid={player.rid || ''}
              reports={linkedReports}
              investigateToken={1}
              variant="dossier"
              onInvestigationChange={onInvestigationChange}
              caseManagement={caseManagement}
              classification={classification}
              verification={verification}
            />
            {canManageCases && dossier && !loading && !error && <CaseStaffPanel key={dossier.id} caseId={dossier.id} currentStatus={dossier.status} onChanged={refresh} />}
          </>}
        </section>
        <PlayerCaseReports reports={linkedReports} payload={payload} player={player} caseId={caseId}
          loading={loading} error={error} onOpenReport={onOpenReport} />
      </div>
    </main>
  );
}
