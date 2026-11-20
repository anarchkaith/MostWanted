import SpecialTextContent from './ui/SpecialTextContent';
import '../styles/CrewChip.css';

export default function CrewChip({ name, tag, colour, onRemove, disabled = false, as: Root = 'li' }) {
  return <Root className="crew-chip" style={{ '--crew-colour': colour || 'var(--color-cream)' }} title={name}>
    <span translate="no"><SpecialTextContent>{tag || name}</SpecialTextContent></span>
    {onRemove && <button type="button" aria-label={`Quitar ${name}`} disabled={disabled} onClick={onRemove}>×</button>}
  </Root>;
}
