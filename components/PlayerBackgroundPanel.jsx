import React, { useEffect, useMemo, useState } from 'react';
import CORSPermission from './CORSPermission';
import usePlayerInvestigation from './usePlayerInvestigation';
import ImageViewer from './ImageViewer';
import CyberButtonLabel from './CyberButtonLabel';
import { mergePlayerProfile } from '../src/services/playerProfile';

const getSocialClubMemberUrl = name => String(name || '').trim()
  ? `https://socialclub.rockstargames.com/members/${encodeURIComponent(String(name).trim())}/` : '';

/**
 * PlayerBackgroundPanel - Ficha de investigación de usuario.
 */
export default function PlayerBackgroundPanel({
  username = '',
  rid = '',
  variant = 'default',
  onInvestigationChange = null,
  investigateToken = 0,
  initialInvestigation = null,
  reports = null,
  onInvestigatingChange = null,
}) {
  const request = useMemo(() => investigateToken > 0 ? { username, rid, token: investigateToken } : null, [username, rid, investigateToken]);
  const { investigation, isLoading, error } = usePlayerInvestigation({
    request, initialInvestigation, onChange: onInvestigationChange, onLoadingChange: onInvestigatingChange,
  });
  const [showCorsPermissionPopup, setShowCorsPermissionPopup] = useState(false);
  const [avatarRenderState, setAvatarRenderState] = useState({});
  const [expandedAvatar, setExpandedAvatar] = useState(null);
  const [historicalAvatarErrors, setHistoricalAvatarErrors] = useState({});
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia('(min-width: 1101px)').matches);
  const closeAvatar = React.useCallback(() => setExpandedAvatar(null), []);

  const socialClubProfileUrl = getSocialClubMemberUrl(investigation?.currentProfile?.name || username);

  const reportInsights = useMemo(() => {
    const raw = investigation?.reportInsights;
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  }, [investigation]);

  const displayedProfile = useMemo(() => investigation ? mergePlayerProfile({
    username, rid: investigation.rid || rid, profile: investigation.currentProfile,
    reportInsights: investigation.reportInsights, reports: reports || [],
  }) : null, [investigation, username, rid, reports]);
  const crewsWithSource = displayedProfile?.crewHistory || [];

  const nameHistory = useMemo(() => (displayedProfile?.nameHistory || []).map(entry => ({
    ...entry, timeReadable: entry.time > 0 ? new Date(entry.time * 1000).toLocaleString('es-ES') : null,
  })), [displayedProfile]);

  const panelStats = useMemo(() => ([
    { label: 'Reportes previos', value: reportInsights ? String(reportInsights.reportCount ?? 'Desconocido') : 'Desconocido' },
    { label: 'Ultimo registro', value: reportInsights?.lastReportAtReadable || investigation?.profile?.lastSeenReadable || 'Desconocido' },
  ]), [investigation, reportInsights]);

  const avatarSlotsToRender = useMemo(() => {
    const avatars = investigation?.avatares;
    if (!Array.isArray(avatars) || avatars.length === 0) return [0];

    const states = avatars
      .map((avatar) => {
        const stateForSlot = avatarRenderState[avatar.index] || {
          src: avatar?.avatarDataUrl || avatar?.avatarUrl || '',
          failed: avatar?.available === false,
        };

        return {
          slot: avatar.index,
          visible: Boolean(stateForSlot.src) && !stateForSlot.failed,
          pending: Boolean(stateForSlot.src) && !stateForSlot.failed,
        };
      })
      .sort((a, b) => a.slot - b.slot);

    const visibleSlots = states.filter((item) => item.visible).map((item) => item.slot);
    if (visibleSlots.length > 0) return visibleSlots;

    const pendingSlots = states.filter((item) => item.pending).map((item) => item.slot);
    if (pendingSlots.length > 0) return pendingSlots;

    return [states[0]?.slot ?? 0];
  }, [investigation?.avatares, avatarRenderState]);

  const accountStatus = investigation?.accountStatus || null;

  useEffect(() => {
    const nextAvatarState = {};
    for (const avatar of investigation?.avatares || []) {
      if (avatar?.index == null) continue;
      nextAvatarState[avatar.index] = {
        src: avatar.avatarDataUrl || avatar.avatarUrl || '',
        triedProxy: false,
        failed: avatar?.available === false,
      };
    }

    setAvatarRenderState(nextAvatarState);
    setShowCorsPermissionPopup(false);
  }, [investigation?.rid, investigation?.avatares]);

  const handleAvatarError = (slot, avatar) => {
    setAvatarRenderState((currentState) => {
      const currentAvatarState = currentState[slot] || {
        src: avatar?.avatarDataUrl || avatar?.avatarUrl || '',
        triedProxy: false,
        failed: false,
      };

      if (!currentAvatarState.triedProxy && avatar?.proxiedAvatarUrl) {
        return {
          ...currentState,
          [slot]: {
            src: avatar.proxiedAvatarUrl,
            triedProxy: true,
            failed: false,
          },
        };
      }

      const nextState = {
        ...currentState,
        [slot]: {
          ...currentAvatarState,
          failed: true,
        },
      };

      // Solo mostrar popup CORS si no hay ningun avatar visible tras agotar fallback.
      const hasVisibleAvatar = (investigation?.avatares || []).some((avatarItem) => {
        const stateForSlot = nextState[avatarItem.index] || {
          src: avatarItem?.avatarDataUrl || avatarItem?.avatarUrl || '',
          failed: avatarItem?.available === false,
        };
        return Boolean(stateForSlot.src) && !stateForSlot.failed;
      });

      setShowCorsPermissionPopup(Boolean(avatar?.proxiedAvatarUrl) && !hasVisibleAvatar);

      return nextState;
    });
  };


  if ((!username || username.trim().length === 0) && !rid) {
    return null;
  }

  // Mantener el panel visible cuando hay carga o error para informar estado de APIs.
  if (!investigation?.nombre && !isLoading && !error) {
    return null;
  }

  return (
    <>
      <CORSPermission
        href={investigation?.corsPermissionUrl}
        variant="modal"
        open={showCorsPermissionPopup}
        onClose={() => setShowCorsPermissionPopup(false)}
      />
      {expandedAvatar && <ImageViewer image={expandedAvatar} onClose={closeAvatar} />}
      <div className={`player-background-panel${variant === 'dossier' ? ' player-background-panel--dossier' : ''}`}>
        <style>{`
        @layer legacy {
        .player-background-panel {
          background: linear-gradient(135deg, rgba(8, 8, 8, 0.95), rgba(12, 12, 12, 0.9));
          border: 1px solid rgba(0, 255, 255, 0.25);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 0.75rem;
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .pbp-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.65rem;
          padding: 0.5rem 0;
        }

        .pbp-icon {
          font-size: 1.1rem;
          min-width: 20px;
        }

        .pbp-title {
          font-family: var(--font-stencil, 'Courier New', monospace);
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(0, 255, 255, 0.8);
          font-weight: 600;
        }

        .pbp-content {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .pbp-status {
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 0.75rem 0.8rem;
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.74rem;
          line-height: 1.45;
        }

        .pbp-status--loading {
          border-color: rgba(0, 255, 255, 0.35);
          color: #c9f7ff;
          background: linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(5, 12, 16, 0.95));
        }

        .pbp-status--error {
          border-color: rgba(255, 99, 99, 0.55);
          color: #ffd9d9;
          background: linear-gradient(135deg, rgba(255, 99, 99, 0.14), rgba(20, 6, 6, 0.95));
        }

        .pbp-status__title {
          display: block;
          margin-bottom: 0.3rem;
          font-family: var(--font-stencil, 'Courier New', monospace);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .pbp-status__detail {
          opacity: 0.95;
          word-break: break-word;
        }

        .pbp-current {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.16)),
            linear-gradient(135deg, rgba(0, 255, 255, 0.05), rgba(255, 0, 102, 0.04));
          border: 1px solid rgba(0, 255, 255, 0.2);
          border-radius: 8px;
          padding: 0.95rem;
          margin-bottom: 0.65rem;
          display: grid;
          grid-template-columns: max-content minmax(320px, 1.3fr);
          gap: 0.95rem;
          align-items: start;
          position: relative;
          overflow: hidden;
        }

        .pbp-current::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(0, 255, 255, 0.07), transparent 18%, transparent 82%, rgba(255, 0, 102, 0.05));
          pointer-events: none;
        }

        .pbp-evidence-panel,
        .pbp-identity-panel,
        .pbp-intel-panel {
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .pbp-evidence-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding-right: 0.1rem;
          width: fit-content;
          justify-self: start;
        }

        .pbp-evidence-card,
        .pbp-identity-panel,
        .pbp-intel-panel {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 12, 14, 0.68);
          border-radius: 8px;
          padding: 0.75rem;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        .pbp-dossier-kicker {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding-bottom: 0.55rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
        }

        .pbp-dossier-kicker__label {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.66rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.45);
        }

        .pbp-dossier-kicker__value {
          font-family: var(--font-stencil, 'Courier New', monospace);
          font-size: 0.78rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #bafcff;
        }

        .pbp-evidence-card {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          width: fit-content;
          align-self: start;
        }

        .pbp-current__avatars {
          display: flex;
          gap: 0.55rem;
          align-items: flex-start;
          align-self: start;
          height: auto;
          overflow: visible;
          justify-content: center;
          width: fit-content;
        }

        .pbp-current__avatar {
          width: auto;
          height: auto;
          min-height: 0;
          min-width: 0;
          border-radius: 4px;
          background: radial-gradient(circle at top, rgba(0, 255, 255, 0.08), rgba(10, 10, 10, 0.96));
          border: 1px solid rgba(0, 255, 255, 0.3);
          overflow: visible;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.2rem;
          transform-origin: center center;
          transition: transform 0.2s ease, filter 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.14));
          z-index: 1;
        }

        .pbp-current__avatar:hover {
          transform: scale(1.18);
          filter: drop-shadow(0 0 14px rgba(0, 255, 255, 0.28));
          border-color: rgba(0, 255, 255, 0.55);
          background: #ffffff;
          z-index: 12;
        }

        .pbp-current__avatar-stage {
          position: relative;
          display: inline-block;
          width: max-content;
          height: max-content;
          max-width: none;
          max-height: none;
        }

        .pbp-current__avatar-layer {
          display: block;
          width: auto;
          height: auto;
          max-width: none;
          max-height: none;
          pointer-events: none;
        }

        .pbp-current__avatar-stage img + img {
          position: absolute;
          inset: 0;
        }

        .pbp-current__avatar-slot {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .pbp-current__avatar-layer--1 {
          opacity: 0.24;
        }

        .pbp-current__avatar-layer--2 {
          opacity: 0.42;
        }

        .pbp-current__avatar-layer--3 {
          opacity: 0.7;
        }

        .pbp-current__avatar-layer--4 {
          opacity: 1;
        }

        .pbp-current__info {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          min-width: 0;
        }

        .pbp-identity-panel {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .pbp-identity-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.8rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
        }

        .pbp-identity-header__copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .pbp-identity-header__eyebrow {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.67rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.45);
        }

        .pbp-current__summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .pbp-stat-card {
          min-width: 0;
          padding: 0.55rem 0.6rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.16));
          border-radius: 6px;
        }

        .pbp-stat-card__label {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.42);
          margin-bottom: 0.18rem;
        }

        .pbp-stat-card__value {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.76rem;
          color: rgba(220, 248, 248, 0.92);
          line-height: 1.35;
          word-break: break-word;
        }

        .pbp-intel-panel {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          grid-column: 1 / -1;
        }

        .pbp-panel-title {
          font-family: var(--font-stencil, 'Courier New', monospace);
          font-size: 0.79rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #ffb3b3;
          margin-bottom: 0.15rem;
        }

        .pbp-section {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .pbp-current__label {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.4);
        }

        .pbp-current__name {
          font-family: var(--font-sans, Arial, sans-serif);
          font-size: 1.05rem;
          font-weight: 600;
          color: #e8e8b8;
          word-break: break-word;
        }

        .pbp-badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          align-items: center;
        }

        .pbp-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          width: fit-content;
          padding: 0.24rem 0.45rem;
          border-radius: 999px;
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.06);
        }

        .pbp-status-badge--success {
          color: #b7ffd0;
          border-color: rgba(46, 204, 113, 0.55);
          background: rgba(46, 204, 113, 0.14);
          box-shadow: 0 0 14px rgba(46, 204, 113, 0.16);
        }

        .pbp-status-badge--danger {
          color: #ffd1d1;
          border-color: rgba(255, 99, 99, 0.55);
          background: rgba(255, 99, 99, 0.14);
          box-shadow: 0 0 14px rgba(255, 99, 99, 0.14);
        }

        .pbp-status-badge--warning {
          color: #ffe9b1;
          border-color: rgba(255, 193, 7, 0.55);
          background: rgba(255, 193, 7, 0.12);
          box-shadow: 0 0 14px rgba(255, 193, 7, 0.12);
        }

        .pbp-status-badge--neutral {
          color: #d9ecee;
          border-color: rgba(180, 220, 220, 0.35);
          background: rgba(180, 220, 220, 0.08);
        }

        .pbp-status-detail {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.7rem;
          color: rgba(210, 226, 226, 0.72);
          line-height: 1.35;
        }

        .pbp-cyber-link {
          --accent: rgba(0, 255, 255, 0.88);
          --corner: 10px;
          --border-width: 1px;
          --clip: polygon(0 0,
              100% 0,
              100% calc(100% - var(--corner)),
              calc(100% - var(--corner)) 100%,
              0% 100%);
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          width: fit-content;
          margin-top: 0.15rem;
          padding: 0.28rem 0.52rem;
          color: #b8fbff;
          text-decoration: none;
          text-transform: uppercase;
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          border: 0;
          background: transparent;
          clip-path: var(--clip);
          box-shadow: 0 0 0 rgba(0, 255, 255, 0);
          transition: color 0.2s ease, transform 0.2s ease;
          position: relative;
          z-index: 1;
        }

        .pbp-cyber-link:hover {
          color: #031215;
          transform: translateY(-1px);
        }

        .pbp-cyber-link:focus-visible {
          color: #031215;
          outline: none;
        }

        .pbp-cyber-link::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--accent);
          clip-path: var(--clip);
          z-index: -2;
          transition: box-shadow 0.2s ease;
        }

        .pbp-cyber-link::after {
          content: '';
          position: absolute;
          inset: var(--border-width);
          background: linear-gradient(120deg, rgba(0, 255, 255, 0.16), rgba(8, 18, 22, 0.96));
          clip-path: polygon(0 0,
              100% 0,
              100% calc(100% - var(--corner) + var(--border-width)),
              calc(100% - var(--corner) + var(--border-width)) 100%,
              0% 100%);
          z-index: -1;
          transition: background 0.2s ease;
        }

        .pbp-cyber-link:hover::before,
        .pbp-cyber-link:focus-visible::before {
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.42);
        }

        .pbp-cyber-link:hover::after,
        .pbp-cyber-link:focus-visible::after {
          background: linear-gradient(120deg,
              rgba(0, 255, 255, 0.95) 0%,
              rgba(185, 255, 255, 0.98) 50%,
              rgba(0, 255, 255, 0.95) 100%);
          background-size: 200% 100%;
          animation: shimmerBg 1.5s ease infinite;
        }

        .pbp-cyber-link-label::before {
          content: '◢';
          font-size: 0.62rem;
          color: rgba(255, 0, 102, 0.9);
          margin-right: 0.4rem;
        }

        .pbp-cyber-link-label::after {
          content: 'SC';
          font-size: 0.58rem;
          color: rgba(0, 255, 255, 0.8);
          border-left: 1px solid rgba(0, 255, 255, 0.32);
          padding-left: 0.32rem;
          margin-left: 0.4rem;
        }

        .pbp-current__value {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.76rem;
          color: rgba(225, 225, 225, 0.86);
          line-height: 1.4;
          word-break: break-word;
        }

        .pbp-current__crews {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .pbp-chip {
          padding: 0.2rem 0.45rem;
          border-radius: 999px;
          border: 1px solid rgba(0, 255, 255, 0.2);
          background: rgba(0, 255, 255, 0.07);
          color: rgba(214, 252, 255, 0.92);
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.7rem;
          white-space: nowrap;
        }

        .pbp-chip__source {
          margin-left: 0.35rem;
          font-size: 0.64rem;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pbp-empty {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.74rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .pbp-history-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.35rem 0.65rem;
          margin: 0;
          padding-left: 1rem;
        }

        .pbp-history-item {
          position: relative;
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.74rem;
          color: rgba(225, 225, 225, 0.86);
          line-height: 1.35;
          width: fit-content;
        }

        .pbp-history-time {
          position: absolute;
          left: 0;
          top: calc(100% + 0.25rem);
          background: rgba(4, 15, 15, 0.95);
          border: 1px solid rgba(0, 255, 255, 0.35);
          border-radius: 4px;
          padding: 0.2rem 0.4rem;
          color: rgba(0, 255, 255, 0.9);
          opacity: 0;
          transform: translateY(-3px);
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
          white-space: nowrap;
          z-index: 20;
        }

        .pbp-history-link {
          color: #d8ffff;
          text-decoration: underline;
          text-decoration-color: rgba(0, 255, 255, 0.45);
          text-underline-offset: 2px;
          text-decoration-thickness: 1px;
        }

        .pbp-history-link:hover {
          color: #ffffff;
          text-decoration-color: rgba(0, 255, 255, 0.9);
        }

        .pbp-alias-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .pbp-alias-link {
          font-family: var(--font-mono, 'Courier New', monospace);
          font-size: 0.74rem;
          color: rgba(225, 255, 255, 0.9);
          text-decoration: underline;
          text-decoration-color: rgba(0, 255, 255, 0.38);
          text-underline-offset: 2px;
        }

        .pbp-alias-link:hover {
          color: #ffffff;
          text-decoration-color: rgba(0, 255, 255, 0.85);
        }

        .pbp-history-item:hover .pbp-history-time {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 980px) {
          .pbp-current {
            grid-template-columns: 1fr;
          }

          .pbp-current__avatars {
            height: auto;
          }

          .pbp-current__avatar {
            max-width: 100%;
          }

          .pbp-current__summary {
            grid-template-columns: 1fr;
          }

          .pbp-history-list {
            grid-template-columns: 1fr;
          }
        }

        }
      `}</style>

        <div className="pbp-header">
          <span className="pbp-icon">🔍</span>
          <span className="pbp-title">FICHA DE ANTECEDENTES</span>
        </div>

        <div className="pbp-content">
          {isLoading && (
            <div className="pbp-status pbp-status--loading" role="status" aria-live="polite">
              <strong className="pbp-status__title">Investigando...</strong>
              <span className="pbp-status__detail">Consultando Social Club/sc-cache y el archivo de WordPress.</span>
            </div>
          )}

          {error && (
            <div className="pbp-status pbp-status--error" role="alert">
              <strong className="pbp-status__title">Error en la investigación</strong>
              <span className="pbp-status__detail">{error}</span>
            </div>
          )}
          {investigation?.warnings?.map(warning => <p className="pbp-status-detail" role="status" key={warning}>{warning}</p>)}

          {investigation && (
            <div className="pbp-current">
              <div className="pbp-evidence-panel">
                <div className="pbp-dossier-kicker">
                  <span className="pbp-dossier-kicker__label">Resolución del perfil</span>
                  <span className="pbp-dossier-kicker__value">Archivo de jugadores</span>
                </div>
                <div className="pbp-evidence-card">
                  <div className="pbp-current__label">{investigation.rid ? 'AVATARES ACTUALES / ROCKSTAR' : 'AVATARES ARCHIVADOS'}</div>
                  <div className="pbp-current__avatars">
                    {avatarSlotsToRender.map((slot) => {
                      const avatar = investigation.avatares?.find((item) => item.index === slot);
                      const renderState = avatarRenderState[slot];
                      const avatarSrc = renderState?.src || avatar?.avatarDataUrl || avatar?.avatarUrl || '';
                      const avatarFailed = renderState?.failed || avatar?.available === false;
                      return (
                        <button type="button" key={slot} className="pbp-current__avatar" aria-label={`Ampliar avatar ${slot + 1}`} disabled={!avatarSrc || avatarFailed} onClick={() => setExpandedAvatar({ src: avatarSrc, label: `Avatar ${slot + 1} de ${investigation.nombre}` })}>
                          {avatarSrc && !avatarFailed ? (
                            <div className="pbp-current__avatar-stage">
                              <img className="pbp-current__avatar-layer pbp-current__avatar-layer--4" src={avatarSrc} alt={`Avatar ${slot}`} onError={() => handleAvatarError(slot, avatar)} />
                            </div>
                          ) : (
                            <>
                              <span>❌</span>
                              <span className="pbp-current__avatar-slot">sin foto</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pbp-identity-panel">
                <div className="pbp-identity-header">
                  <div className="pbp-identity-header__copy">
                    <div className="pbp-identity-header__eyebrow">{investigation.currentProfile ? 'PERFIL EXTERNO ACTUAL' : investigation.reportInsights ? 'IDENTIDAD ARCHIVADA / REPORTADA' : 'IDENTIDAD CONSULTADA / SIN CONFIRMAR'}</div>
                    <div className="pbp-current__name notranslate" translate="no">{investigation.nombre}</div>
                    <div className="pbp-identity-rid"><span>RID (ROCKSTAR ID)</span><strong>{investigation.rid || rid || 'Sin confirmar'}</strong></div>
                    <div className="pbp-current__label">
                      {investigation.rid || rid
                        ? 'Identidad consultada por RID. Las coincidencias de reportes se indican por separado.'
                        : 'Identidad basada en nombres del archivo; RID sin confirmar.'}
                    </div>
                  </div>
                  {socialClubProfileUrl && (
                    <a
                      href={socialClubProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"
                      title={`Abrir perfil de ${username} en Social Club`}
                    >
                      <CyberButtonLabel>Ver en Social Club</CyberButtonLabel>
                    </a>
                  )}
                </div>

                <div className="pbp-current__info">
                  {accountStatus && (
                    <div className="pbp-badge-row">
                      <span className={`pbp-status-badge pbp-status-badge--${accountStatus.tone || 'neutral'}`}>
                        {accountStatus.label}
                      </span>
                      {accountStatus.detail && (
                        <span className="pbp-status-detail">{accountStatus.detail}</span>
                      )}
                    </div>
                  )}
                </div>

                {variant !== 'dossier' && <div className="pbp-current__summary">
                  {panelStats.map((item) => (
                    <div key={item.label} className="pbp-stat-card">
                      <div className="pbp-stat-card__label">{item.label}</div>
                      <div className="pbp-stat-card__value">{item.value}</div>
                    </div>
                  ))}
                </div>}
              </div>

              <details className="pbp-intel-panel" open={variant !== 'dossier' || historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}>
                <summary className="pbp-panel-title">Nombres y afiliaciones detectadas</summary>
                <div className="pbp-section">
                  <div className="pbp-current__label">Otros nombres</div>
                  {nameHistory.length > 0 ? (
                    <ol className="pbp-history-list" aria-label="Historial de nombres con fechas y fuentes">
                      {nameHistory.map((entry, index) => (
                        <li key={`${entry.name}-${entry.time}-${index}`} className="pbp-history-item">
                          <a
                            href={getSocialClubMemberUrl(entry.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pbp-history-link notranslate"
                            translate="no"
                            title={`Buscar ${entry.name} en Social Club`}
                          >
                            <strong>{entry.name}</strong>
                          </a>
                          <span className="pbp-history-time">{entry.timeReadable || 'Fecha desconocida'} · {entry.source}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="pbp-empty">Sin alias detectados.</div>
                  )}
                </div>

                <div className="pbp-section">
                  <div className="pbp-current__label">Afiliaciones detectadas</div>
                  {crewsWithSource.length > 0 ? (
                    <div className="pbp-current__crews">
                      {crewsWithSource.map((crew) => (
                        <span key={`${crew.name}-${crew.source}`} className="pbp-chip">
                          {crew.name}
                          <span className="pbp-chip__source">{crew.source}</span>
                          {crew.time > 0 && <span className="pbp-chip__source">{new Date(crew.time * 1000).toLocaleString('es-ES')}</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="pbp-empty">Sin información de crews disponible.</div>
                  )}
                </div>

                <div className="pbp-section">
                  <div className="pbp-current__label">Historial de avatares reportados</div>
                  <p className="case-muted">Registro de URLs y fuentes. Una URL de Rockstar puede cambiar su imagen; no es una copia histórica del archivo.</p>
                  {displayedProfile?.historicalAvatars.length ? <div className="pbp-avatar-history">
                    {displayedProfile.historicalAvatars.map(avatar => <figure key={avatar.avatarUrl}>
                      <button type="button" className="pbp-history-avatar" onClick={() => setExpandedAvatar({ src: avatar.avatarUrl, label: `Avatar archivado de ${investigation.nombre}` })} aria-label={`Ampliar avatar archivado: ${avatar.source}`}>
                        {historicalAvatarErrors[avatar.avatarUrl] ? <span>Imagen no disponible</span> : <img src={avatar.avatarUrl} alt="Avatar registrado" loading="lazy" onError={() => setHistoricalAvatarErrors(current => ({ ...current, [avatar.avatarUrl]: true }))} />}
                      </button>
                      <figcaption>{avatar.source}{avatar.time > 0 ? ` · ${new Date(avatar.time * 1000).toLocaleString('es-ES')}` : ' · Fecha desconocida'}</figcaption>
                    </figure>)}
                  </div> : <p className="pbp-empty">Sin avatares archivados.</p>}
                </div>
              </details>
            </div>

          )}
        </div>
      </div>
    </>
  );
}
