import Button from '../ui/Button';

export default function AccessScreen({ onLogin }) {
  return (
    <main className="desk-access-stage">
      <section className="desk-access" aria-labelledby="desk-access-title">
        <p className="workspace-eyebrow">Acceso verificado con Discord</p>
        <h2 id="desk-access-title" className="cyber-h">Acceso al despacho</h2>
        <p>Consulta jugadores y registra reportes de la comunidad.</p>
        <Button size="large" onClick={onLogin}>Iniciar sesión con Discord</Button>
        <div className="desk-access__trust">
          <h3>Antes de entrar</h3>
          <ul>
            <li>Te llevará a discord.com, la plataforma oficial. Esta web nunca ve tu contraseña.</li>
            <li>Discord te muestra los permisos que se piden antes de que aceptes.</li>
            <li>Los administradores conservan tu ID, nombre, avatar y correo de Discord disponible, junto con tus accesos, actividad autenticada y reportes enviados, para administrar y prevenir abusos. Estos datos no se publican.</li>
            <li>Se pide tu perfil básico, tu correo y tu rol en el servidor, para comprobar si tienes acceso.</li>
            <li>La sesión viaja en una cookie protegida que el navegador no expone a scripts.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
