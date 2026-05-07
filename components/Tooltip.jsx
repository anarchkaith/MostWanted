import React, { useState } from 'react';

/**
 * Tooltip reutilizable con título destacado y contenido secundario.
 * Props:
 * - text: contenido (string o JSX)
 * - children: elemento que activa el tooltip
 */
const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          zIndex: 100,
          top: '120%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#222',
          color: '#fff',
          padding: '0.6em 1em',
          borderRadius: 8,
          fontSize: '0.98em',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          minWidth: 300,
          whiteSpace: 'normal',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'var(--font-typewriter, "Blender Pro", monospace)',
            fontWeight: 700,
            fontSize: '1.08em',
            letterSpacing: '0.01em',
            display: 'block',
            marginBottom: 4,
            color: '#ff3333',
            textShadow: '0 1px 4px #1a1a1a',
          }}>
            {typeof text === 'string' ? text.split('\n')[0] : (text.props && text.props.children && text.props.children[0])}
          </span>
          <span style={{ fontFamily: 'var(--font-typewriter, "Blender Pro", monospace)', fontWeight: 400 }}>
            {typeof text === 'string' ? text.split('\n').slice(1).join('\n') : (text.props && text.props.children && text.props.children.slice(1))}
          </span>
        </span>
      )}
    </span>
  );
};

export default Tooltip;
