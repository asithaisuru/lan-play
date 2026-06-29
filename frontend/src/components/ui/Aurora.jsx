const Aurora = ({
  colorStops = ['#C9A84C', '#F0C040', '#C9A84C'],
  amplitude = 1,
  blend = 0.55,
  className = ''
}) => {
  const primary = colorStops[0] || '#C9A84C';
  const secondary = colorStops[1] || '#F0C040';
  const tertiary = colorStops[2] || primary;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#0A0A0A] ${className}`}
      aria-hidden="true"
      style={{
        '--aurora-primary': primary,
        '--aurora-secondary': secondary,
        '--aurora-tertiary': tertiary,
        '--aurora-amplitude': amplitude,
        '--aurora-blend': blend
      }}
    >
      <div className="aurora-layer aurora-layer-one" />
      <div className="aurora-layer aurora-layer-two" />
      <div className="aurora-layer aurora-layer-three" />
      <div className="absolute inset-0 bg-[#0A0A0A]/45" />
      <style>{`
        .aurora-layer {
          position: absolute;
          inset: -30%;
          opacity: calc(0.42 * var(--aurora-blend));
          filter: blur(72px);
          mix-blend-mode: screen;
          transform-origin: center;
        }
        .aurora-layer-one {
          background:
            radial-gradient(circle at 20% 30%, var(--aurora-primary), transparent 34%),
            radial-gradient(circle at 78% 20%, var(--aurora-secondary), transparent 30%);
          animation: waveio-aurora-drift-one calc(18s / var(--aurora-amplitude)) ease-in-out infinite alternate;
        }
        .aurora-layer-two {
          background:
            radial-gradient(circle at 32% 72%, var(--aurora-tertiary), transparent 32%),
            radial-gradient(circle at 72% 76%, var(--aurora-primary), transparent 38%);
          opacity: calc(0.28 * var(--aurora-blend));
          animation: waveio-aurora-drift-two calc(24s / var(--aurora-amplitude)) ease-in-out infinite alternate;
        }
        .aurora-layer-three {
          background: linear-gradient(115deg, transparent 16%, var(--aurora-primary) 44%, transparent 72%);
          opacity: calc(0.18 * var(--aurora-blend));
          animation: waveio-aurora-sweep calc(20s / var(--aurora-amplitude)) ease-in-out infinite alternate;
        }
        @keyframes waveio-aurora-drift-one {
          from { transform: translate3d(-4%, -3%, 0) rotate(-8deg) scale(1); }
          to { transform: translate3d(5%, 4%, 0) rotate(8deg) scale(1.1); }
        }
        @keyframes waveio-aurora-drift-two {
          from { transform: translate3d(6%, 5%, 0) rotate(10deg) scale(1.05); }
          to { transform: translate3d(-5%, -4%, 0) rotate(-9deg) scale(1.15); }
        }
        @keyframes waveio-aurora-sweep {
          from { transform: translate3d(-8%, 2%, 0) rotate(-12deg) scale(1.2); }
          to { transform: translate3d(8%, -4%, 0) rotate(12deg) scale(1.35); }
        }
      `}</style>
    </div>
  );
};

export default Aurora;
