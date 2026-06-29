import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import WaveioLogo from '../components/ui/WaveioLogo';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const readRoomBranding = (room) => ({
  customBrandName: room?.customBrandName || room?.custom_brand_name || '',
  customBrandLogo: room?.customBrandLogo || room?.custom_brand_logo || '',
  customBrandMessage: room?.customBrandMessage || room?.custom_brand_message || '',
  customBrandColor: room?.customBrandColor || room?.custom_brand_color || '#C9A84C'
});

const RoomSettingsPage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [form, setForm] = useState(readRoomBranding(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canUseBranding = ['pro', 'event'].includes(user?.tier);

  useEffect(() => {
    const loadRoom = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/rooms/${roomCode}`);
        const nextRoom = response.data?.room;
        setRoom(nextRoom);
        setForm(readRoomBranding(nextRoom));
      } catch (loadError) {
        setError(loadError.response?.data?.error || 'Could not load room settings.');
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [roomCode]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveBranding = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await api.put(`/rooms/${roomCode}/branding`, {
        customBrandName: form.customBrandName.trim(),
        customBrandLogo: form.customBrandLogo.trim(),
        customBrandMessage: form.customBrandMessage.trim(),
        customBrandColor: form.customBrandColor || '#C9A84C'
      });
      const nextRoom = response.data?.room;
      setRoom(nextRoom);
      setForm(readRoomBranding(nextRoom));
      setMessage('Branding saved.');
    } catch (saveError) {
      setError(saveError.response?.data?.error || 'Could not save branding.');
    } finally {
      setSaving(false);
    }
  };

  const roomName = room?.name || room?.playlistName || room?.playlist_name || roomCode;
  const previewName = form.customBrandName || roomName;
  const previewMessage = form.customBrandMessage || 'Join the room and add your favorite songs.';
  const safeBrandColor = /^#[0-9a-fA-F]{6}$/.test(form.customBrandColor)
    ? form.customBrandColor
    : '#C9A84C';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
        <Header />
        <Spinner label="Loading room settings" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Settings - Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A84C] hover:text-[#F0C040]">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mt-6">
          <p className="eyebrow">Room settings</p>
          <h1 className="mt-2 text-4xl font-black">{roomName}</h1>
          <p className="mt-1 font-mono text-sm text-[#888880]">{roomCode}</p>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        {!canUseBranding ? (
          <section className="mt-8 rounded-xl border border-[#C9A84C22] bg-[#1A1810] p-5">
            <p className="font-semibold text-[#C9A84C]">
              Custom branding - Pro feature
            </p>
            <p className="mt-2 text-sm text-[#888880]">
              Add your logo, business name, and welcome message to the guest join page.
              Upgrade to Pro to unlock.
            </p>
            <Link to="/pricing" className="btn btn-primary mt-4 inline-flex">
              Upgrade to Pro
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={handleSaveBranding} className="rounded-xl border border-[#C9A84C22] bg-[#141414] p-5">
              <h2 className="text-xl font-bold">Guest join branding</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
                    Business or host name
                  </span>
                  <input
                    value={form.customBrandName}
                    onChange={(event) => updateField('customBrandName', event.target.value)}
                    className="input"
                    placeholder="DJ Nova"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
                    Logo URL
                  </span>
                  <input
                    value={form.customBrandLogo}
                    onChange={(event) => updateField('customBrandLogo', event.target.value)}
                    className="input"
                    placeholder="https://example.com/logo.png"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
                    Welcome message
                  </span>
                  <textarea
                    value={form.customBrandMessage}
                    onChange={(event) => updateField('customBrandMessage', event.target.value)}
                    className="input min-h-28 resize-y"
                    maxLength={150}
                    placeholder="Welcome. Add a song and enjoy the night."
                  />
                  <span className="mt-1 block text-xs text-[#888880]">
                    {form.customBrandMessage.length}/150
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
                    Accent color
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={safeBrandColor}
                      onChange={(event) => updateField('customBrandColor', event.target.value)}
                      className="h-11 w-16 rounded border border-[#C9A84C22] bg-[#0A0A0A]"
                    />
                    <input
                      value={form.customBrandColor}
                      onChange={(event) => updateField('customBrandColor', event.target.value)}
                      className="input"
                      placeholder="#C9A84C"
                    />
                  </div>
                </label>
              </div>

              {message && <p className="mt-4 text-sm text-[#C9A84C]">{message}</p>}
              <button type="submit" className="btn btn-primary mt-5" disabled={saving}>
                {saving ? 'Saving...' : 'Save branding'}
              </button>
            </form>

            <section className="rounded-xl border border-[#C9A84C22] bg-[#141414] p-5">
              <h2 className="text-xl font-bold">Preview</h2>
              <div className="mt-5 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-5 text-center">
                {form.customBrandLogo ? (
                  <img src={form.customBrandLogo} alt="" className="mx-auto h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <WaveioLogo size={48} showWordmark={false} className="justify-center" />
                )}
                <p className="mt-4 text-xs font-bold uppercase text-[#888880]">Join room</p>
                <h3 className="mt-2 text-2xl font-black" style={{ color: safeBrandColor }}>
                  {previewName}
                </h3>
                <p className="mt-2 text-sm text-[#888880]">{previewMessage}</p>
                <button
                  type="button"
                  className="mt-5 rounded-full px-8 py-3 text-sm font-bold text-[#0A0A0A]"
                  style={{ backgroundColor: safeBrandColor }}
                >
                  Join room
                </button>
                <p className="mt-4 text-xs text-[#888880]">Powered by Waveio</p>
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default RoomSettingsPage;
