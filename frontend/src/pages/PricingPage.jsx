import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const tiers = [
  {
    key: 'free',
    name: 'Free',
    price: '$0/month',
    features: ['Shared queue', 'Host controls', 'Basic room links'],
    button: null
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$9.99/month',
    features: ['Unlimited guests', 'Spotify support', 'No ads', 'Host dashboard'],
    button: 'Get Pro'
  },
  {
    key: 'event',
    name: 'Event',
    price: '$4.99/event',
    features: ['One event room', 'Guest queue', 'Host controls', 'Event-ready sharing'],
    button: 'Get Event'
  }
];

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loadingTier, setLoadingTier] = useState('');

  const startCheckout = async (tier) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setError('');
    setLoadingTier(tier);
    try {
      const response = await api.post('/billing/create-checkout', { tier });
      const checkoutUrl = response.data?.url;
      if (!checkoutUrl) throw new Error('No checkout URL returned.');
      window.location.href = checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError.response?.data?.message || 'Could not start checkout.');
    } finally {
      setLoadingTier('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Pricing — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 text-4xl font-semibold">Choose your Waveio plan</h1>
        </div>

        {error && (
          <p className="mx-auto mt-8 max-w-xl rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {tiers.map((tier) => (
            <section key={tier.key} className="flex rounded-lg border border-[#C9A84C22] bg-[#141414] p-6">
              <div className="flex w-full flex-col">
                <h2 className="text-2xl font-semibold">{tier.name}</h2>
                <p className="mt-2 text-3xl font-semibold text-[#C9A84C]">{tier.price}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-[#D0D0C8]">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 flex-shrink-0 text-[#C9A84C]" size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.button ? (
                  <button
                    type="button"
                    onClick={() => startCheckout(tier.key)}
                    disabled={loadingTier === tier.key}
                    className="btn btn-primary mt-8 w-full"
                  >
                    {loadingTier === tier.key ? 'Starting...' : tier.button}
                  </button>
                ) : (
                  <div className="mt-8 rounded-lg border border-[#C9A84C22] px-4 py-2 text-center text-sm text-[#888880]">
                    Current starter plan
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;
