const WaveioLogo = ({
  size = 32,
  color = '#C9A84C',
  showWordmark = true,
  className = ''
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 1280 1280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="264,217 385,217 385,979 264,895"
        fill={color}
      />
      <rect x="424" y="503" width="114" height="537"
            fill={color}/>
      <rect x="576" y="675" width="103" height="254"
            fill={color}/>
      <rect x="717" y="503" width="114" height="537"
            fill={color}/>
      <polygon
        points="870,217 990,217 990,895 870,979"
        fill={color}
      />
    </svg>
    {showWordmark && (
      <span style={{
        fontSize: size * 0.5,
        fontWeight: 700,
        color: color,
        letterSpacing: 0,
        lineHeight: 1
      }}>
        Waveio
      </span>
    )}
  </div>
);

export default WaveioLogo;
