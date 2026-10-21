import { useEffect, useRef } from 'react';
import { activateDialog } from '../services/dialogLifecycle.js';

export default function useDialog(dialogRef, { onClose, initialFocusRef, returnFocusRef, enabled = true }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!enabled || !dialogRef.current) return undefined;
    return activateDialog({
      dialog: dialogRef.current, initialFocus: initialFocusRef?.current, returnFocus: returnFocusRef?.current,
      onClose: () => close.current?.(),
    });
  }, [dialogRef, initialFocusRef, returnFocusRef, enabled]);
}
