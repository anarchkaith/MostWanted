import { useId, useState } from 'react';

const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <span
      className="help-tooltip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={event => {
        if (!event.currentTarget.matches(':focus-within')) setVisible(false);
      }}
      onFocus={() => setVisible(true)}
      onBlur={event => {
        if (!event.currentTarget.matches(':hover')) setVisible(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setVisible(false);
        }
      }}
      tabIndex={0}
      aria-label={typeof text === 'string' ? text.split('\n')[0] : 'Más información'}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible && <span className="help-tooltip__content" id={id} role="tooltip">{text}</span>}
    </span>
  );
};

export default Tooltip;
