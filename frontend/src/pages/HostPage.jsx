import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Copy, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import HostController from '../components/HostController';
import NowPlaying from '../components/NowPlaying';
import PlaylistDisplay from '../components/PlaylistDisplay';
import UserAddSong from '../components/UserAddSong';
import { useSocket } from '../hooks/useSocket';
import { usePlaylist } from '../hooks/usePlaylist';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
})();

const getOrCreateHostClientId = () => {
  const existingClientId = localStorage.getItem('waveio_host_clientId');
  if (existingClientId) return existingClientId;

  const nextClientId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('waveio_host_clientId', nextClientId);
  return nextClientId;
};

const copyText = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const HostPage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [clientId, setClientId] = useState(() => localStorage.getItem('waveio_host_clientId'));
  const [copiedInvite, setCopiedInvite] = useState(false);
  const joinedRef = useRef(false);
  const copyTimerRef = useRef(null);
  const { socket, isConnected } = useSocket(SOCKET_URL);
  const {
    playlist,
    currentSong,
    currentSource,
    isHost,
    isAudioDevice,
    users,
    isPlaying,
    currentTime,
    playAnnouncement
  } = usePlaylist(socket, clientId);

  const username = useMemo(() => (
    user?.name || user?.email || 'Host'
  ).trim(), [user]);

  const playlistName = playlist?.name
    || playlist?.playlistName
    || playlist?.playlist_name
    || 'Room playlist';

  const guestInviteLink = `${window.location.origin}/room/${roomCode}`;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (loading || !user) return;
    setClientId(getOrCreateHostClientId());
  }, [loading, user]);

  useEffect(() => {
    joinedRef.current = false;
  }, [clientId, roomCode, username]);

  useEffect(() => {
    if (!isConnected) {
      joinedRef.current = false;
    }
  }, [isConnected]);

  useEffect(() => {
    if (!socket || !isConnected || !clientId || !username || !user || joinedRef.current) return;
    socket.emit('join-room', { roomCode, username, clientId });
    joinedRef.current = true;
  }, [clientId, isConnected, roomCode, socket, user, username]);

  useEffect(() => () => {
    clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopyInvite = useCallback(async () => {
    try {
      await copyText(guestInviteLink);
      setCopiedInvite(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setCopiedInvite(false);
    }
  }, [guestInviteLink]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <Helmet>
          <title>{roomCode} Host Controls — Waveio</title>
        </Helmet>
        <Spinner label="Checking your Waveio session" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <Helmet>
          <title>{roomCode} Host Controls — Waveio</title>
        </Helmet>
        <Spinner label="Redirecting to login" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Host Controls — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 rounded-lg border border-[#C9A84C55] bg-[#141414] p-5 shadow-lg shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Audio setup</p>
              <h2 className="mt-1 text-xl font-black text-[#F5F5F5]">
                Open the Player View on your speaker device
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#D0D0C8]">
                After opening Player View, click "Activate Audio" on that device to start playback.
              </p>
            </div>
            <Link
              to={`/room/${roomCode}/player`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary w-full justify-center lg:w-auto"
            >
              Open Player View
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Host controls</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-2xl font-semibold text-[#F5F5F5]">{roomCode}</h1>
                {isPlaying && (
                  <span className="rounded-full border border-[#C9A84C55] bg-[#C9A84C18] px-3 py-1 text-xs font-bold uppercase text-[#C9A84C]">
                    Live
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-[#888880]">{playlistName}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
              <span className="badge badge-slate">{users.length} connected</span>
              <span className={isHost ? 'badge badge-green' : 'badge badge-blue'}>
                {isHost ? 'Host' : 'Connecting host'}
              </span>
              <span className="badge badge-slate">{isAudioDevice ? 'Audio device' : 'Room sync'}</span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#C9A84C55] bg-[#C9A84C0F] px-3 py-2 text-sm font-semibold text-[#F5F5F5] transition hover:bg-[#C9A84C18]"
              >
                <Copy size={16} />
                {copiedInvite ? 'Copied!' : 'Copy guest invite'}
              </button>
              <Link
                to={`/room/${roomCode}/player`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-[#D0D0C8] transition hover:border-[#C9A84C66] hover:text-[#F5F5F5]"
              >
                <ExternalLink size={16} />
                Player view
              </Link>
            </div>
          </div>
        </div>

        {!clientId || !isConnected ? (
          <Spinner label="Connecting to host controls" />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <NowPlaying
                currentSong={currentSong}
                currentSource={currentSource}
                isPlaying={isPlaying}
                syncedCurrentTime={currentTime}
                isHost={isHost}
                isAudioDevice={isAudioDevice}
                playAnnouncement={playAnnouncement}
                playlist={playlist}
                socket={socket}
              />
              <HostController
                socket={socket}
                isHost={isHost}
                users={users}
                playlist={playlist}
                clientId={clientId}
                isAudioDevice={isAudioDevice}
              />
              <UserAddSong socket={socket} username={username} />
            </div>
            <div className="xl:sticky xl:top-6 xl:self-start">
              <PlaylistDisplay playlist={playlist} currentSong={currentSong} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default HostPage;
