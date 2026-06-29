import { useEffect, useMemo, useRef, useState } from 'react';

const BlurText = ({
  text = '',
  delay = 120,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  onAnimationComplete,
  stepDuration = 0.5
}) => {
  const elements = useMemo(() => (
    animateBy === 'letters' ? text.split('') : text.split(' ')
  ), [animateBy, text]);
  const [inView, setInView] = useState(false);
  const hasCompletedRef = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  const handleTransitionEnd = (index) => {
    if (index !== elements.length - 1 || hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onAnimationComplete?.();
  };

  return (
    <p ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
      {elements.map((segment, index) => {
        const offset = direction === 'top' ? '-22px' : '22px';
        return (
          <span
            key={`${segment}-${index}`}
            className="inline-block will-change-[transform,filter,opacity]"
            onTransitionEnd={() => handleTransitionEnd(index)}
            style={{
              opacity: inView ? 1 : 0,
              filter: inView ? 'blur(0px)' : 'blur(10px)',
              transform: inView ? 'translate3d(0, 0, 0)' : `translate3d(0, ${offset}, 0)`,
              transitionProperty: 'opacity, filter, transform',
              transitionDuration: `${stepDuration}s`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: `${(index * delay) / 1000}s`
            }}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </span>
        );
      })}
    </p>
  );
};

export default BlurText;
