export default function SocialClubProfileLink({ name }) {
  const member = String(name || '').trim();
  if (!member) return null;
  return (
    <a className="pbp-social-button" href={`https://socialclub.rockstargames.com/members/${encodeURIComponent(member)}/`} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${name} en Social Club`} title={`Ver ${name} en Social Club`}>
      <span>Ver perfil</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7" />
      </svg>
    </a>
  );
}
