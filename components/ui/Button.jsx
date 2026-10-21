import CyberButtonLabel from './CyberButtonLabel';

export default function Button({ variant = 'primary', size = 'small', glitch = true, className = '', type = 'button', children, ...props }) {
  const classes = [
    size === 'large' ? 'cyber-button' : 'cyber-button-small',
    'mw-cyber-button',
    variant === 'secondary' && 'mw-cyber-button--secondary',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...props}>
      {glitch ? <CyberButtonLabel>{children}</CyberButtonLabel> : children}
    </button>
  );
}
