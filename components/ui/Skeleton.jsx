export default function Skeleton({ label = 'Cargando…', rows = 3, className = '' }) {
  return (
    <div className={`mw-skeleton ${className}`} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => <span className="mw-skeleton__line" key={index} />)}
      </div>
    </div>
  );
}
