import { useState } from 'react';
import PlayerAvatarImage from '../PlayerAvatarImage';
import Skeleton from '../ui/Skeleton';
import { isRockstarPlayerAvatar } from '../../src/services/playerAvatars';

function HistoricalAvatar({ avatar, playerName, onOpen }) {
  const [status, setStatus] = useState('loading');
  return <figure>
    <button type="button" className="pbp-history-avatar"
      onClick={() => onOpen({ src: avatar.avatarUrl, label: `Avatar archivado de ${playerName}`, normalizeAlpha: isRockstarPlayerAvatar(avatar.avatarUrl) })}
      aria-label={`Ampliar avatar archivado${avatar.source ? `: ${avatar.source}` : ''}`}>
      {status === 'error' ? <span>Imagen no disponible</span> : <>
        {status === 'loading' && <Skeleton label="Cargando avatar anterior…" rows={1} className="mw-skeleton--avatar" />}
        <PlayerAvatarImage src={avatar.avatarUrl} alt="Avatar registrado" loading="lazy" normalizeAlpha={isRockstarPlayerAvatar(avatar.avatarUrl)}
          onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
      </>}
    </button>
    <figcaption>{[avatar.source, avatar.time > 0 ? new Date(avatar.time * 1000).toLocaleString('es-ES') : 'Fecha desconocida'].filter(Boolean).join(' · ')}</figcaption>
  </figure>;
}

export default function PlayerAvatarHistory({ avatars, playerName, onOpen }) {
  return <div className="pbp-section pbp-photo-archive">
    <div className="pbp-current__label" title="Las imágenes enlazadas pueden cambiar; no son copias históricas.">Avatares anteriores</div>
    {avatars.length ? <div className="pbp-avatar-history">
      {avatars.map(avatar => <HistoricalAvatar key={avatar.avatarUrl} avatar={avatar} playerName={playerName} onOpen={onOpen} />)}
    </div> : <p className="pbp-empty">Sin avatares archivados.</p>}
  </div>;
}
