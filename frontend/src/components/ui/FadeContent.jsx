import { useEffect, useRef, useState } from 'react';

const FadeContent = ({
  children,
  blur = false,
  duration = 700,
  delay = 0,
  threshold = 0.12,
  initialOpacity = 0,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  const durationMs = duration > 10 ? duration : duration * 1000;
  const delayMs = delay > 10 ? delay : delay * 1000;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : initialOpacity,
        filter: blur && !inView ? 'blur(10px)' : 'blur(0px)',
        transform: inView ? 'translate3d(0, 0, 0)' : 'translate3d(0, 24px, 0)',
        transition: `opacity ${durationMs}ms ease, filter ${durationMs}ms ease, transform ${durationMs}ms ease`,
        transitionDelay: `${delayMs}ms`,
        willChange: 'opacity, filter, transform',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default FadeContent;
