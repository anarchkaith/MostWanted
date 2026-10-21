export default function EmptyState({ role, children }) {
  return <p className="desk-empty" role={role}>{children}</p>;
}
