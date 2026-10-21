export default function CyberButtonLabel({ children }) {
  return <>
    <span>{children}</span>
    <span className="glitchtext" aria-hidden="true">{children}</span>
  </>;
}
