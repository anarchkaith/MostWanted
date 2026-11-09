export default function ReportInfractionPreload({ applied, onUndo }) {
  const total = (applied?.categories.length || 0) + (applied?.labels.length || 0);
  if (!total) return null;

  return <div className="infraction-preload" role="status">
    <p>HEX marcó {total} según tu relato. Desmarca lo que no corresponda.</p>
    <button type="button" className="infraction-preload__undo" onClick={onUndo}>Deshacer</button>
  </div>;
}
