import { useEffect, useRef, useState } from 'react';
import CyberButtonLabel from './CyberButtonLabel';
import { createInterfaceAudio, INTERFACE_AUDIO_STORAGE_KEY } from '../src/services/interfaceAudio';

const DIALOGS = '.modal, .rfm-confirmation, .delete-confirm-modal, .ai-bubble__panel, .image-viewer, .image-viewer-overlay';
const CLOSE_ACTIONS = '.modal__close, .ai-bubble__close, [data-ui-sound="reject"]';

export default function InterfaceSounds() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(INTERFACE_AUDIO_STORAGE_KEY) !== 'off';
    } catch (error) {
      console.warn('No se pudo leer la preferencia de sonidos de interfaz.', error);
      return true;
    }
  });
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = createInterfaceAudio({
      createAudio: source => new Audio(source),
      onReady: () => setError(''),
      onError: cause => {
        console.warn('No se pudo reproducir el sonido de interfaz.', cause);
        setError('Audio no disponible. Comprueba tu conexión o los permisos de sonido del navegador.');
      },
    });
    audioRef.current = audio;
    let interacted = false;
    let dialogs = new Set(document.querySelectorAll(DIALOGS));
    const timers = new Set();
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
    const observer = new MutationObserver(() => {
      const current = new Set(document.querySelectorAll(DIALOGS));
      if (interacted && [...current].some(dialog => !dialogs.has(dialog))) void audio.play('slide');
      dialogs = current;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      for (const timer of timers) clearTimeout(timer);
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setEnabled(enabled);
  }, [enabled]);

  const toggle = () => {
    const next = !enabled;
    audioRef.current?.setEnabled(next);
    setEnabled(next);
    setError('');
    try {
      localStorage.setItem(INTERFACE_AUDIO_STORAGE_KEY, next ? 'on' : 'off');
    } catch (cause) {
      console.warn('No se pudo guardar la preferencia de sonidos de interfaz.', cause);
      setError('La preferencia de sonido no se pudo guardar para la próxima visita.');
    }
    if (next) void audioRef.current?.play('accept');
  };

  return (
    <div className="interface-sounds" data-ui-sound="off">
      <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"
        aria-label="Sonidos de interfaz" aria-pressed={enabled} onClick={toggle}>
        <CyberButtonLabel>{enabled ? 'Sonido: activado' : 'Sonido: silenciado'}</CyberButtonLabel>
      </button>
      {error && <span className="interface-sounds__error" role="status">{error}</span>}
    </div>
  );
}
