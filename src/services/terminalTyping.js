export const TERMINAL_TYPING_MS = 22;
export const TERMINAL_MAX_TICKS = 300;

export function terminalTypingStep(total) {
  return Math.max(1, Math.ceil(total / TERMINAL_MAX_TICKS));
}

// The sound plays once per reveal: restarting the clip on every tick would cut it short.
export function shouldPlayTerminalSound({ text, revealed }) {
  return revealed === 0 && /\S/.test(text);
}
