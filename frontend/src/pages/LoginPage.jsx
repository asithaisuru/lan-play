import { Helmet } from 'react-helmet-async';
import { Navigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Footer from '../components/layout/Footer';
import WaveioLogo from '../components/ui/WaveioLogo';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const loginUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google`;
  const from = searchParams.get('from');
  const returnTo = from || '/dashboard';

  const handleGoogleLogin = () => {
    sessionStorage.setItem('waveio_login_return', returnTo);
  };

  if (!loading && user) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Sign in to Waveio</title>
      </Helmet>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-[#C9A84C22] bg-[#141414] p-8 text-center">
          <WaveioLogo size={56} showWordmark={false} className="justify-center" />
          <h1 className="mt-6 text-3xl font-semibold">Sign in to Waveio</h1>
          <p className="mt-2 text-sm text-[#888880]">Create and manage your music rooms</p>
          {searchParams.get('error') && (
            <p className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              Sign in failed. Please try again.
            </p>
          )}
          <a href={loginUrl} onClick={handleGoogleLogin} className="btn btn-primary mt-7 w-full">
            <LogIn size={18} />
            Continue with Google
          </a>
          <p className="mt-5 text-sm leading-6 text-[#888880]">
            Guests don't need an account — just open a room link to join
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LoginPage;
