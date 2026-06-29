import { Link } from 'react-router-dom';
import WaveioLogo from '../ui/WaveioLogo';

const SessionEndedOverlay = ({ message }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A] px-6 text-center">
    <div className="max-w-md">
      <WaveioLogo size={56} showWordmark={false} className="justify-center" />
      <h2 className="mt-6 text-3xl font-black text-[#F5F5F5]">
        Session ended
      </h2>
      <p className="mt-3 text-[#888880]">
        {message || 'This session has ended.'}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/pricing"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-[#C9A84C] px-8 py-4 font-bold text-[#0A0A0A] transition hover:bg-[#F0C040]"
        >
          Upgrade to Pro
        </Link>
        <Link
          to="/"
          className="rounded-full border border-[#C9A84C22] px-8 py-4 text-sm text-[#888880] transition hover:border-[#C9A84C66]"
        >
          Back to home
        </Link>
      </div>
    </div>
  </div>
);

export default SessionEndedOverlay;
