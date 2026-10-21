import { version as appVersion } from '../../package.json';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="site-footer__text">H.E.X. / Archivo de investigación comunitaria</span>
      <span className="site-footer__version" style={{ marginLeft: '8px' }}>v{appVersion}</span>
      <img src="/Logo.png" width="20" style={{ marginLeft: '8px' }} alt="Kaith's Rebels" className="site-footer__logo" />
    </footer>
  );
}
