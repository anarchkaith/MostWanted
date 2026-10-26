export const INTERFACE_SOUND_EVENT = 'mw:interface-sound';

export function requestInterfaceSound(kind) {
  globalThis.dispatchEvent?.(new CustomEvent(INTERFACE_SOUND_EVENT, { detail: { kind } }));
}

// Browsers block audio until the user has interacted with the page.
export function canAutoplayInterfaceSound(nav) {
  return nav?.userActivation?.hasBeenActive === true;
}
