export default function BilhetesPage({ inbox, outbox, onRespond }) {
  return (
    <div className="page-stack two-col">
      <section className="panel">
        <h3>Recebidos</h3>
        {!inbox.length ? <p>Nenhum bilhete recebido.</p> : null}
        <ul className="simple-list">
          {inbox.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.fromName}</strong>
                <p>
                  {item.type} em {item.venueName}
                </p>
                {item.message ? <p>{item.message}</p> : null}
              </div>
              <div className="inline-row">
                <span className="pill">{item.status}</span>
                {item.status === 'enviado' ? (
                  <>
                    <button type="button" className="btn btn--ghost" onClick={() => onRespond(item.id, 'ignorado')}>
                      Ignorar
                    </button>
                    <button type="button" className="btn btn--primary" onClick={() => onRespond(item.id, 'respondido')}>
                      Responder
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Enviados</h3>
        {!outbox.length ? <p>Nenhum bilhete enviado.</p> : null}
        <ul className="simple-list">
          {outbox.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.toName}</strong>
                <p>
                  {item.type} em {item.venueName}
                </p>
                {item.message ? <p>{item.message}</p> : null}
              </div>
              <span className="pill">{item.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
