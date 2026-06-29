import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import WaveioLogo from '../components/ui/WaveioLogo';

const NotFoundPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4 text-center text-[#F5F5F5]">
    <Helmet>
      <title>Page not found — Waveio</title>
    </Helmet>
    <div className="max-w-md">
      <WaveioLogo size={64} showWordmark={false} className="justify-center" />
      <h1 className="mt-8 text-7xl font-semibold text-[#C9A84C]">404</h1>
      <p className="mt-4 text-lg text-[#D0D0C8]">This page doesn't exist or the room has ended.</p>
      <Link to="/" className="btn btn-primary mt-8">Go to homepage</Link>
    </div>
  </div>
);

export default NotFoundPage;
