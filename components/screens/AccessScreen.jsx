import '../../styles/AccessScreen.css';

export default function AccessScreen({ onLogin, error = '' }) {
  return (
    <main className="login-access" data-ui-sound="off">
      <div className="login-access__content">
        <div className="login-access__brand">
          <img src="/Logo.png" alt="" width="28" height="28" />
          <span>MostWanted</span>
        </div>
        <section className="login-access__card" aria-labelledby="login-access-title">
          <h1 id="login-access-title">Te damos la bienvenida</h1>
          <p className="login-access__intro">Entra con tu cuenta de Discord para consultar y compartir reportes.</p>
          {error && <p className="login-access__error" role="alert">{error}</p>}
          <button type="button" className="login-access__button" onClick={onLogin}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.7 5.2a18 18 0 0 0-4.4-1.4l-.5 1a16.3 16.3 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.3.7 13.3 1.1 17.2a18 18 0 0 0 5.4 2.7l1.1-1.8-1.6-.8.4-.3a12.8 12.8 0 0 0 11.2 0l.4.3-1.6.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.5-.8-8.5-3.2-12ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>
            Continuar con Discord
          </button>
          <div className="login-access__privacy">
            <details>
              <summary>Permisos y privacidad</summary>
              <p>Se solicita tu perfil básico, correo y pertenencia o rol en el servidor de Discord para identificar tu cuenta y comprobar permisos.</p>
              <p>Los administradores conservan tu ID, nombre, avatar y correo disponible, junto con los accesos registrados, actividad autenticada y reportes enviados, para administrar la plataforma y prevenir abusos. Estos datos de cuenta no se incluyen en las vistas públicas ni en los enlaces compartidos.</p>
              <ol>
                <li>MostWanted te redirige a Discord para autorizar el acceso mediante OAuth2.</li>
                <li>Discord muestra la aplicación y los permisos solicitados. Si no reconoces la aplicación o el dominio, cancela.</li>
                <li>Después de aceptar, vuelves a MostWanted con una sesión. MostWanted no recibe tu contraseña de Discord.</li>
              </ol>
              <p>Puedes retirar el acceso desde <strong>Discord → Ajustes de usuario → Aplicaciones autorizadas</strong>. Retirarlo no borra automáticamente los reportes ni los datos ya guardados.</p>
              <a href="https://support.discord.com/hc/es" target="_blank" rel="noopener noreferrer">Centro de ayuda oficial de Discord ↗</a>
            </details>
          </div>
        </section>
        <p className="login-access__note">Tu contraseña se queda en Discord.<br />Proyecto independiente de Discord y Rockstar Games.</p>
      </div>
    </main>
  );
}
