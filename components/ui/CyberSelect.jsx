import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SpecialText from './SpecialText';

export default function CyberSelect({ id, value, options, onChange, disabled = false, 'aria-label': label }) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const trigger = useRef(null);
  const list = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({});
  const selected = options.findIndex(option => option.value === value);
  const expanded = open && !disabled && options.length > 0;

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const upwards = below < 180 && above > below;
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight: Math.max(48, Math.min(280, upwards ? above : below)),
      ...(upwards ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOutside = event => {
      if (!trigger.current?.contains(event.target) && !list.current?.contains(event.target)) setOpen(false);
    };
    const closeOnScroll = event => {
      if (!list.current?.contains(event.target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [expanded]);

  useEffect(() => {
    if (expanded) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded]);

  const choose = index => {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
  };
  const show = () => {
    setActive(Math.max(0, selected));
    setOpen(true);
  };
  return (
    <div className="cyber-select-full mw-cyber-select">
      <button ref={trigger} id={controlId} type="button" className="mw-select-trigger" role="combobox" aria-label={label}
        aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && options[active] ? `${listId}-${active}` : undefined}
        disabled={disabled || !options.length} onClick={() => expanded ? setOpen(false) : show()} onBlur={() => setOpen(false)}
        onKeyDown={event => {
          if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          else if (event.key === 'Tab') setOpen(false);
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!expanded) show();
            else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
          } else if (expanded && ['Home', 'End'].includes(event.key)) {
            event.preventDefault();
            setActive(event.key === 'Home' ? 0 : options.length - 1);
          } else if (expanded && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            choose(active);
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
            const now = Date.now();
            search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase(), time: now };
            const index = options.findIndex(option => option.label.toLocaleLowerCase().startsWith(search.current.text));
            if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
          }
        }}>
        <SpecialText>{options[selected]?.label || 'Seleccionar'}</SpecialText>
      </button>
      {expanded && createPortal(
        <div ref={list} id={listId} className="mw-select-options" role="listbox" aria-label={label} aria-labelledby={label ? undefined : controlId} style={position}>
          {options.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option"
            aria-selected={value === option.value} data-active={active === index} tabIndex={-1}
            onMouseDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
            <SpecialText>{option.label}</SpecialText>
          </button>)}
        </div>, trigger.current?.closest('[role="dialog"]') || document.body,
      )}
    </div>
  );
}
