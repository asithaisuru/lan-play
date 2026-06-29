import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import WaveioLogo from '../ui/WaveioLogo';

const AdOverlay = ({
  ad,
  duration = 10,
  skippableAfter = 5,
  onSkip,
  onEnd
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [canSkip, setCanSkip] = useState(false);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    setTimeLeft(duration);
    setCanSkip(false);

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          onEndRef.current?.();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, skippableAfter * 1000);

    return () => {
      clearInterval(timer);
      clearTimeout(skipTimer);
    };
  }, [duration, skippableAfter]);

  const skipCountdown = Math.max(0, skippableAfter - (duration - timeLeft));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0A]/95 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md text-center">
        <WaveioLogo size={48} showWordmark={false} className="justify-center" />
        <p className="mt-4 text-xs font-bold uppercase text-[#888880]">
          Advertisement
        </p>
        <h2 className="mt-3 text-3xl font-black text-[#F5F5F5]">
          {ad?.title || 'KRODOT'}
        </h2>
        <p className="mt-2 text-[#888880]">
          {ad?.description || 'Crown of Technology'}
        </p>
        {ad?.url && (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-[#C9A84C] transition hover:text-[#F0C040]"
          >
            Learn more
          </a>
        )}
        <div className="mt-8 flex items-center justify-center gap-6">
          {canSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-[#C9A84C] px-8 py-3 text-sm font-bold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-[#0A0A0A]"
            >
              Skip ad
            </button>
          ) : (
            <p className="text-sm text-[#888880]">
              Skip in {skipCountdown}s
            </p>
          )}
          <p className="font-mono text-sm text-[#888880]">
            {timeLeft}s
          </p>
        </div>
        <Link
          to="/pricing"
          className="mt-6 inline-block text-xs text-[#888880] transition hover:text-[#C9A84C]"
        >
          Remove ads with Pro
        </Link>
      </div>
    </div>
  );
};

export default AdOverlay;
