export default function StatGrid({ items }) {
  return (
    <div className="case-summary">
      {items.map(({ label, value }, index) => (
        <div key={label ?? index}>
          {label !== undefined && <span>{label}</span>}
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
