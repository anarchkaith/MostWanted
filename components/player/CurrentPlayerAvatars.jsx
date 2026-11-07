import { useReducer } from 'react';
import PlayerAvatarImage from '../PlayerAvatarImage';
import Skeleton from '../ui/Skeleton';
import { isRockstarPlayerAvatar } from '../../src/services/playerAvatars';
import { createPlayerAvatarSlots, playerAvatarReducer, visiblePlayerAvatarSlots } from '../../src/services/playerAvatarState';

export default function CurrentPlayerAvatars({ investigation, onOpen, label }) {
  const [slots, dispatch] = useReducer(playerAvatarReducer, investigation.avatares || [], createPlayerAvatarSlots);
  const visible = visiblePlayerAvatarSlots(slots);
  const hasVisibleAvatars = visible.length > 0;
  return hasVisibleAvatars ? <div className="pbp-current-photos">
      <div className="pbp-current__label">{label || (investigation.rid ? 'Avatares actuales' : 'Avatares archivados')}</div>
      <div className="pbp-current__avatars">
        {visible.map(slot => (
          <button type="button" key={slot.index} className="pbp-current__avatar" aria-label={`Ampliar avatar ${slot.index + 1}`}
            disabled={!slot.src || slot.failed}
            onClick={() => onOpen({ src: slot.src, label: `Avatar ${slot.index + 1} de ${investigation.nombre}`, normalizeAlpha: isRockstarPlayerAvatar(slot.originalUrl) })}>
            <div className="pbp-current__avatar-stage">
              {!slot.loaded && <Skeleton label={`Cargando avatar ${slot.index + 1}…`} rows={1} className="mw-skeleton--avatar" />}
              <PlayerAvatarImage key={slot.src} className="pbp-current__avatar-image" src={slot.src} alt={`Avatar ${slot.index + 1}`} normalizeAlpha={isRockstarPlayerAvatar(slot.originalUrl)}
                onLoad={() => dispatch({ type: 'loaded', index: slot.index, src: slot.src })}
                onError={() => dispatch({ type: 'error', index: slot.index, src: slot.src })} />
            </div>
          </button>
        ))}
      </div>
    </div> : null;
}
