export default function CyberButtonLabel({ children }) {
  return <>
    <span>{children}</span>
    <span className="glitchtext" aria-hidden="true">
      <span className="mw-button-glitch">{children}</span>
      <span className="mw-button-glitch mw-button-glitch--echo">{children}</span>
    </span>
  </>;
}
