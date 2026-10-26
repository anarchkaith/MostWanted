import { useEffect, useState } from 'react';
import { createInterfaceAudio, INTERFACE_AUDIO_SOURCES } from '../src/services/interfaceAudio';
import { getInterfaceHover } from '../src/services/interfaceHover';
import { isKeystrokeTarget } from '../src/services/interfaceKeystroke';
import { INTERFACE_SOUND_EVENT } from '../src/services/interfaceSoundBus';

const DIALOGS = '.modal, .rfm-confirmation, .ai-bubble__panel, .image-viewer';
const CLOSE_ACTIONS = '.modal__close, .ai-bubble__close, [data-ui-sound="reject"]';

export default function InterfaceSounds() {
  const [error, setError] = useState('');

  useEffect(() => {
    const audio = createInterfaceAudio({
      createAudio: source => new Audio(source),
      onReady: () => setError(''),
      onError: cause => {
        console.warn('No se pudo reproducir el sonido de interfaz.', cause);
        setError('Audio no disponible. Comprueba tu conexión o los permisos de sonido del navegador.');
      },
    });
    let interacted = false;
    let dialogs = new Set(document.querySelectorAll(DIALOGS));
    const timers = new Set();
    const onInteraction = () => { interacted = true; };
    const onHover = event => {
      if (event.pointerType === 'touch' || (!interacted && !navigator.userActivation?.hasBeenActive)) return;
      const target = event.target instanceof Element ? event.target : null;
      const kind = getInterfaceHover(target, event.relatedTarget);
      if (kind) void audio.play(kind);
    };
    const onClick = event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      interacted = true;
      const control = target.closest('button, a[href]') ||
        (target.matches('[data-ui-sound]') ? target : null);
      if (!control || control.matches(':disabled, [aria-disabled="true"]') ||
          control.closest('[data-ui-sound="off"]')) return;
      void audio.play(control.matches(CLOSE_ACTIONS) ? 'reject' : 'accept');
    };
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.repeat) return;
      interacted = true;
      const before = [...document.querySelectorAll(DIALOGS)];
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (before.some(dialog => !dialog.isConnected)) void audio.play('reject');
      }, 0);
      timers.add(timer);
    };
    const onTyping = event => {
      if (isKeystrokeTarget(event.target, event)) void audio.play('keystroke');
    };
    const onSoundRequest = event => {
      const kind = event.detail?.kind;
      if (Object.hasOwn(INTERFACE_AUDIO_SOURCES, kind)) void audio.play(kind);
    };
    const observer = new MutationObserver(() => {
      const current = new Set(document.querySelectorAll(DIALOGS));
      if (interacted && [...current].some(dialog => !dialogs.has(dialog))) void audio.play('slide');
      dialogs = current;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onInteraction, true);
    document.addEventListener('keydown', onInteraction, true);
    document.addEventListener('pointerover', onHover, true);
    document.addEventListener('keydown', onTyping, true);
    globalThis.addEventListener(INTERFACE_SOUND_EVENT, onSoundRequest);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onTyping, true);
      globalThis.removeEventListener(INTERFACE_SOUND_EVENT, onSoundRequest);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onInteraction, true);
      document.removeEventListener('keydown', onInteraction, true);
      document.removeEventListener('pointerover', onHover, true);
      for (const timer of timers) clearTimeout(timer);
      audio.dispose();
    };
  }, []);

  return error ? <p className="interface-sounds__error" role="status">{error}</p> : null;
}
