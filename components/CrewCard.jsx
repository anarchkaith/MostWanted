import { useState } from 'react';
import { getCrewPrivacyLabel } from '../src/services/crewSearch';
import SpecialTextContent from './ui/SpecialTextContent';
import CrewChip from './CrewChip';
import '../styles/CrewCard.css';

export const CREW_TYPES = { chatterBoxes: 'Chatter Boxes', thrillSeekers: 'Thrill Seekers', rebels: 'Rebels', soldiers: 'Soldiers', allStars: 'All Stars' };

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000) return '';
  return `Creada el ${date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function CrewEmblem({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className="crew-card__emblem crew-card__emblem--empty" aria-hidden="true" />;
  return <img className="crew-card__emblem" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function MembersIcon() {
  return (
    <svg className="crew-card__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="crew-card__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10zm2 0h6V7a3 3 0 0 0-6 0z" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="crew-card__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8 8 0 0 1 0 4z" fill="currentColor" />
    </svg>
  );
}

function DivisionIcon() {
  return (
    <svg className="crew-card__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M3 20h18v2H3zM5 10h3v8H5zm5-4h3v12h-3zm5 6h3v6h-3z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="crew-card__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" fill="currentColor" />
    </svg>
  );
}

export default function CrewCard({ id, index, crew, isActive, onChoose }) {
  const privacy = getCrewPrivacyLabel(crew);
  const PrivacyIcon = privacy === 'Privada' ? LockIcon : GlobeIcon;
  const created = formatCreatedAt(crew.createdAt);
  const members = `${crew.memberCount} ${crew.memberCount === 1 ? 'miembro' : 'miembros'}`;

  return (
    <button type="button" role="option" aria-selected={isActive} id={`${id}-option-${index}`}
      className="crew-card" data-crew-type={CREW_TYPES[crew.crewType] ? crew.crewType : 'unknown'}
      onMouseDown={event => event.preventDefault()} onClick={() => onChoose(crew)}>
      <span className="crew-card__media">
        <CrewEmblem url={crew.emblemUrl} />
        {crew.crewTag && <CrewChip as="span" name={crew.crewName} tag={crew.crewTag} colour={crew.crewColour} />}
      </span>
      <span className="crew-card__identity">
        <strong className="crew-card__name" translate="no"><SpecialTextContent>{crew.crewName}</SpecialTextContent></strong>
        {crew.crewMotto && <span className="crew-card__motto"><SpecialTextContent>“{crew.crewMotto}”</SpecialTextContent></span>}
      </span>
      <span className="crew-card__facts">
        <span className="crew-card__stats">
          <span className="crew-card__stat"><MembersIcon />{members}</span>
          {crew.division && <span className="crew-card__stat"><DivisionIcon />División {crew.division}</span>}
        </span>
        <span className="crew-card__badges">
          {privacy && <span className="crew-card__badge crew-card__badge--icon" title={privacy} role="img" aria-label={privacy}><PrivacyIcon /></span>}
        </span>
        {created && <span className="crew-card__created">{created}</span>}
      </span>
      <span className="crew-card__action" aria-hidden="true"><PlusIcon /></span>
    </button>
  );
}
