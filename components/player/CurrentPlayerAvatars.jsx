import { useReducer, useState } from 'react';
import CORSPermission from '../CORSPermission';
import PlayerAvatarImage from '../PlayerAvatarImage';
import Skeleton from '../ui/Skeleton';
import { isRockstarPlayerAvatar } from '../../src/services/playerAvatars';
import { createPlayerAvatarSlots, needsAvatarProxyPermission, playerAvatarReducer, visiblePlayerAvatarSlots } from '../../src/services/playerAvatarState';

export default function CurrentPlayerAvatars({ investigation, onOpen }) {
  const [slots, dispatch] = useReducer(playerAvatarReducer, investigation.avatares || [], createPlayerAvatarSlots);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const visible = visiblePlayerAvatarSlots(slots);
  return <>
    <CORSPermission href={investigation.corsPermissionUrl} variant="modal"
      open={needsAvatarProxyPermission(slots) && !permissionDismissed}
      onClose={() => setPermissionDismissed(true)} />
    <div className="pbp-current-photos">
      <div className="pbp-current__label">{investigation.rid ? 'Avatares actuales' : 'Avatares archivados'}</div>
      <div className="pbp-current__avatars">
        {(visible.length ? visible : [{ index: 0, src: '', failed: true }]).map(slot => (
          <button type="button" key={slot.index} className="pbp-current__avatar" aria-label={`Ampliar avatar ${slot.index + 1}`}
            disabled={!slot.src || slot.failed}
            onClick={() => onOpen({ src: slot.src, label: `Avatar ${slot.index + 1} de ${investigation.nombre}`, normalizeAlpha: isRockstarPlayerAvatar(slot.originalUrl) })}>
            {slot.src && !slot.failed ? <div className="pbp-current__avatar-stage">
              {!slot.loaded && <Skeleton label={`Cargando avatar ${slot.index + 1}…`} rows={1} className="mw-skeleton--avatar" />}
              <PlayerAvatarImage key={slot.src} className="pbp-current__avatar-image" src={slot.src} alt={`Avatar ${slot.index + 1}`} normalizeAlpha={isRockstarPlayerAvatar(slot.originalUrl)}
                onLoad={() => dispatch({ type: 'loaded', index: slot.index, src: slot.src })}
                onError={() => dispatch({ type: 'error', index: slot.index, src: slot.src })} />
            </div> : <span className="pbp-current__avatar-slot">Sin foto</span>}
          </button>
        ))}
      </div>
    </div>
  </>;
}
