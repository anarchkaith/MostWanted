import CyberButtonLabel from '../ui/CyberButtonLabel';
import SpecialText from '../ui/SpecialText';
import HighlightedText from '../ui/HighlightedText';

export default function AccessScreen({ onLogin }) {
  return (
    <main className="desk-access-stage">
      <section className="desk-access desk-access--discord" aria-labelledby="desk-access-title">
        <p className="workspace-eyebrow">MOSTWANTED</p>
        <div className="desk-access__connection" aria-hidden="true">
          <img src="/Logo.png" alt="" width="56" height="56" />
          <span className="desk-access__connection-line">···</span>
          <span className="desk-access__provider">Discord</span>
        </div>
        <h2 id="desk-access-title"><SpecialText>Tu voto cuenta</SpecialText></h2>
        <p className="desk-access__intro">Usamos Discord para ayudar a <HighlightedText>prevenir votos duplicados y fraude</HighlightedText>.</p>
        <button type="button" className="cyber-button mw-cyber-button desk-access__login" onClick={onLogin}><CyberButtonLabel>Continuar con Discord ↗</CyberButtonLabel></button>
        <p className="desk-access__destination"><span aria-hidden="true">↗ </span>Usamos solo tu nombre de usuario de <strong>discord.com</strong> para evitar reportes falsos.</p>
        <div className="desk-access__trust">
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
        <p className="desk-access__independent">Proyecto comunitario independiente de Discord y Rockstar Games.</p>
      </section>
    </main>
  );
}
