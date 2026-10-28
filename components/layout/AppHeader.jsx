import SpecialText from '../ui/SpecialText';

export default function AppHeader({ search = null, actions = null }) {
  return (
    <header className="site-header">
      <div className="site-brand">
        <img src="/Logo.png" alt="Kaith's Rebels" width="44" height="44" />
        <div>
          <span className="site-brand__eyebrow">KAITH'S REBELS / DIVISIÓN H.E.X.</span>
          <h1><SpecialText>MOST WANTED</SpecialText><span className="site-brand__glitch" aria-hidden="true">MOST WANTED</span><span className="site-brand__glitch site-brand__glitch--echo" aria-hidden="true">MOST WANTED</span></h1>
        </div>
      </div>
      {search}
      <div className="site-header__actions">{actions}</div>
    </header>
  );
}
