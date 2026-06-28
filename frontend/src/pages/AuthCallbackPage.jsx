import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const confirmLogin = async () => {
      try {
        const response = await api.get('/auth/me');
        const user = response.data?.user || response.data || null;
        if (!user) throw new Error('No authenticated user returned.');
        setUser(user);
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login?error=auth_failed', { replace: true });
      }
    };

    confirmLogin();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Helmet>
        <title>Signing in — Waveio</title>
      </Helmet>
      <Spinner label="Finishing sign in" />
    </div>
  );
};

export default AuthCallbackPage;
