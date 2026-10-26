import { useEffect, useState } from 'react';
import { canAutoplayInterfaceSound, requestInterfaceSound } from '../../src/services/interfaceSoundBus';
import { TERMINAL_TYPING_MS, shouldPlayTerminalSound, terminalTypingStep } from '../../src/services/terminalTyping';

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useTerminalText(text, { animate = true, sound = true } = {}) {
  const [progress, setProgress] = useState({ text, count: 0 });
  const total = Array.from(text).length;
  const isAnimating = animate && total > 0 && !prefersReducedMotion();
  const count = progress.text === text ? progress.count : 0;
  const typing = isAnimating && count < total;

  useEffect(() => {
    if (!typing) return undefined;
    const timer = setTimeout(() => {
      const next = Math.min(total, count + terminalTypingStep(total));
      setProgress({ text, count: next });
      if (sound && canAutoplayInterfaceSound(globalThis.navigator) &&
          shouldPlayTerminalSound({ text, revealed: count })) {
        requestInterfaceSound('terminal');
      }
    }, TERMINAL_TYPING_MS);
    return () => clearTimeout(timer);
  }, [count, sound, text, total, typing]);

  if (!isAnimating) return { visible: text, typing: false };
  return { visible: Array.from(text).slice(0, count).join(''), typing };
}
