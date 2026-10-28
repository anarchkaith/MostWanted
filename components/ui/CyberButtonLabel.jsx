import SpecialTextContent from './SpecialTextContent';

export default function CyberButtonLabel({ children }) {
  return <>
    <span className="mw-cyber-label"><SpecialTextContent>{children}</SpecialTextContent></span>
    <span className="glitchtext" aria-hidden="true">{children}</span>
  </>;
}
