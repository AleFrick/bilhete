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
  '1. Cadastro e perfil social',
  '2. Check-in no local',
  '3. Visualizacao de pessoas disponiveis',
  '4. Envio de bilhete',
  '5. Match e conversa',
  '6. Expiracao com checkout',
];

export default function LandingPage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero__glow" />
        <p className="hero__tag">Bilhete MVP</p>
        <h1>Transforme olhares em encontros no mesmo lugar.</h1>
        <p className="hero__text">
          Frontend React com identidade visual dark do projeto e base pronta para
          conectar API Node + PostgreSQL.
        </p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary">Criar conta</button>
          <button type="button" className="btn btn--ghost">Entrar</button>
        </div>
      </section>

      <div className="grid">
        <SectionCard title="Recursos do MVP" subtitle="Escopo inicial">
          <ul className="list">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Fluxo principal" subtitle="Jornada do usuario">
          <ol className="list list--ordered">
            {flow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </main>
  );
}
