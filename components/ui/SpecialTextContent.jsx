import { Children, cloneElement, Fragment, isValidElement, useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import SpecialText, { getSpecialTextSpeed, getSpecialTextWordEnds } from './SpecialText';

const RANDOM_CHARS = '_!X$0-+*#';
const GLITCH_BUFFER_WORDS = 5;

function getText(child) {
  if (Array.isArray(child)) return child.map(getText).join('');
  if (typeof child === 'string' || typeof child === 'number') return String(child);
  if (!isValidElement(child) || child.props['aria-hidden'] === true) return '';
  if (child.type !== Fragment && typeof child.type !== 'string' && !child.props.children) return '';
  return getText(child.props.children);
}

function getRandomChar(previous) {
  let char;
  do {
    char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  } while (char === previous);
  return char;
}

function renderGroupText(child, reveal, glitchEnd, startIndex) {
  if (Array.isArray(child)) {
    let offset = startIndex;
    return Children.map(child, nested => {
      const rendered = renderGroupText(nested, reveal, glitchEnd, offset);
      offset += Array.from(getText(nested)).length;
      return rendered;
    });
  }
  if (typeof child === 'string' || typeof child === 'number') {
    const text = String(child);
    let previous;
    const output = Array.from(text, (char, index) => {
      const position = startIndex + index;
      if (/\s/.test(char) || position < reveal) {
        previous = char;
        return char;
      }
      if (position < glitchEnd) {
        previous = getRandomChar(previous);
        return previous;
      }
      return '\u00a0';
    }).join('');
    return <span className="mw-special-text" aria-hidden="true">{output}</span>;
  }
  if (!isValidElement(child) || child.props['aria-hidden'] === true) return child;

  let offset = startIndex;
  const children = Children.map(child.props.children, nested => {
    const rendered = renderGroupText(nested, reveal, glitchEnd, offset);
    offset += Array.from(getText(nested)).length;
    return rendered;
  });
  return cloneElement(child, { children });
}

function animateText(child) {
  if (typeof child === 'string') {
    return child.trim() ? <SpecialText>{child}</SpecialText> : child;
  }
  if (typeof child === 'number') {
    return <SpecialText>{String(child)}</SpecialText>;
  }
  if (!isValidElement(child) || child.type === SpecialText) return child;
  if (child.props['aria-hidden'] === true) return child;
  if (child.type !== Fragment && typeof child.type !== 'string') return child;

  return cloneElement(child, {
    children: Children.map(child.props.children, animateText),
  });
}

function GroupedSpecialTextContent({ children, speed, delay = 0, once = true }) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once, margin: '0px' });
  const reduceMotion = useReducedMotion();
  const text = getText(children);
  const total = Array.from(text).length;
  const animationSpeed = speed ?? getSpecialTextSpeed(text);
  const wordEnds = getSpecialTextWordEnds(text);
  const [reveal, setReveal] = useState(reduceMotion ? total : 0);

  useEffect(() => {
    if (!isInView || !total || !wordEnds.length || reduceMotion) {
      setReveal(total);
      return undefined;
    }

    setReveal(0);
    let step = 0;
    const steps = total;
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        step += 1;
        setReveal(step);
        if (step >= steps) {
          window.clearInterval(intervalId);
        }
      }, animationSpeed);
    }, delay * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [animationSpeed, delay, isInView, reduceMotion, text, total, wordEnds.length]);

  const bufferedWord = wordEnds.findIndex(end => end > reveal);
  const glitchEnd = bufferedWord < 0 || !isInView
    ? total
    : wordEnds[Math.min(bufferedWord + GLITCH_BUFFER_WORDS - 1, wordEnds.length - 1)];

  return (
    <span ref={containerRef} className="mw-special-text-group" aria-label={text}>
      {renderGroupText(children, reveal, glitchEnd, 0)}
    </span>
  );
}

export default function SpecialTextContent({ children, group = false, speed, delay, once }) {
  if (group) {
    return <GroupedSpecialTextContent speed={speed} delay={delay} once={once}>{children}</GroupedSpecialTextContent>;
  }
  return Children.map(children, animateText);
}
