import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialTextContent from '../ui/SpecialTextContent';

const ROCKSTAR_SUPPORT_URL = 'https://support.rockstargames.com/';

const STEPS = [
  { tag: '01', title: 'Busca su nombre', text: 'Escribe el nombre o RID. Si ya tiene historial, lo ves al instante.' },
  { tag: '02', title: 'Cuenta y adjunta', text: 'Explica lo que pasó con tus palabras y pega tus capturas. Sin formularios eternos.' },
  { tag: '03', title: 'La IA marca las infracciones', text: 'Lee tu relato y selecciona modder, griefer, scam… Tú solo confirmas.' },
  { tag: '04', title: 'Revisa y envía', text: 'Un último vistazo en un modal y listo. Tu reporte se suma a su expediente.' },
];

const BENEFITS = [
  { icon: '◎', title: 'Su historial no se borra', text: 'Cambió de nombre, de crew o de cuenta: el RID y los alias quedan vinculados al mismo expediente.' },
  { icon: '▲', title: 'La fuerza está en el número', text: 'Un reporte suelto se pierde. Decenas de reportes con pruebas sobre el mismo jugador son imposibles de ignorar.' },
  { icon: '⌖', title: 'Sabes con quién juegas', text: 'Antes de entrar a una sesión o aceptar un trato, búscalo. Si es un scammer conocido, lo sabrás.' },
  { icon: '✦', title: 'La IA hace el trabajo aburrido', text: 'Escribe como hablas. La IA ordena tu relato y marca las infracciones por ti.' },
  { icon: '✓', title: 'La comunidad verifica', text: 'Otros jugadores votan cada reporte. Las pruebas reales suben; los reportes falsos se hunden.' },
  { icon: '⧉', title: 'Pruebas en un solo lugar', text: 'Capturas, fechas, RID y crews organizados. Todo lo que necesitas cuando lo denuncias oficialmente.' },
];

const ROCKSTAR_CHECKLIST = [
  ['Identidad del jugador', 'Nombre, RID y alias anteriores'],
  ['Qué hizo', 'Infracciones clasificadas y relato claro'],
  ['Cuándo pasó', 'Fecha y hora de cada incidente'],
  ['Pruebas', 'Capturas adjuntas a cada reporte'],
];

const FAQ = [
  ['¿MostWanted es de Rockstar?', 'No. Es un proyecto comunitario independiente, sin afiliación oficial con Rockstar Games. Lo que hacemos es reunir pruebas sólidas y ordenadas para que tu denuncia por los canales oficiales de Rockstar tenga más peso.'],
  ['¿De verdad sirve para que lo baneen?', 'La sanción siempre la decide Rockstar. Pero un expediente con muchos reportes, capturas y fechas es mucho más fácil de revisar que un reporte suelto desde el juego. Cuantos más reportes con pruebas, más presión.'],
  ['¿Es anónimo?', 'Tu reporte se vincula a tu cuenta de Discord para evitar spam y reportes falsos. El jugador reportado no ve tus datos privados.'],
  ['¿Qué puedo reportar?', 'Modders, griefers, scammers, comportamiento tóxico extremo y cualquier conducta que arruine la partida a otros.'],
  ['¿Y si no tengo capturas?', 'Puedes reportar igual, pero tendrá menos peso. Si puedes, adjunta aunque sea una imagen.'],
  ['¿Qué pasa si reporto en falso?', 'La comunidad vota cada reporte y los falsos quedan expuestos. Reporta solo lo que viste.'],
];

function DossierPreview() {
  return <div className="lp-dossier" aria-hidden="true">
    <div className="lp-dossier__scan" />
    <div className="lp-dossier__head">
      <span className="lp-dossier__id">EXP-0047</span>
      <span className="lp-dossier__live"><i /> ACTIVO</span>
    </div>
    <div className="lp-dossier__body">
      <div className="lp-dossier__photo"><span>?</span></div>
      <div className="lp-dossier__who">
        <p className="lp-dossier__label">Jugador</p>
        <p className="lp-dossier__name">xX_Ejemplo_Xx</p>
        <p className="lp-dossier__meta">RID 1234•••• · 3 alias</p>
      </div>
    </div>
    <ul className="lp-dossier__tags">
      <li className="is-red">Modder</li><li className="is-orange">Griefer</li><li>Dinero ilegal</li>
    </ul>
    <div className="lp-dossier__meter">
      <div className="lp-dossier__meter-top"><span>Reportes</span><strong>23</strong></div>
      <div className="lp-dossier__bar"><span /></div>
    </div>
    <div className="lp-dossier__evidence">
      <span /><span /><span /><span className="lp-dossier__more">+14</span>
    </div>
    <div className="lp-dossier__stamp">BUSCADO</div>
    <p className="lp-dossier__caption">Ejemplo ilustrativo</p>
  </div>;
}

export default function LandingScreen({ onLogin }) {
  const cta = label => <button type="button" className="cyber-button mw-cyber-button lp-cta" onClick={onLogin}>
    <CyberButtonLabel>{label}</CyberButtonLabel>
  </button>;

  return <main className="lp">
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__grid" aria-hidden="true" />
      <div className="lp-hero__copy">
        <p className="lp-kicker"><span className="lp-kicker__dot" /> Comunidad GTA Online · Reportes con pruebas</p>
        <h1 id="lp-hero-title" className="lp-hero__title">
          <span className="lp-hero__title-small">Que no se te</span>
          <SpecialTextContent>escape ninguno.</SpecialTextContent>
        </h1>
        <p className="lp-hero__lead">
          Ese modder que te arruinó la misión. El scammer que te robó. El griefer de cada noche.
          <strong> Con MostWanted cada uno tiene un expediente</strong>, y cada reporte tuyo lo hace más difícil de ignorar.
        </p>
        <div className="lp-hero__actions">
          {cta('Reportar ahora — es gratis')}
          <a className="lp-link" href="#lp-how">Cómo funciona ↓</a>
        </div>
        <ul className="lp-hero__trust">
          <li><b>2 min</b> por reporte</li>
          <li><b>IA</b> que completa por ti</li>
          <li><b>100%</b> gratis</li>
        </ul>
      </div>
      <div className="lp-hero__visual"><DossierPreview /></div>
    </section>

    <div className="lp-ticker" aria-hidden="true">
      <div className="lp-ticker__track">
        {Array.from({ length: 2 }, (_, i) => <span key={i}>
          MODDERS ✕ GRIEFERS ✕ SCAMMERS ✕ DINERO ILEGAL ✕ TOXICIDAD ✕ GOD MODE ✕ TELETRANSPORTE ✕ KICKS ✕&nbsp;
        </span>)}
      </div>
    </div>

    <section className="lp-section lp-problem" aria-labelledby="lp-problem-title">
      <h2 id="lp-problem-title" className="lp-h2">Reportar desde el juego <em>se siente como gritarle al vacío.</em></h2>
      <div className="lp-versus">
        <div className="lp-versus__col lp-versus__col--bad">
          <p className="lp-versus__label">Reporte in-game</p>
          <ul>
            <li>Un clic y desaparece</li>
            <li>Sin pruebas adjuntas</li>
            <li>Nadie más sabe lo que pasó</li>
            <li>Si cambia de nombre, empiezas de cero</li>
          </ul>
        </div>
        <div className="lp-versus__vs" aria-hidden="true">VS</div>
        <div className="lp-versus__col lp-versus__col--good">
          <p className="lp-versus__label">MostWanted</p>
          <ul>
            <li>Expediente permanente por jugador</li>
            <li>Capturas, fechas y RID en un lugar</li>
            <li>Toda la comunidad suma reportes</li>
            <li>Alias y crews vinculados al mismo RID</li>
          </ul>
        </div>
      </div>
    </section>

    <section id="lp-how" className="lp-section" aria-labelledby="lp-how-title">
      <p className="lp-eyebrow">// Flujo</p>
      <h2 id="lp-how-title" className="lp-h2">Cuatro pasos. <em>Cero complicaciones.</em></h2>
      <ol className="lp-steps">
        {STEPS.map(step => <li key={step.tag} className="lp-step">
          <span className="lp-step__tag">{step.tag}</span>
          <h3 className="lp-step__title">{step.title}</h3>
          <p className="lp-step__text">{step.text}</p>
        </li>)}
      </ol>
      <p className="lp-equation"><span>Más reportes con pruebas</span><b>=</b><span>más presión</span><b>=</b><span className="lp-equation__hot">más probabilidad de baneo</span></p>
    </section>

    <section className="lp-section" aria-labelledby="lp-benefits-title">
      <p className="lp-eyebrow">// Por qué usarlo</p>
      <h2 id="lp-benefits-title" className="lp-h2">No es una lista de nombres. <em>Es tu arma contra los tramposos.</em></h2>
      <div className="lp-benefits">
        {BENEFITS.map(item => <article key={item.title} className="lp-benefit">
          <span className="lp-benefit__icon" aria-hidden="true">{item.icon}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>)}
      </div>
    </section>

    <section className="lp-section lp-rockstar" aria-labelledby="lp-rockstar-title">
      <div className="lp-rockstar__copy">
        <p className="lp-eyebrow">// Hecho para el soporte oficial</p>
        <h2 id="lp-rockstar-title" className="lp-h2">Habla el idioma <em>de Rockstar Support.</em></h2>
        <p>Cuando denuncias a un jugador ante Rockstar, lo que cuenta son las pruebas. MostWanted organiza exactamente lo que necesitas para que tu denuncia oficial llegue completa y con el respaldo de toda la comunidad.</p>
        <div className="lp-rockstar__actions">
          {cta('Crear mi primer reporte')}
          <a className="lp-link" href={ROCKSTAR_SUPPORT_URL} target="_blank" rel="noopener noreferrer">Ir a Rockstar Support ↗</a>
        </div>
      </div>
      <ul className="lp-checklist">
        {ROCKSTAR_CHECKLIST.map(([title, text]) => <li key={title}>
          <span className="lp-checklist__tick" aria-hidden="true">✓</span>
          <div><strong>{title}</strong><span>{text}</span></div>
        </li>)}
      </ul>
    </section>

    <section className="lp-section" aria-labelledby="lp-faq-title">
      <p className="lp-eyebrow">// Dudas</p>
      <h2 id="lp-faq-title" className="lp-h2">Preguntas <em>frecuentes.</em></h2>
      <div className="lp-faq">
        {FAQ.map(([question, answer], index) => <details key={question} className="lp-faq__item" open={index === 0}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>)}
      </div>
    </section>

    <section className="lp-final" aria-labelledby="lp-final-title">
      <h2 id="lp-final-title" className="lp-final__title"><SpecialTextContent>¿A quién vas a reportar hoy?</SpecialTextContent></h2>
      <p>Entra con Discord en un clic. Sin contraseñas nuevas, sin descargas.</p>
      {cta('Entrar con Discord')}
      <p className="lp-disclaimer">MostWanted es un proyecto comunitario independiente de Kaith's Rebels. No está afiliado ni respaldado por Rockstar Games ni Take-Two Interactive. Las sanciones las decide únicamente Rockstar.</p>
    </section>
  </main>;
}
