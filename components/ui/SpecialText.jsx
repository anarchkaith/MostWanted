import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

const RANDOM_CHARS = '_!X$0-+*#';
const FAST_TEXT_LENGTH = 20;
const NORMAL_TEXT_LENGTH = 80;
const GLITCH_BUFFER_WORDS = 5;

export function getSpecialTextSpeed(text) {
  const length = Array.from(String(text ?? '')).length;
  if (length <= FAST_TEXT_LENGTH) return 8;
  if (length <= NORMAL_TEXT_LENGTH) return 12;
  return 18;
}

export function getSpecialTextWordEnds(text) {
  const wordEnds = [];
  let inWord = false;
  Array.from(text).forEach((char, index) => {
    if (/\s/.test(char)) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      wordEnds.push(index + 1);
    } else {
      wordEnds[wordEnds.length - 1] = index + 1;
    }
  });
  return wordEnds;
}

function getRandomChar(previous) {
  let char;
  do {
    char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  } while (char === previous);
  return char;
}

function renderText(text, reveal, glitchEnd) {
  let previousRandomChar;
  return Array.from(text, (char, index) => {
    if (/\s/.test(char) || index < reveal) {
      previousRandomChar = char;
      return char;
    }
    if (index < glitchEnd) {
      previousRandomChar = getRandomChar(previousRandomChar);
      return previousRandomChar;
    }
    return '\u00a0';
  }).join('');
}

export default function SpecialText({
  children,
  speed,
  delay = 0,
  className = '',
  inView = true,
  once = true,
}) {
  const text = String(children ?? '');
  const animationSpeed = speed ?? getSpecialTextSpeed(text);
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
    const wordEnds = getSpecialTextWordEnds(text);
    const steps = characters.length;
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        step += 1;
        if (step >= steps) {
          setDisplayText(text);
          window.clearInterval(intervalId);
          return;
        }
        const reveal = step;
        const bufferedWord = wordEnds.findIndex(end => end > reveal);
        const glitchEnd = bufferedWord < 0
          ? characters.length
          : wordEnds[Math.min(bufferedWord + GLITCH_BUFFER_WORDS - 1, wordEnds.length - 1)];
        setDisplayText(renderText(text, reveal, glitchEnd));
      }, reduceMotion ? Math.max(animationSpeed, 25) : animationSpeed);
    }, delay * 1000);

    const firstGlitchEnd = wordEnds[Math.min(GLITCH_BUFFER_WORDS - 1, wordEnds.length - 1)];
    setDisplayText(renderText(text, 0, firstGlitchEnd));
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [text, animationSpeed, delay, shouldAnimate, reduceMotion]);

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
