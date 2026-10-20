const ITEMS = '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], button[aria-pressed], [data-ui-sound="hoverOption"]';
const CONTROLS = `${ITEMS}, button, [role="button"], a.mw-cyber-button`;

export function getInterfaceHover(target, relatedTarget) {
  const control = target?.closest(CONTROLS);
  if (!control || control.matches(':disabled, [aria-disabled="true"]') ||
      control.closest('[data-ui-sound="off"]') || (relatedTarget && control.contains(relatedTarget))) return null;
  return control.matches(ITEMS) ? 'hoverOption' : 'hoverButton';
}
