import { useEffect, useRef } from 'react';
import { activateDialog } from '../services/dialogLifecycle.js';

export default function useDialog(dialogRef, { onClose, initialFocusRef, enabled = true }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!enabled || !dialogRef.current) return undefined;
    return activateDialog({
      dialog: dialogRef.current, initialFocus: initialFocusRef?.current,
      onClose: () => close.current?.(),
    });
  }, [dialogRef, initialFocusRef, enabled]);
}
