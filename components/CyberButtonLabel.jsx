export default function CyberButtonLabel({ children }) {
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : null;
  return <>
    <span>{children}</span>
    <span className="glitchtext" aria-hidden="true">
      {text === null ? children : <span className="glitch-letters">{Array.from(text).map((letter, index) => (
        <span key={index}>{letter === ' ' ? '\u00a0' : letter}</span>
      ))}</span>}
    </span>
  </>;
}
