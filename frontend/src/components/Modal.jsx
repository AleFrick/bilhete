export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  headerActions = null,
  hideHeader = false,
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} aria-hidden="true" />
      <div className={`modal${className ? ` ${className}` : ''}`} role="dialog" aria-labelledby="modal-title" aria-modal="true">
        {!hideHeader ? (
          <div className="modal__header">
            <h2 id="modal-title" className="modal__title">{title}</h2>
            <div className="modal__header-actions">
              {headerActions}
              <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
        <div className={`modal__content${hideHeader ? ' modal__content--flush' : ''}`}>
          {hideHeader ? (
            <button type="button" className="modal__close modal__close--inside" onClick={onClose} aria-label="Fechar">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" />
              </svg>
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </>
  );
}
