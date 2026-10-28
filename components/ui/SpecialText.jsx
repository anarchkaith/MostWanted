import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

const RANDOM_CHARS = '_!X$0-+*#';
const MAX_STEPS = 32;

function getRandomChar(previous) {
  let char;
  do {
    char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  } while (char === previous);
  return char;
}

export default function SpecialText({
  children,
  speed = 20,
  delay = 0,
  className = '',
  inView = true,
  once = true,
}) {
  const text = String(children ?? '');
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once, margin: '0px' });
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !inView || isInView;
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    if (!shouldAnimate || !text.length) {
      setDisplayText(text);
      return undefined;
    }

    let step = 0;
    const characters = Array.from(text);
    const steps = reduceMotion
      ? Math.min(Math.max(characters.length, 6), 8)
      : Math.min(Math.max(characters.length, 12), MAX_STEPS);
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        step += 1;
        const revealed = Math.floor((step / steps) * characters.length);
        let previousRandomChar;
        const nextText = characters.map((char, index) => {
          if (/\s/.test(char) || index < revealed) {
            previousRandomChar = char;
            return char;
          }
          previousRandomChar = getRandomChar(previousRandomChar);
          return previousRandomChar;
        }).join('');

        if (step >= steps) {
          setDisplayText(text);
          window.clearInterval(intervalId);
          return;
        }
        setDisplayText(nextText);
      }, reduceMotion ? Math.max(speed, 25) : speed);
    }, delay * 1000);

    setDisplayText(characters.map(char => /\s/.test(char) ? char : '\u00a0').join(''));
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [text, speed, delay, shouldAnimate, reduceMotion]);

  return (
    <span
      ref={containerRef}
      className={`mw-special-text ${className}`.trim()}
      aria-label={text}
    >
      <span aria-hidden="true">{displayText}</span>
    </span>
  );
}
