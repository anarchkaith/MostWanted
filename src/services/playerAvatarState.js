export function createPlayerAvatarSlots(avatars = []) {
  return avatars.map(avatar => ({
    index: avatar.index,
    originalUrl: avatar.avatarUrl || '',
    src: avatar.avatarDataUrl || avatar.displayUrl || avatar.avatarUrl || '',
    loaded: false,
    failed: avatar.available === false,
  })).sort((a, b) => a.index - b.index);
}

export function playerAvatarReducer(slots, action) {
  return slots.map(slot => {
    if (slot.index !== action.index || slot.src !== action.src || slot.failed) return slot;
    if (action.type === 'loaded') return { ...slot, loaded: true };
    if (action.type !== 'error') return slot;
    return { ...slot, failed: true, loaded: false };
  });
}

export function visiblePlayerAvatarSlots(slots) {
  const visible = slots.filter(slot => slot.src && !slot.failed);
  return visible.length ? visible : slots.slice(0, 1);
}
