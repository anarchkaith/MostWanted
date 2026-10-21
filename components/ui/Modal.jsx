import { useId, useRef } from 'react';
import useDialog from '../../src/hooks/useDialog';

export default function Modal({
  title,
  titleAs: TitleTag = 'h2',
  titleIcon = null,
  closeLabel = 'Cerrar',
  onClose,
  zIndex,
  maxWidth,
  bodyStyle,
  overlayProps = {},
  dialogProps = {},
  headerContent = null,
  afterHeader = null,
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  useDialog(dialogRef, { onClose, initialFocusRef: closeRef });
  const heading = <TitleTag id={titleId} className="modal__title">{title}</TitleTag>;
  return (
    <div className="modal-overlay" style={zIndex ? { zIndex } : undefined} {...overlayProps}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} {...dialogProps} ref={dialogRef}>
        <div className="modal__header">
          {titleIcon || headerContent ? <div className="modal__header-main">{titleIcon}{heading}{headerContent}</div> : heading}
          <button ref={closeRef} type="button" className="modal__close" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        {afterHeader}
        <div className="modal__body" style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
}
