import { useState } from 'react';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialTextContent from '../ui/SpecialTextContent';

function TutorialStep({ number, icon, title, description }) {
  return (
    <div className="landing-step">
      <div className="landing-step__number">{number}</div>
      <div className="landing-step__icon">{icon}</div>
      <h3 className="landing-step__title">{title}</h3>
      <p className="landing-step__description">{description}</p>
    </div>
  );
}

function FAQItem({ question, answer, open = false }) {
  const [isOpen, setIsOpen] = useState(open);
  return (
    <details className="landing-faq__item" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary className="landing-faq__question">{question}</summary>
      <p className="landing-faq__answer">{answer}</p>
    </details>
  );
}

export default function LandingScreen({ onNavigate }) {
  return (
    <main className="landing-screen">
      {/* HERO SECTION */}
      <section className="landing-hero">
        <div className="landing-hero__content">
          <div className="landing-hero__badge">☠️ JUSTICIA GAMING</div>
          <h1 className="landing-hero__title">
            <SpecialTextContent>MOST WANTED</SpecialTextContent>
          </h1>
          <p className="landing-hero__subtitle">
            Sistema de reportes para modders, griefers y ardidos. 
            <br />
            <strong>La comunidad decide quién se va.</strong>
          </p>
          <div className="landing-hero__actions">
            <button
              type="button"
              className="cyber-button mw-cyber-button"
              onClick={() => onNavigate('/denunciar')}
            >
              <CyberButtonLabel>🚨 Reportar Jugador</CyberButtonLabel>
            </button>
            <button
              type="button"
              className="cyber-button mw-cyber-button mw-cyber-button--secondary"
              onClick={() => onNavigate('/#reportes-lista')}
            >
              <CyberButtonLabel>🔎 Ver Reportes</CyberButtonLabel>
            </button>
          </div>
        </div>
        <div className="landing-hero__graphic">
          <img src="/Logo.png" alt="MOST WANTED" width="200" height="200" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="landing-tutorial" aria-labelledby="landing-tutorial-title">
        <div className="landing-tutorial__header">
          <h2 id="landing-tutorial-title" className="landing-tutorial__title">
            <SpecialTextContent>Cómo funciona</SpecialTextContent>
          </h2>
          <p className="landing-tutorial__subtitle">3 pasos simples para justicia gaming</p>
        </div>

        <div className="landing-steps">
          <TutorialStep
            number="1"
            icon="🔍"
            title="Busca al jugador"
            description="Escribe el nombre o RID del jugador problemático. Verás todos sus reportes, datos y validación de la comunidad."
          />
          <TutorialStep
            number="2"
            icon="📝"
            title="Haz tu reporte"
            description="Describe lo que pasó, adjunta evidencias (fotos, videos). Selecciona el tipo de infracción: modding, griefing, comportamiento tóxico, etc."
          />
          <TutorialStep
            number="3"
            icon="📊"
            title="Acumula reportes"
            description="Más reportes = mayor credibilidad. La comunidad vota. Con suficientes reportes validados, el jugador puede ser baneado."
          />
        </div>
      </section>

      {/* WHY EVIDENCE MATTERS */}
      <section className="landing-importance" aria-labelledby="landing-importance-title">
        <div className="landing-importance__header">
          <h2 id="landing-importance-title">
            <SpecialTextContent>Por qué importan las evidencias</SpecialTextContent>
          </h2>
        </div>
        <div className="landing-importance__content">
          <div className="landing-importance__item">
            <span className="landing-importance__icon">✓</span>
            <div>
              <h3>Reportes con evidencia = Más creíbles</h3>
              <p>Las capturas o videos demuestran que el jugador estaba haciendo algo ilícito.</p>
            </div>
          </div>
          <div className="landing-importance__item">
            <span className="landing-importance__icon">✓</span>
            <div>
              <h3>Sin evidencia = Menos peso</h3>
              <p>Los reportes sin pruebas son más fáciles de descartar. Adjunta algo si puedes.</p>
            </div>
          </div>
          <div className="landing-importance__item">
            <span className="landing-importance__icon">✓</span>
            <div>
              <h3>Reportes fraudulentos se detectan</h3>
              <p>La comunidad vota. Reportes falsos bajan tu credibilidad. Reporta solo si es real.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-faq" aria-labelledby="landing-faq-title">
        <div className="landing-faq__header">
          <h2 id="landing-faq-title">
            <SpecialTextContent>Preguntas frecuentes</SpecialTextContent>
          </h2>
        </div>
        <div className="landing-faq__items">
          <FAQItem
            question="¿Es anónimo reportar?"
            answer="No, tu nombre de Discord se adjunta al reporte. Esto aumenta la credibilidad. No te preocupes, los datos privados no se publican."
          />
          <FAQItem
            question="¿Qué tipo de infracciones se pueden reportar?"
            answer="Modders (mods/hacks), griefers (trolls intencionales), comportamiento tóxico extremo, scams, y otros problemas que afecten la experiencia de otros jugadores."
          />
          <FAQItem
            question="¿Mi reporte puede ser rechazado?"
            answer="Sí. Si no hay evidencia clara, si es spam, o si la comunidad vota que no es válido. Asegúrate de incluir detalles y pruebas."
          />
          <FAQItem
            question="¿Cuánto tarda en banear a alguien?"
            answer="No lo sabemos. Rockstar toma sus propias decisiones. MostWanted es una herramienta comunitaria, no oficial. Los reportes sirven para notificar y evidenciar patrones."
          />
          <FAQItem
            question="¿Puedo editar mi reporte después de enviarlo?"
            answer="Sí, en la sección 'Mis reportes' puedes editar detalles, agregar evidencias, o cambiar la clasificación antes de ser validado."
          />
          <FAQItem
            question="¿Qué pasa si reporto a alguien falsamente?"
            answer="Tu reputación baja. Si haces muchos reportes falsos, la comunidad no confiará en ti y tus futuros reportes tendrán menos peso."
            open={true}
          />
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="landing-footer">
        <div className="landing-footer__content">
          <h2>¿Listo para reportar?</h2>
          <p>Ayuda a mantener la comunidad limpia de modders y griefers.</p>
          <button
            type="button"
            className="cyber-button mw-cyber-button"
            onClick={() => onNavigate('/denunciar')}
          >
            <CyberButtonLabel>🚨 Hacer reporte ahora</CyberButtonLabel>
          </button>
        </div>
      </section>
    </main>
  );
}
