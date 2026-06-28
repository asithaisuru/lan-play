import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import api from '../services/api';

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const getOrCreateClientId = () => {
  const existing = sessionStorage.getItem('waveio_client_id');
  if (existing) return existing;

  const next = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem('waveio_client_id', next);
  return next;
};

const GuestJoinPage = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(sessionStorage.getItem(`waveio_username_${roomCode}`) || '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const roomName = useMemo(() => (
    room?.name || room?.playlistName || room?.playlist_name || `Room ${roomCode}`
  ), [room, roomCode]);

  useEffect(() => {
    const loadRoom = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await api.get(`/rooms/${roomCode}`);
        setRoom(response.data?.room || response.data || null);
      } catch (loadError) {
        const contentType = loadError.response?.headers?.['content-type'] || '';
        if (loadError.response?.status === 404 && contentType.includes('application/json')) {
          setNotFound(true);
        } else {
          setRoom({ roomCode, name: `Room ${roomCode}` });
        }
      } finally {
        setLoading(false);
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
    sessionStorage.setItem(`waveio_username_${roomCode}`, safeUsername);

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling']
    });

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Join {roomCode} — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16 md:px-6">
        {loading ? (
          <Spinner label="Checking room" />
        ) : notFound ? (
          <div className="w-full rounded-lg border border-[#C9A84C22] bg-[#141414] p-8 text-center">
            <h1 className="text-3xl font-semibold">This room doesn't exist or has ended</h1>
          </div>
        ) : (
          <form onSubmit={joinRoom} className="w-full rounded-lg border border-[#C9A84C22] bg-[#141414] p-8">
            <p className="eyebrow">Join room</p>
            <h1 className="mt-2 text-3xl font-semibold">{roomName}</h1>
            <p className="mt-2 font-mono text-sm text-[#888880]">{roomCode}</p>
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
            <button type="submit" className="btn btn-primary mt-6 w-full" disabled={joining}>
              {joining ? 'Joining...' : 'Join room'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GuestJoinPage;
