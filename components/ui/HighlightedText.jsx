import { motion, useReducedMotion } from 'motion/react';

const directions = {
  left: { hidden: { x: '-100%' }, visible: { x: '0%' } },
  right: { hidden: { x: '100%' }, visible: { x: '0%' } },
  top: { hidden: { y: '-100%' }, visible: { y: '0%' } },
  bottom: { hidden: { y: '100%' }, visible: { y: '0%' } },
};

export default function HighlightedText({
  children,
  className = '',
  from = 'bottom',
  delay = 0,
  inView = true,
  once = true,
}) {
  const reduceMotion = useReducedMotion();
  const variants = directions[from] || directions.bottom;

  return (
    <motion.span
      className={`mw-highlighted-text ${className}`.trim()}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={inView && !reduceMotion ? 'visible' : undefined}
      animate={!inView || reduceMotion ? 'visible' : undefined}
      viewport={{ once }}
    >
      <motion.span
        className="mw-highlighted-text__bar"
        variants={variants}
        transition={reduceMotion ? { duration: 0 } : {
          type: 'tween',
          duration: 0.9,
          ease: [0.22, 1, 0.36, 1],
          delay,
        }}
        aria-hidden="true"
      />
      <span className="mw-highlighted-text__content">{children}</span>
    </motion.span>
  );
}
