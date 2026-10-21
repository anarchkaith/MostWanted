export default function DeskNavigation({ items }) {
  return (
    <nav className="desk-navigation" aria-label="Áreas del despacho">
      {items.map(({ href, number, label, current, onClick }) => (
        <a key={label} href={href} aria-current={current ? 'page' : undefined} onClick={onClick}>
          <span aria-hidden="true">{number}</span> {label}
        </a>
      ))}
    </nav>
  );
}
