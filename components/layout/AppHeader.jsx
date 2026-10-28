import CyberButtonLabel from '../ui/CyberButtonLabel';

export default function AppHeader({ search = null, actions = null }) {
  return (
    <header className="site-header">
      <div className="site-brand">
        <img src="/Logo.png" alt="Kaith's Rebels" width="44" height="44" />
        <div>
          <span className="site-brand__eyebrow">KAITH'S REBELS / DIVISIÓN H.E.X.</span>
          <h1><CyberButtonLabel>MOST WANTED</CyberButtonLabel></h1>
        </div>
      </div>
      {search}
      <div className="site-header__actions">{actions}</div>
    </header>
  );
}
