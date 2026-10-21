import { useState } from 'react';
import { buildDiscordAvatarUrl } from '../../shared/discordAvatar.js';

export default function DiscordAvatar({ user }) {
  const src = buildDiscordAvatarUrl(user);
  const [loadedSrc, setLoadedSrc] = useState('');
  const [failedSrc, setFailedSrc] = useState('');
  const name = user.globalName || user.username || 'Usuario';
  return (
    <span className={`discord-avatar${loadedSrc !== src && failedSrc !== src ? ' discord-avatar--loading' : ''}`}>
      {src && failedSrc !== src ? <img src={src} alt="" width="44" height="44" onLoad={() => setLoadedSrc(src)} onError={() => {
        console.warn('[profile] No se pudo cargar el avatar de Discord.');
        setFailedSrc(src);
      }} /> : <span aria-label={`Avatar no disponible de ${name}`}>{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}
