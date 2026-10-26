import { useTerminalText } from './useTerminalText';

export default function TerminalText({ text, as: Tag = 'span', sound = true, className = '', ...rest }) {
  const { visible, typing } = useTerminalText(text, { sound });
  const classes = ['terminal-text', typing && 'terminal-text--typing', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      <span aria-hidden="true">{visible}</span>
      {typing && <span className="terminal-text__cursor" aria-hidden="true" />}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
