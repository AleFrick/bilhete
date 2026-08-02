export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <h4 className="empty-state__title">{title}</h4>
      {message ? <p className="empty-state__message">{message}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
