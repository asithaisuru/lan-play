import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Maximize2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import NowPlaying from '../components/NowPlaying';
import { useAuth } from '../context/AuthContext';
import { usePlaylist } from '../hooks/usePlaylist';
import { useSocket } from '../hooks/useSocket';

const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
})();

const createClientId = () => (
  window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const getOrCreateStoredClientId = (storage, key) => {
  const existingClientId = storage.getItem(key);
  if (existingClientId) return existingClientId;

  const nextClientId = createClientId();
  storage.setItem(key, nextClientId);
  return nextClientId;
};

const getPlayerIdentity = ({ roomCode, user }) => {
  if (user) {
    return {
      clientId: getOrCreateStoredClientId(localStorage, 'waveio_host_clientId'),
      username: (user.name || user.email || 'Host').trim()
    };
  }

  const guestClientId = sessionStorage.getItem('waveio_client_id');
  const guestUsername = sessionStorage.getItem('waveio_username_' + roomCode);
  if (guestClientId && guestUsername) {
    return {
      clientId: guestClientId,
      username: guestUsername.trim()
    };
  }

  return {
    clientId: getOrCreateStoredClientId(localStorage, `waveio_player_clientId_${roomCode}`),
    username: `Player ${roomCode}`
  };
};

const PlayerPage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const { user, loading } = useAuth();
  const [identity, setIdentity] = useState({ clientId: '', username: '' });
  const [audioActivated, setAudioActivated] = useState(() => (
    sessionStorage.getItem('waveio_audio_activated_' + code.toUpperCase()) === 'true'
  ));
  const joinedRef = useRef(false);
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
  } = usePlaylist(socket, identity.clientId);

  const playlistName = useMemo(() => (
    playlist?.name
    || playlist?.playlistName
    || playlist?.playlist_name
    || 'Room playlist'
  ), [playlist]);

  useEffect(() => {
    if (loading) return;
    setIdentity(getPlayerIdentity({ roomCode, user }));
  }, [loading, roomCode, user]);

  useEffect(() => {
    joinedRef.current = false;
  }, [socket]);

  useEffect(() => {
    if (!socket || !isConnected || !identity.clientId || !identity.username || joinedRef.current) return;
    socket.emit('join-room', {
      roomCode,
      username: identity.username,
      clientId: identity.clientId
    });
    joinedRef.current = true;
  }, [identity.clientId, identity.username, isConnected, roomCode, socket]);

  const openFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Browser may deny fullscreen; audio activation still works.
    }
  };

  const handleActivateAudio = () => {
    sessionStorage.setItem('waveio_audio_activated_' + roomCode, 'true');
    setAudioActivated(true);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Player — Waveio</title>
      </Helmet>

      <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#C9A84C22] pb-4">
          <div className="min-w-0">
            <p className="eyebrow">Waveio Player View</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-black text-[#F5F5F5]">{roomCode}</h1>
              {isPlaying && (
                <span className="rounded-full border border-[#C9A84C55] bg-[#C9A84C18] px-3 py-1 text-xs font-bold uppercase text-[#C9A84C]">
                  Live
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-[#888880]">{playlistName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={isAudioDevice ? 'badge badge-green' : 'badge badge-blue'}>
              {isAudioDevice ? 'Assigned audio device' : 'Waiting for host assignment'}
            </span>
            <span className="badge badge-slate">{users.length} connected</span>
            <button
              type="button"
              onClick={openFullscreen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A84C33] bg-[#141414] text-[#F5F5F5] transition hover:border-[#C9A84C66]"
              title="Fullscreen"
              aria-label="Fullscreen"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </header>

        {loading || !identity.clientId || !isConnected ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner label="Connecting player view" />
          </div>
        ) : !audioActivated ? (
          <section className="flex flex-1 items-center justify-center py-10 text-center">
            <div className="mx-auto max-w-3xl rounded-lg border border-[#C9A84C44] bg-[#141414] px-6 py-10 shadow-2xl shadow-black/30 sm:px-10">
              <p className="eyebrow">Speaker device setup</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-6xl">
                Click to activate audio
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#D0D0C8]">
                Browser security requires one click before YouTube can play audio on this device.
              </p>
              <button
                type="button"
                onClick={handleActivateAudio}
                className="mt-8 rounded-full bg-[#C9A84C] px-9 py-5 text-lg font-black text-[#0A0A0A] shadow-xl shadow-black/40 transition hover:bg-[#F0C040]"
              >
                Activate Audio
              </button>
              <div className="mt-8 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A]/70 p-4">
                <p className="text-sm font-semibold text-[#F5F5F5]">
                  {currentSong ? currentSong.title : 'Waiting for the host to start playback'}
                </p>
                <p className="mt-1 text-xs text-[#888880]">
                  Connected as {identity.username}. {isAudioDevice ? 'This device is assigned for audio.' : 'Ask the host to select this device with Use audio.'}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col justify-center py-5">
            {!isAudioDevice && (
              <div className="mb-4 rounded-lg border border-[#C9A84C22] bg-[#141414] p-4 text-center">
                <p className="font-semibold text-[#F5F5F5]">Audio is activated on this browser.</p>
                <p className="mt-1 text-sm text-[#888880]">
                  Ask the host to choose {identity.username} with the Use audio control.
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
              visiblePlayer
              audioActivated={audioActivated}
              onAudioActivated={handleActivateAudio}
            />
          </section>
        )}
      </main>
    </div>
  );
};

export default PlayerPage;
