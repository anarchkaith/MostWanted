const documents = new WeakMap();
const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function activateDialog({ dialog, initialFocus, onClose }) {
  const doc = dialog.ownerDocument;
  let state = documents.get(doc);
  if (!state) {
    state = { stack: [], overflow: doc.body.style.overflow };
    documents.set(doc, state);
    doc.body.style.overflow = 'hidden';
  }
  const previousFocus = doc.activeElement;
  const entry = { dialog };
  state.stack.push(entry);
  const controls = () => [...dialog.querySelectorAll(FOCUSABLE)]
    .filter(element => element.tabIndex >= 0 && element.getClientRects().length &&
      !element.closest('[inert]') && !['hidden', 'collapse'].includes(doc.defaultView.getComputedStyle(element).visibility));
  const focusInitial = () => {
    const elements = controls();
    (elements.includes(initialFocus) ? initialFocus : elements[0] || dialog).focus();
  };
  focusInitial();
  const onKeyDown = event => {
    if (state.stack.at(-1) !== entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    } else if (event.key === 'Tab') {
      const elements = controls();
      const index = elements.indexOf(doc.activeElement);
      const next = index < 0 ? (event.shiftKey ? elements.at(-1) : elements[0])
        : elements[(index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length];
      event.preventDefault();
      event.stopImmediatePropagation();
      (next || dialog).focus();
    }
  };
  doc.addEventListener('keydown', onKeyDown, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    const wasTop = state.stack.at(-1) === entry;
    state.stack = state.stack.filter(item => item !== entry);
    if (!state.stack.length) {
      doc.body.style.overflow = state.overflow;
      documents.delete(doc);
    }
    if (wasTop) {
      const parent = state.stack.at(-1)?.dialog;
      if (previousFocus?.isConnected && (!parent || parent.contains(previousFocus))) previousFocus.focus();
      else parent?.focus();
    }
  };
}
