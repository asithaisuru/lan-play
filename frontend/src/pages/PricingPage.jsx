import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
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
    description: 'A simple shared queue for small rooms.',
    features: [
      'Max 5 guests per room',
      'Max 10 songs in queue',
      '1 hour queue duration limit',
      '2 hour session limit',
      'Ads between songs',
      'YouTube only',
      '1 active room'
    ]
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$9.99/month',
    description: 'Built for venues and regular hosts.',
    featured: true,
    features: [
      'Unlimited guests (free: 5 guests)',
      'Unlimited queue (free: 10 songs, 1hr)',
      'No ads ever',
      'Spotify Premium integration',
      'Custom branding for your business',
      'Default playlist — auto DJ mode',
      'Up to 3 active rooms',
      'Full host controls'
    ]
  },
  {
    key: 'event',
    name: 'Event',
    price: '$4.99/event',
    description: 'One-time access for a single event.',
    features: [
      'Everything in Pro',
      'Single session only',
      'Pay once per event',
      'Perfect for weddings and one-off events',
      'No monthly commitment'
    ]
  }
];

const PricingPage = () => {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [loadingTier, setLoadingTier] = useState('');

  const startCheckout = async (tier) => {
    if (!user) {
      window.location.href = '/login';
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

  const handleProCheckout = () => startCheckout('pro');
  const handleEventCheckout = () => startCheckout('event');

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
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#888880]">
            Upgrade links open in a separate tab from your live room, and checkout redirects securely through Stripe.
          </p>
        </div>

        {error && (
          <p className="mx-auto mt-8 max-w-xl rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {tiers.map((tier) => (
            <section
              key={tier.key}
              className={`flex rounded-lg border p-6 ${
                tier.featured
                  ? 'border-[#C9A84C66] bg-[#1A1810]'
                  : 'border-[#C9A84C22] bg-[#141414]'
              }`}
            >
              <div className="flex w-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">{tier.name}</h2>
                    <p className="mt-2 text-3xl font-semibold text-[#C9A84C]">{tier.price}</p>
                  </div>
                  {tier.featured && (
                    <span className="rounded-full border border-[#C9A84C55] bg-[#C9A84C18] px-3 py-1 text-xs font-bold uppercase text-[#C9A84C]">
                      Best value
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-[#888880]">
                  {tier.description}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-[#D0D0C8]">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 flex-shrink-0 text-[#C9A84C]" size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.key === 'free' && (
                  <a
                    href="/login"
                    className="btn btn-secondary mt-8 w-full text-center"
                  >
                    Get started free
                  </a>
                )}

                {tier.key === 'pro' && (
                  <button
                    type="button"
                    onClick={handleProCheckout}
                    disabled={loadingTier === 'pro'}
                    className="btn btn-primary mt-8 w-full"
                  >
                    {loadingTier === 'pro' ? 'Starting...' : 'Get Pro — $9.99/mo'}
                  </button>
                )}

                {tier.key === 'event' && (
                  <button
                    type="button"
                    onClick={handleEventCheckout}
                    disabled={loadingTier === 'event'}
                    className="btn btn-primary mt-8 w-full"
                  >
                    {loadingTier === 'event' ? 'Starting...' : 'Get Event — $4.99/event'}
                  </button>
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
