export function createPlayerAvatarSlots(avatars = []) {
  return avatars.map(avatar => ({
    index: avatar.index,
    originalUrl: avatar.avatarUrl || '',
    src: avatar.avatarDataUrl || avatar.avatarUrl || '',
    proxyUrl: avatar.proxiedAvatarUrl || '',
    loaded: false,
    triedProxy: false,
    failed: avatar.available === false,
  })).sort((a, b) => a.index - b.index);
}

export function playerAvatarReducer(slots, action) {
  return slots.map(slot => {
    if (slot.index !== action.index || slot.src !== action.src || slot.failed) return slot;
    if (action.type === 'loaded') return { ...slot, loaded: true };
    if (action.type !== 'error') return slot;
    if (!slot.triedProxy && slot.proxyUrl && slot.proxyUrl !== slot.src) {
      return { ...slot, src: slot.proxyUrl, triedProxy: true, loaded: false };
    }
    return { ...slot, failed: true, loaded: false };
  });
}

export function visiblePlayerAvatarSlots(slots) {
  const visible = slots.filter(slot => slot.src && !slot.failed);
  return visible.length ? visible : slots.slice(0, 1);
}

export function needsAvatarProxyPermission(slots) {
  return slots.length > 0 && !slots.some(slot => slot.src && !slot.failed) &&
    slots.some(slot => slot.failed && slot.triedProxy);
}
