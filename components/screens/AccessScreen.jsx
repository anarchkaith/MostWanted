import { useState } from 'react';
import HelpModal from '../HelpModal';
import '../../styles/AccessScreen.css';

export default function AccessScreen({ onLogin, error = '' }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <main className="login-access" data-ui-sound="off">
      <div className="login-access__content">
        <div className="login-access__brand">
          <img src="/Logo.png" alt="" width="28" height="28" />
          <span>MostWanted</span>
        </div>
        <section className="login-access__card" aria-labelledby="login-access-title">
          <h1 id="login-access-title">Te damos la bienvenida de nuevo</h1>
          <p className="login-access__intro">Inicia sesión con tu cuenta de Discord</p>
          {error && <p className="login-access__error" role="alert">{error}</p>}
          <button type="button" className="login-access__button" onClick={onLogin}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.7 5.2a18 18 0 0 0-4.4-1.4l-.5 1a16.3 16.3 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.3.7 13.3 1.1 17.2a18 18 0 0 0 5.4 2.7l1.1-1.8-1.6-.8.4-.3a12.8 12.8 0 0 0 11.2 0l.4.3-1.6.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.5-.8-8.5-3.2-12ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>
            Iniciar sesión con Discord
          </button>
          <p className="login-access__help">¿Necesitas ayuda? <button type="button" onClick={() => setShowHelp(true)}>Consulta nuestra ayuda</button></p>
          <div className="login-access__privacy">
            <details>
              <summary>Permisos y privacidad</summary>
              <p>Discord te mostrará los permisos para acceder a tu perfil, correo y roles del servidor.</p>
              <p>Lo usaras para gestionar tus reportes y prevenir abusos. Solo tu puedes ver tus datos. Los datos no se almacenan.</p>
              <p>Puedes retirar el acceso en <strong>Discord → Aplicaciones autorizadas</strong>; esto no elimina lo ya guardado.</p>
            </details>
          </div>
          <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
        </section>
      </div>
    </main>
  );
}
