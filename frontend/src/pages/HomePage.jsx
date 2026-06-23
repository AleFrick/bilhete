export default function HomePage({ venues, radar, loadingVenues, loadingRadar }) {
  return (
    <div className="page-stack">
      <section className="panel">
        <h3>Hotspots</h3>
        {loadingVenues ? <p>Carregando locais...</p> : null}
        <ul className="simple-list">
          {venues.map((venue) => (
            <li key={venue.id}>
              <div>
                <strong>{venue.name}</strong>
                <p>{venue.address || 'Endereco nao informado'}</p>
              </div>
              <span className="pill">{venue.partnerStatus ? 'Parceiro' : 'Comum'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Radar Premium</h3>
        {loadingRadar ? <p>Carregando radar...</p> : null}
        {!loadingRadar && !radar.length ? <p>Ative premium para ver dados agregados.</p> : null}
        <ul className="simple-list">
          {radar.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>Status predominante: {item.predominantStatus || 'n/d'}</p>
              </div>
              <span className="pill">{item.activePeople} online</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
