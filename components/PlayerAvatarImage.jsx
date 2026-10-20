import { useId } from 'react';

export default function PlayerAvatarImage({ normalizeAlpha = false, ...props }) {
  const filterId = `player-avatar-${useId().replace(/:/g, '')}`;
  return <>
    {normalizeAlpha && <svg className="player-avatar-filter" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feComponentTransfer>
            {/* Rockstar portraits store their foreground at 60% alpha. */}
            <feFuncA type="linear" slope={5 / 3} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>}
    <img {...props} style={normalizeAlpha ? { filter: `url("#${filterId}")` } : undefined} />
  </>;
}
