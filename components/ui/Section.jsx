export default function Section({ title, className = '', children, ...props }) {
  return (
    <section className={['case-section', className].filter(Boolean).join(' ')} {...props}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
