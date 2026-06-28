import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, GlassWater, Music2, PartyPopper } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const steps = [
  'Create a room in seconds',
  'Share the link with your crowd',
  'Everyone adds songs, you control the vibe'
];

const useCases = [
  { title: 'Parties', icon: PartyPopper },
  { title: 'Bars and restaurants', icon: GlassWater },
  { title: 'Weddings', icon: Music2 },
  { title: 'Offices', icon: Building2 }
];

const LandingPage = () => (
  <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
    <Helmet>
      <title>Waveio — Collaborative Music Queue for Parties and Events</title>
      <meta
        name="description"
        content="Let your crowd control the music. Create a shared playlist for your party, bar, or event."
      />
    </Helmet>
    <Header />

    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Waveio Cloud</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-[0.02em] text-[#F5F5F5] md:text-6xl">
            Let your crowd control the music
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D0D0C8]">
            Create a shared queue for your party, bar, or event. Guests add songs from their phones.
            You stay in control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn btn-primary">
              Start for free
              <ArrowRight size={17} />
            </Link>
            <Link to="/pricing" className="btn btn-secondary">
              See pricing
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
          <div className="rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4">
            <p className="text-sm font-semibold text-[#C9A84C]">Live room</p>
            <div className="mt-5 space-y-3">
              {['DJ Khaled - All I Do Is Win', 'Daft Punk - One More Time', 'Rihanna - We Found Love'].map((song, index) => (
                <div key={song} className="flex items-center gap-3 rounded-lg border border-[#C9A84C14] bg-[#141414] p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A84C] text-sm font-bold text-[#0A0A0A]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{song}</p>
                    <p className="text-xs text-[#888880]">Added by guest</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#C9A84C14] bg-[#141414]">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <p className="eyebrow">How it works</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-5">
                <span className="text-sm font-semibold text-[#C9A84C]">Step {index + 1}</span>
                <p className="mt-3 text-lg font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <p className="eyebrow">Use cases</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((useCase) => {
            const UseCaseIcon = useCase.icon;
            return (
              <div key={useCase.title} className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
                <UseCaseIcon className="text-[#C9A84C]" size={28} />
                <p className="mt-5 text-lg font-semibold">{useCase.title}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="rounded-lg border border-[#C9A84C33] bg-[#1A1810] p-8 text-center">
          <h2 className="text-3xl font-semibold">Start your first room today</h2>
          <Link to="/login" className="btn btn-primary mt-6">
            Start for free
          </Link>
        </div>
      </section>
    </main>

    <Footer />
  </div>
);

export default LandingPage;
