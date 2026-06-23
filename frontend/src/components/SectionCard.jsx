export default function SectionCard({ title, subtitle, children }) {
  return (
    <section className="section-card">
      <header className="section-card__head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
