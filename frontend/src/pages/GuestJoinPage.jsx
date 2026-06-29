import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import AdSenseSlot from '../components/ui/AdSenseSlot';
import WaveioLogo from '../components/ui/WaveioLogo';
import api from '../services/api';
import { getSocketOptions, SOCKET_URL } from '../services/socketConfig';

const getOrCreateClientId = () => {
  const existing = sessionStorage.getItem('waveio_client_id');
  if (existing) return existing;

  const next = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem('waveio_client_id', next);
  return next;
};

const getField = (room, camelKey, snakeKey, fallback = '') => (
  room?.[camelKey] || room?.[snakeKey] || fallback
);

const GuestJoinPage = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const [roomInfo, setRoomInfo] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [username, setUsername] = useState(sessionStorage.getItem(`waveio_username_${roomCode}`) || '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const roomName = useMemo(() => (
    getField(roomInfo, 'name', 'playlist_name', `Room ${roomCode}`)
  ), [roomInfo, roomCode]);

  const brand = useMemo(() => {
    const hostTier = getField(roomInfo, 'hostTier', 'host_tier', roomInfo?.tier || 'free');
    const customBrandName = getField(roomInfo, 'customBrandName', 'custom_brand_name');
    const customBrandLogo = getField(roomInfo, 'customBrandLogo', 'custom_brand_logo');
    const customBrandMessage = getField(roomInfo, 'customBrandMessage', 'custom_brand_message');
    const customBrandColor = getField(roomInfo, 'customBrandColor', 'custom_brand_color', '#C9A84C');
    const hasCustomBranding = ['pro', 'event'].includes(hostTier) && Boolean(customBrandName);

    return {
      hostTier,
      customBrandName,
      customBrandLogo,
      customBrandMessage,
      customBrandColor,
      hasCustomBranding
    };
  }, [roomInfo]);

  useEffect(() => {
    const loadRoom = async () => {
      setLoadingRoom(true);
      setRoomError('');
      try {
        const response = await api.get(`/rooms/public/${roomCode}`);
        setRoomInfo(response.data?.room || response.data || null);
      } catch (loadError) {
        if (loadError.response?.status === 404) {
          setRoomError('This room does not exist or has ended.');
        } else {
          setRoomInfo({ roomCode, name: `Room ${roomCode}` });
        }
      } finally {
        setLoadingRoom(false);
      }
    };

    loadRoom();
  }, [roomCode]);

  const joinRoom = (event) => {
    event.preventDefault();
    const safeUsername = username.trim();
    if (safeUsername.length < 3 || safeUsername.length > 20) {
      setError('Username must be 3 to 20 characters.');
      return;
    }

    setJoining(true);
    setError('');
    const clientId = getOrCreateClientId();
    sessionStorage.setItem('waveio_username_' + roomCode, safeUsername);
    sessionStorage.setItem('waveio_client_id', clientId);

    const socket = io(SOCKET_URL, getSocketOptions(SOCKET_URL));

    const cleanup = () => {
      socket.off('playlist-state');
      socket.off('error');
      socket.off('connect_error');
      socket.disconnect();
    };

    socket.on('connect', () => {
      socket.emit('join-room', { roomCode, username: safeUsername, clientId });
    });

    socket.on('playlist-state', () => {
      sessionStorage.setItem('waveio_username_' + roomCode, safeUsername);
      sessionStorage.setItem('waveio_client_id', clientId);
      cleanup();
      navigate(`/room/${roomCode}/queue`);
    });

    socket.on('error', (socketError) => {
      cleanup();
      setJoining(false);
      setError(socketError?.message || 'Could not join room.');
    });

    socket.on('connect_error', () => {
      cleanup();
      setJoining(false);
      setError('Could not connect to the room server.');
    });
  };

  const buttonStyle = brand.hasCustomBranding
    ? { backgroundColor: brand.customBrandColor, color: '#0A0A0A' }
    : undefined;

  const accentStyle = brand.hasCustomBranding
    ? { color: brand.customBrandColor }
    : undefined;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Join {roomCode} - Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16 md:px-6">
        {loadingRoom ? (
          <Spinner label="Checking room" />
        ) : roomError ? (
          <div className="w-full rounded-lg border border-[#C9A84C22] bg-[#141414] p-8 text-center">
            <h1 className="text-3xl font-semibold">Room not found</h1>
            <p className="mt-2 text-[#888880]">{roomError}</p>
            <Link to="/" className="btn btn-primary mt-6">Go home</Link>
          </div>
        ) : (
          <div className="w-full">
            <form onSubmit={joinRoom} className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-8">
              <div className="text-center">
                {brand.hasCustomBranding ? (
                  <>
                    {brand.customBrandLogo ? (
                      <img
                        src={brand.customBrandLogo}
                        alt=""
                        className="mx-auto h-20 w-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] text-3xl font-black"
                        style={accentStyle}
                      >
                        {brand.customBrandName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <p className="mt-5 text-xs font-bold uppercase text-[#888880]">Join room</p>
                    <h1 className="mt-2 text-3xl font-semibold" style={accentStyle}>
                      {brand.customBrandName}
                    </h1>
                    <p className="mt-3 text-[#D0D0C8]">
                      {brand.customBrandMessage || roomName}
                    </p>
                    <p className="mt-2 font-mono text-sm text-[#888880]">{roomCode}</p>
                  </>
                ) : (
                  <>
                    <WaveioLogo size={56} showWordmark={false} className="justify-center" />
                    <p className="mt-5 text-xs font-bold uppercase text-[#888880]">Join room</p>
                    <h1 className="mt-2 text-3xl font-semibold">{roomName}</h1>
                    <p className="mt-2 font-mono text-sm text-[#888880]">{roomCode}</p>
                  </>
                )}
              </div>

              <label className="mt-8 block text-sm font-semibold text-[#D0D0C8]" htmlFor="guest-username">
                Your name
              </label>
              <input
                id="guest-username"
                type="text"
                minLength={3}
                maxLength={20}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="input mt-2"
                placeholder="Your name"
                required
              />
              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
              <button
                type="submit"
                className="btn btn-primary mt-6 w-full"
                style={buttonStyle}
                disabled={joining}
              >
                {joining ? 'Joining...' : 'Join room'}
              </button>
              {brand.hasCustomBranding && (
                <p className="mt-5 text-center text-xs text-[#888880]">
                  Powered by Waveio
                </p>
              )}
            </form>
            <AdSenseSlot
              slot={import.meta.env.VITE_ADSENSE_SLOT_JOIN}
              format="auto"
              className="mt-6 rounded-xl border border-[#C9A84C22] bg-[#141414] p-3"
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GuestJoinPage;
