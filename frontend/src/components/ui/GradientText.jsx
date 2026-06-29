const GradientText = ({
  children,
  className = '',
  colors = ['#C9A84C', '#F0C040'],
  animationSpeed = 8,
  direction = 'horizontal'
}) => {
  const gradientAngle = direction === 'vertical' ? 'to bottom' : direction === 'diagonal' ? 'to bottom right' : 'to right';
  const gradientColors = [...colors, colors[0]].join(', ');

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
        backgroundSize: direction === 'vertical' ? '100% 300%' : '300% 100%',
        WebkitBackgroundClip: 'text',
        animation: `waveio-gradient-text ${animationSpeed}s ease-in-out infinite alternate`
      }}
    >
      {children}
      <style>{`
        @keyframes waveio-gradient-text {
          from { background-position: 0% 50%; }
          to { background-position: 100% 50%; }
        }
      `}</style>
    </span>
  );
};

export default GradientText;
