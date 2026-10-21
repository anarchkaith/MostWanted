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
  children,
}) {
  const heading = <TitleTag className="modal__title">{title}</TitleTag>;
  return (
    <div className="modal-overlay" style={zIndex ? { zIndex } : undefined} {...overlayProps}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined} {...dialogProps}>
        <div className="modal__header">
          {titleIcon ? <div className="modal__header-main">{titleIcon}{heading}</div> : heading}
          <button type="button" className="modal__close" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        <div className="modal__body" style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
}
