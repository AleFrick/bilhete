import SectionCard from '../components/SectionCard';

const features = [
  'Check-in por local em tempo real',
  'Pessoas no local com status social',
  'Bilhetes: curtida, emoji e troquei olhares',
  'Match e chat temporario',
  'Radar premium com lotacao e vibe',
  'Painel basico para estabelecimentos',
];

const flow = [
  'Voce chega no local e entra no clima com um check-in rapido.',
  'Aparecem pessoas por perto na mesma vibe que a sua.',
  'Rola um bilhete leve para puxar assunto sem pressao.',
  'Quando a troca bate, a conversa abre ali mesmo.',
  'Tudo acontece no momento e termina de forma natural ao sair do local.',
];

export default function LandingPage({ onCreateAccount, onEnter }) {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero__orbit landing-hero__orbit--left" aria-hidden="true" />
        <div className="landing-hero__orbit landing-hero__orbit--right" aria-hidden="true" />

        <div className="landing-hero__content">
        <p className="hero__tag">Bilhete MVP</p>
          <h1>Olhou, sorriu, virou conversa.</h1>
          <p className="landing-hero__text">
            O Bilhete conecta quem esta no mesmo lugar com um clima leve, divertido e cheio de
            possibilidade. Menos feed infinito, mais papo que comeca ao vivo.
          </p>

          <div className="landing-hero__actions">
            <button type="button" className="btn btn--primary" onClick={onCreateAccount}>
              Quero entrar nesse clima
            </button>
            <button type="button" className="btn btn--ghost" onClick={onEnter}>
              Ja tenho conta
            </button>
          </div>

          <ul className="landing-hero__chips" aria-label="Vibes do app">
            <li>Descontracao real</li>
            <li>Romance sem pressao</li>
            <li>Conversas com contexto</li>
          </ul>
        </div>

        <aside className="landing-spotlight" aria-label="Resumo da experiencia">
          <p className="landing-spotlight__label">No seu raio agora</p>
          <h2>Locais vivos, pessoas presentes, conexoes espontaneas.</h2>
          <p>
            Entre no local, veja quem esta por perto e envie um bilhete com atitude. Se rolar match,
            a conversa abre na hora.
          </p>
        </aside>
      </section>

      <section className="landing-moment" aria-label="Momento Bilhete">
        <p>
          "Hoje eu sai para tomar uma, mandei um bilhete e em 10 minutos ja estava rindo com alguem
          novo."
        </p>
        <span>- historia que a gente quer repetir toda noite</span>
      </section>

      <div className="landing-grid">
        <SectionCard title="Recursos do MVP" subtitle="Escopo inicial">
          <ul className="landing-list">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Como acontece" subtitle="Uma jornada mais espontanea">
          <ul className="landing-list">
            {flow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}
