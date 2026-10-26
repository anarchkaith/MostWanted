const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password']);

export function isKeystrokeTarget(target, event) {
  if (!target || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
  if (typeof event.key !== 'string' || event.key.length !== 1) return false;
  if (target.readOnly || target.disabled) return false;
  if (target.tagName === 'TEXTAREA') return true;
  return target.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(String(target.type).toLowerCase());
}
