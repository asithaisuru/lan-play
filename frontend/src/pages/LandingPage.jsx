import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import Aurora from '../components/ui/Aurora';
import BlurText from '../components/ui/BlurText';
import FadeContent from '../components/ui/FadeContent';
import GradientText from '../components/ui/GradientText';
import Magnet from '../components/ui/Magnet';
import WaveioLogo from '../components/ui/WaveioLogo';
import { useAuth } from '../context/AuthContext';

const steps = [
  {
    number: '01',
    title: 'Create a room',
    description: 'Sign in with Google and create your room in seconds. Get a shareable link instantly.'
  },
  {
    number: '02',
    title: 'Share with your crowd',
    description: 'Send the link to your guests. No app download, no account needed. Just open and join.'
  },
  {
    number: '03',
    title: 'Everyone controls the vibe',
    description: 'Guests add songs, you stay in control. Music plays from your device.'
  }
];

const useCases = [
  {
    emoji: '🎉',
    title: 'Parties',
    description: 'Let your guests pick the playlist. No more aux cable arguments.'
  },
  {
    emoji: '🍺',
    title: 'Bars & Restaurants',
    description: 'Replace your jukebox. Guests vote with their phones.'
  },
  {
    emoji: '💍',
    title: 'Weddings & Events',
    description: 'Crowd-sourced music for the biggest day of your life.'
  },
  {
    emoji: '🏢',
    title: 'Offices',
    description: 'Democratic background music everyone actually likes.'
  }
];

const pricingPlans = [
  {
    name: 'Free',
    price: '$0/month',
    features: ['YouTube player', 'Up to 5 guests', '2 hour sessions', '10 song queue'],
    cta: 'Get started',
    to: '/login',
    featured: false
  },
  {
    name: 'Pro',
    price: '$9.99/month',
    badge: 'Most Popular',
    features: ['Spotify Premium linked', 'Unlimited guests', 'Unlimited sessions', 'No ads', 'Custom branding', 'Default playlist'],
    cta: 'Get Pro',
    to: '/pricing',
    featured: true
  },
  {
    name: 'Event',
    price: '$4.99/event',
    features: ['All Pro features', 'Single session', 'Pay per event', 'Perfect for weddings'],
    cta: 'Get Event',
    to: '/pricing',
    featured: false
  }
];

const Logo = () => (
  <Link to="/" className="inline-flex items-center gap-3 text-[#F5F5F5]" aria-label="Waveio home">
    <WaveioLogo size={40} showWordmark={true} />
  </Link>
);

const MagneticLink = ({ to, children, className }) => (
  <Magnet padding={60} magnetStrength={8}>
    <Link to={to} className={className}>
      {children}
    </Link>
  </Magnet>
);

const LandingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email || 'Host';
  const primaryCta = user
    ? { to: '/dashboard', label: 'Go to dashboard' }
    : { to: '/login', label: 'Start for free' };
  const finalCta = user
    ? { to: '/dashboard', label: 'Open dashboard' }
    : { to: '/login', label: 'Create your first room' };

  const handleLogout = () => {
    logout(() => navigate('/login'));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Waveio — Collaborative Music Queue for Parties and Events</title>
        <meta
          name="description"
          content="Let your crowd control the music. Create a shared playlist for your party, bar, or event. Free to start."
        />
      </Helmet>

      <main>
        <section className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A]">
          <Aurora colorStops={['#4A3510', '#C9A84C', '#7A5A18']} amplitude={0.55} blend={0.42} />

          <div className="relative z-10 flex min-h-screen w-full flex-col px-4 md:px-8">
            <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 py-6">
              <Logo />
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm font-semibold text-[#888880] sm:flex-nowrap md:gap-4">
                <a href="#features" className="hidden transition hover:text-[#F5F5F5] lg:inline-flex">
                  Features
                </a>
                <a href="#pricing" className="hidden transition hover:text-[#F5F5F5] sm:inline-flex">
                  Pricing
                </a>
                {user ? (
                  <>
                    <Link to="/playlists" className="hidden transition hover:text-[#F5F5F5] md:inline-flex">
                      Playlists
                    </Link>
                    <Link
                      to="/dashboard"
                      className="rounded-full border border-[#C9A84C] px-4 py-2.5 font-bold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-[#0A0A0A]"
                    >
                      Dashboard
                    </Link>
                    <div className="hidden min-w-0 items-center gap-2 sm:flex">
                      {user.avatar ? (
                        <img src={user.avatar} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C9A84C44] bg-[#1A1810] text-sm font-semibold text-[#C9A84C]">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="hidden max-w-32 truncate text-sm font-medium text-[#F5F5F5] lg:inline">
                        {displayName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] text-[#D0D0C8] transition hover:border-[#C9A84C66] hover:text-[#F5F5F5]"
                      title="Log out"
                      aria-label="Log out"
                    >
                      <LogOut size={17} />
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="rounded-full border border-[#C9A84C] px-5 py-2.5 font-bold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-[#0A0A0A]"
                  >
                    Login
                  </Link>
                )}
              </div>
            </nav>

          <div className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center pb-24 text-center">
            <FadeContent>
              <WaveioLogo size={96} showWordmark={false} className="justify-center" />
            </FadeContent>

            <BlurText
              text="Let your crowd control the music"
              delay={90}
              animateBy="words"
              direction="top"
              className="mt-7 max-w-5xl justify-center text-[40px] font-black leading-[1.04] text-[#F5F5F5] md:text-[64px]"
            />

            <FadeContent delay={0.55}>
              <p className="mx-auto mt-6 max-w-[600px] text-base leading-7 text-[#888880] md:text-lg">
                Create a shared queue for your party, bar, or event. Guests add songs from their phones.
                You stay in control.
              </p>
            </FadeContent>

            <FadeContent delay={0.8}>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <MagneticLink
                  to={primaryCta.to}
                  className="inline-flex rounded-full bg-[#C9A84C] px-8 py-4 text-base font-bold text-[#0A0A0A] transition hover:bg-[#F0C040]"
                >
                  {primaryCta.label}
                </MagneticLink>
                <MagneticLink
                  to="/pricing"
                  className="inline-flex rounded-full border border-[#C9A84C] bg-transparent px-8 py-4 text-base font-bold text-[#C9A84C] transition hover:bg-[#C9A84C14]"
                >
                  See pricing
                </MagneticLink>
              </div>
            </FadeContent>
          </div>

          <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-sm text-[#888880]">
            <span>Scroll to explore</span>
            <ChevronDown className="animate-bounce text-[#888880]" size={22} aria-hidden="true" />
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#0A0A0A] px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <FadeContent key={step.number} delay={index * 0.12}>
                <article className="h-full border border-[#C9A84C26] bg-[#141414] p-6">
                  <p className="text-sm font-black text-[#C9A84C]">{step.number}</p>
                  <h2 className="mt-5 text-2xl font-black text-[#F5F5F5]">{step.title}</h2>
                  <p className="mt-4 text-base leading-7 text-[#888880]">{step.description}</p>
                </article>
              </FadeContent>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#141414] px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <FadeContent>
            <h2 className="text-center text-4xl font-black text-[#F5F5F5] md:text-5xl">
              Built for every occasion
            </h2>
          </FadeContent>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {useCases.map((useCase, index) => (
              <FadeContent key={useCase.title} delay={index * 0.1}>
                <article className="h-full rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#0A0A0A] p-6 transition duration-200 hover:border-[rgba(201,168,76,0.4)]">
                  <div className="text-4xl" aria-hidden="true">{useCase.emoji}</div>
                  <h3 className="mt-5 text-2xl font-black text-[#F5F5F5]">{useCase.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#888880]">{useCase.description}</p>
                </article>
              </FadeContent>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#0A0A0A] px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <FadeContent>
            <h2 className="text-center text-4xl font-black md:text-5xl">
              <GradientText colors={['#C9A84C', '#F0C040']} animationSpeed={5}>
                Simple pricing
              </GradientText>
            </h2>
          </FadeContent>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <FadeContent key={plan.name} delay={index * 0.1}>
                <article
                  className={`relative flex h-full flex-col rounded-xl border p-6 ${
                    plan.featured
                      ? 'border-[#C9A84C] bg-[#1A1810]'
                      : 'border-[rgba(201,168,76,0.15)] bg-[#141414]'
                  }`}
                >
                  {plan.badge && (
                    <span className="mb-5 inline-flex w-fit rounded-full border border-[#C9A84C] px-3 py-1 text-xs font-bold text-[#C9A84C]">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="text-2xl font-black text-[#F5F5F5]">{plan.name}</h3>
                  <p className="mt-3 text-3xl font-black text-[#F5F5F5]">{plan.price}</p>
                  <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#888880]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="text-[#C9A84C]">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={plan.to}
                    target={plan.to === '/pricing' ? '_blank' : undefined}
                    rel={plan.to === '/pricing' ? 'noreferrer' : undefined}
                    className={`mt-8 inline-flex justify-center rounded-full px-6 py-3 text-sm font-bold transition ${
                      plan.featured
                        ? 'bg-[#C9A84C] text-[#0A0A0A] hover:bg-[#F0C040]'
                        : 'border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C14]'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </article>
              </FadeContent>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0A0A0A] px-4 py-16 md:px-8 md:py-24">
        <Aurora colorStops={['#4A3510', '#C9A84C', '#7A5A18']} amplitude={0.5} blend={0.36} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <FadeContent>
            <h2 className="text-4xl font-black text-[#F5F5F5] md:text-6xl">Ready to set the vibe?</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#888880] md:text-lg">
              Free to start. No credit card required.
            </p>
            <div className="mt-9">
              <MagneticLink
                to={finalCta.to}
                className="inline-flex rounded-full bg-[#C9A84C] px-9 py-5 text-lg font-black text-[#0A0A0A] transition hover:bg-[#F0C040]"
              >
                {finalCta.label}
              </MagneticLink>
            </div>
          </FadeContent>
        </div>
      </section>
    </main>

    <footer className="border-t border-[rgba(201,168,76,0.15)] bg-[#0A0A0A] px-4 py-8 text-[#888880] md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex items-center gap-3">
          <WaveioLogo size={32} showWordmark={false} />
          <span>A KRODOT Product</span>
        </div>
        <div className="flex flex-wrap justify-start gap-5 md:justify-center">
          <a href="#features" className="transition hover:text-[#F5F5F5]">Features</a>
          <a href="#pricing" className="transition hover:text-[#F5F5F5]">Pricing</a>
          <Link to="/privacy" className="transition hover:text-[#F5F5F5]">Privacy</Link>
          <Link to="/terms" className="transition hover:text-[#F5F5F5]">Terms</Link>
        </div>
        <p className="md:text-right">© 2026 KRODOT. All rights reserved.</p>
      </div>
    </footer>
    </div>
  );
};

export default LandingPage;
