import React from 'react';

/**
 * HelpIcon - Ícono SVG de ayuda (signo de pregunta en círculo)
 * Props: style, ...props
 */
const HelpIcon = ({ style = {}, ...props }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline', verticalAlign: 'middle', ...style }}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <circle cx="11" cy="11" r="10" stroke="#ff3333" strokeWidth="2.2" fill="#1a1a1a" />
    <text x="11" y="16" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#ff3333" fontFamily="var(--font-typewriter, 'Blender Pro', monospace)">?</text>
  </svg>
);

export default HelpIcon;
