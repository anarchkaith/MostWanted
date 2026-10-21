import Button from '../ui/Button';

export default function AccessScreen({ onLogin }) {
  return (
    <main className="desk-access-stage">
      <section className="desk-access" aria-labelledby="desk-access-title">
        <h2 id="desk-access-title" className="cyber-h">Acceso al despacho</h2>
        <p>Consulta jugadores y registra reportes de la comunidad.</p>
        <Button size="large" onClick={onLogin}>Iniciar sesión con Discord</Button>
      </section>
    </main>
  );
}
