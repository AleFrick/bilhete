import SectionCard from '../components/SectionCard';

const relationshipFeatures = [
  'Check-in por local em tempo real',
  'Pessoas no local com status social',
  'Bilhetes: curtida, emoji e troquei olhares',
  'Match e chat temporário',
  'Radar premium com lotação e vibe',
];

const businessFeatures = [
  'Divulgação da marca no app, como vitrine de descoberta local',
  'Link para informar programação semanal e cardápio',
  'Link direto para o Instagram oficial do estabelecimento',
  'Dashboard para acompanhar volume de check-ins no local',
  'Página exclusiva de eventos no app, em formato de feed',
  'Com autorização do usuário, envio de notificações no celular',
];

const flow = [
  'Você chega no local e entra no clima com um check-in rápido.',
  'Aparecem pessoas por perto na mesma vibe que a sua.',
  'Rola um bilhete leve para puxar assunto sem pressão.',
  'Quando a troca bate, a conversa abre ali mesmo.',
  'Tudo acontece no momento e termina de forma natural ao sair do local.',
];

const testimonials = [
  {
    name: 'Marina, 27',
    city: 'Santa Maria, RS',
    quote:
      'Usei o Bilhete no sábado e deu muito certo. O papo começou no app e terminou em encontro na mesa ao lado.',
    avatar: 'https://i.pravatar.cc/96?img=32',
  },
  {
    name: 'Lucas, 30',
    city: 'Santa Maria, RS',
    quote:
      'Curti porque tudo acontece no contexto do local. Sem conversa aleatória, só quem realmente está por perto.',
    avatar: 'https://i.pravatar.cc/96?img=12',
  },
  {
    name: 'Ana, 25',
    city: 'Santa Maria, RS',
    quote:
      'O feed de eventos me ajudou a escolher para onde ir e ainda conheci gente nova no mesmo lugar. Muito prático.',
    avatar: 'https://i.pravatar.cc/96?img=44',
  },
];

export default function LandingPage({ onCreateAccount, onEnter }) {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero__orbit landing-hero__orbit--left" aria-hidden="true" />
        <div className="landing-hero__orbit landing-hero__orbit--right" aria-hidden="true" />

        <div className="landing-hero__content">
          <p className="hero__tag">Bilhete</p>
          <h1>Olhou, sorriu, virou conversa.</h1>
          <p className="landing-hero__text">
            O Bilhete conecta quem está no mesmo lugar com um clima leve, divertido e cheio de
            possibilidade. Menos feed infinito, mais papo que começa ao vivo.
          </p>

          <div className="landing-hero__actions">
            <button type="button" className="btn btn--primary" onClick={onCreateAccount}>
              Quero entrar nesse clima
            </button>
            <button type="button" className="btn btn--ghost" onClick={onEnter}>
              Já tenho conta
            </button>
          </div>

          <p className="landing-hero__chips-label">Vibes do app:</p>
          <ul className="landing-hero__chips" aria-label="Vibes do app">
            <li>Descontração real</li>
            <li>Romance sem pressão</li>
            <li>Conversas com contexto</li>
          </ul>
        </div>

        <aside className="landing-spotlight" aria-label="Resumo da experiência">
          <p className="landing-spotlight__label">No seu raio agora</p>
          <h2>Locais vivos, pessoas presentes, conexões espontâneas.</h2>
          <p>
            Entre no local, veja quem está por perto e envie um bilhete com atitude. Se rolar match,
            a conversa abre na hora.
          </p>
        </aside>
      </section>

      <section className="landing-moment" aria-label="Momento Bilhete">
        <p>
          "Hoje eu saí para tomar uma, mandei um bilhete e em 10 minutos já estava rindo com alguém
          novo."
        </p>
        <span>- história que a gente quer repetir toda noite</span>
      </section>

      <div className="landing-grid">
        <SectionCard title="Relacionamento" subtitle="Conexões que começam no local">
          <ul className="landing-list">
            {relationshipFeatures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Como acontece" subtitle="Uma jornada mais espontânea">
          <ul className="landing-list">
            {flow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="landing-grid">
        <SectionCard title="Estabelecimentos" subtitle="Divulgação e crescimento local">
          <ul className="landing-list">
            {businessFeatures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Visão de parceria" subtitle="Presença ativa dentro do app">
          <ul className="landing-list">
            <li>Marca em destaque para quem está no raio e pronto para sair.</li>
            <li>Agenda e cardápio atualizados em um clique.</li>
            <li>Canal direto para Instagram e relacionamento da casa.</li>
            <li>Leitura de check-ins para entender horários de pico.</li>
            <li>Eventos publicados no feed oficial para ganhar alcance.</li>
            <li>Notificações segmentadas com permissão do usuário.</li>
          </ul>
        </SectionCard>
      </div>

      <section className="landing-comments" aria-label="Comentários de usuários">
        <header className="landing-comments__header">
          <p className="hero__tag">Quem já usou</p>
          <h2>Comentários reais em breve. Por enquanto, exemplos de demonstração.</h2>
        </header>

        <div className="landing-comments__grid">
          {testimonials.map((item) => (
            <article key={item.name} className="landing-comment-card">
              <div className="landing-comment-card__user">
                <img src={item.avatar} alt={`Foto de ${item.name}`} loading="lazy" />
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.city}</p>
                </div>
              </div>
              <p>{item.quote}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer" aria-label="Informações institucionais">
        <p>© {new Date().getFullYear()} Bilhete. Todos os direitos reservados.</p>
        <nav aria-label="Links institucionais">
          <a href="#" onClick={(event) => event.preventDefault()}>
            Termos de uso
          </a>
          <a href="#" onClick={(event) => event.preventDefault()}>
            Política de privacidade
          </a>
          <a href="#" onClick={(event) => event.preventDefault()}>
            Suporte
          </a>
        </nav>
      </footer>
    </main>
  );
}
