import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import NowPlaying from '../components/NowPlaying';
import PlaylistDisplay from '../components/PlaylistDisplay';
import { useAuth } from '../context/AuthContext';
import { usePlaylist } from '../hooks/usePlaylist';
import { useSocket } from '../hooks/useSocket';

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const createClientId = () => (
  window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const getOrCreateLocalId = (key) => {
  const existingClientId = localStorage.getItem(key);
  if (existingClientId) return existingClientId;

  const nextClientId = createClientId();
  localStorage.setItem(key, nextClientId);
  return nextClientId;
};

const getPlayerIdentity = ({ roomCode, user }) => {
  if (user) {
    return {
      clientId: getOrCreateLocalId('waveio_host_clientId'),
      username: (user.name || user.email || 'Host').trim()
    };
  }

  const guestClientId = sessionStorage.getItem('waveio_client_id');
  const guestUsername = sessionStorage.getItem('waveio_username_' + roomCode);
  if (guestClientId && guestUsername) {
    return {
      clientId: guestClientId,
      username: guestUsername
    };
  }

  const clientId = getOrCreateLocalId(`waveio_player_clientId_${roomCode}`);
  const storedName = localStorage.getItem(`waveio_player_name_${roomCode}`);
  const username = storedName || `Player ${roomCode}`;
  localStorage.setItem(`waveio_player_name_${roomCode}`, username);

  return {
    clientId,
    username
  };
};

const PlayerPage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const { user, loading } = useAuth();
  const [identity, setIdentity] = useState({ clientId: '', username: '' });
  const joinedRef = useRef(false);
  const { socket, isConnected } = useSocket(getSocketUrl());
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
  } = usePlaylist(socket, identity.clientId);

  const playlistName = playlist?.name
    || playlist?.playlistName
    || playlist?.playlist_name
    || 'Room playlist';

  useEffect(() => {
    if (loading) return;
    setIdentity(getPlayerIdentity({ roomCode, user }));
  }, [loading, roomCode, user]);

  useEffect(() => {
    joinedRef.current = false;
  }, [identity.clientId, roomCode]);

  useEffect(() => {
    if (!isConnected) {
      joinedRef.current = false;
    }
  }, [isConnected]);

  useEffect(() => {
    if (!socket || !isConnected || !identity.clientId || !identity.username || joinedRef.current) return;
    socket.emit('join-room', {
      roomCode,
      username: identity.username,
      clientId: identity.clientId
    });
    joinedRef.current = true;
  }, [identity.clientId, identity.username, isConnected, roomCode, socket]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Player — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Player view</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-2xl font-semibold">{roomCode}</h1>
                {isPlaying && (
                  <span className="rounded-full border border-[#C9A84C55] bg-[#C9A84C18] px-3 py-1 text-xs font-bold uppercase text-[#C9A84C]">
                    Live
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-[#888880]">{playlistName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={isAudioDevice ? 'badge badge-green' : 'badge badge-blue'}>
                {isAudioDevice ? 'Audio device' : 'Waiting for audio assignment'}
              </span>
              {isHost && <span className="badge badge-green">Host</span>}
              <span className="badge badge-slate">{users.length} connected</span>
              <Link to={`/room/${roomCode}`} className="btn btn-secondary px-3 py-2">
                Guest link
              </Link>
            </div>
          </div>
        </div>

        {loading || !identity.clientId || !isConnected ? (
          <Spinner label="Connecting player view" />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              {!isAudioDevice && (
                <div className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
                  <p className="font-semibold text-[#F5F5F5]">This device is connected as {identity.username}</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    Ask the host to choose this device with the Use audio control.
                  </p>
                </div>
              )}
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

export default PlayerPage;
