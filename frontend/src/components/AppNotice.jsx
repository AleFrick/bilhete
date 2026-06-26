import { useEffect, useState } from 'react';

export default function AppNotice({
  message,
  type = 'info',
  onClose,
  autoHideMs = 0,
  closable = true,
  floating = false,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [message]);

  useEffect(() => {
    if (!message || dismissed || !autoHideMs) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDismissed(true);
      if (onClose) {
        onClose();
      }
    }, autoHideMs);

    return () => clearTimeout(timer);
  }, [message, dismissed, onClose, autoHideMs]);

  if (!message || dismissed) {
    return null;
  }

  const handleClose = () => {
    setDismissed(true);
    if (onClose) {
      onClose();
    }
  };

  const role = type === 'error' ? 'alert' : 'status';
  const classes = [
    'app-notice',
    `app-notice--${type}`,
    floating ? 'app-notice--floating' : 'app-notice--inline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={role} aria-live="polite">
      <span className="app-notice__message">{message}</span>
      {closable ? (
        <button
          type="button"
          className="app-notice__close"
          onClick={handleClose}
          aria-label="Fechar aviso"
          title="Fechar"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
