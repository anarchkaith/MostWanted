import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

export default function RandomizedText({
  children,
  className = '',
  split = 'words',
  delay = 0.2,
  inView = false,
  once = true,
}) {
  const reduceMotion = useReducedMotion();
  const elements = useMemo(() => {
    if (split === 'chars') {
      return [...children].map((char, index) => ({
        content: char === ' ' ? '\u00a0' : char,
        key: `char-${index}`,
      }));
    }

    return children.split(' ').map((word, index) => ({
      content: word,
      key: `word-${index}`,
    }));
  }, [children, split]);
  const delays = useMemo(
    () => elements.map(() => delay + Math.random() * 0.23),
    [elements, delay],
  );
  return (
    <motion.span
      className={className}
      aria-label={children}
      style={{ display: 'inline-block', wordBreak: 'break-word' }}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={inView && !reduceMotion ? 'visible' : undefined}
      animate={!inView || reduceMotion ? 'visible' : undefined}
      viewport={{ once }}
    >
      {elements.map((element, index) => (
        <motion.span
          key={element.key}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
          }}
          transition={{
            duration: reduceMotion ? 0 : 1.2,
            delay: reduceMotion ? 0 : delays[index],
            ease: (time) => (time === 1 ? 1 : 1 - 2 ** (-10 * time)),
          }}
          style={{ display: split === 'words' ? 'inline-block' : 'inline' }}
          className={split === 'words' ? 'mw-randomized-text__word' : ''}
          aria-hidden="true"
        >
          {element.content}
        </motion.span>
      ))}
    </motion.span>
  );
}
