import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
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

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const getOrCreateClientId = () => {
  const existingClientId = sessionStorage.getItem('waveio_client_id');
  if (existingClientId) return existingClientId;

  const nextClientId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem('waveio_client_id', nextClientId);
  return nextClientId;
};

const HostPage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(() => sessionStorage.getItem('waveio_client_id'));
  const [username, setUsername] = useState(() => sessionStorage.getItem(`waveio_username_${roomCode}`));
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
  } = usePlaylist(socket, clientId);

  useEffect(() => {
    joinedRef.current = false;
    setClientId(sessionStorage.getItem('waveio_client_id'));
    setUsername(sessionStorage.getItem(`waveio_username_${roomCode}`));
  }, [roomCode]);

  useEffect(() => {
    if (!socket || !isConnected || !clientId || !username || joinedRef.current) return;
    socket.emit('join-room', { roomCode, username, clientId });
    joinedRef.current = true;
  }, [socket, isConnected, clientId, username, roomCode]);

  const joinAsHost = () => {
    const nextClientId = getOrCreateClientId();
    const nextUsername = (user?.name || user?.email || 'Host').trim();
    sessionStorage.setItem(`waveio_username_${roomCode}`, nextUsername);
    setClientId(nextClientId);
    setUsername(nextUsername);
    joinedRef.current = false;

    if (socket && isConnected) {
      socket.emit('join-room', { roomCode, username: nextUsername, clientId: nextClientId });
      joinedRef.current = true;
    }
  };

  const hasSessionIdentity = Boolean(clientId && username);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Host Controls — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
          <p className="eyebrow">Host controls</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="font-mono text-2xl font-semibold">{roomCode}</h1>
            <div className="flex flex-wrap gap-2">
              <span className={isHost ? 'badge badge-green' : 'badge badge-blue'}>{isHost ? 'Host' : 'Joining as host'}</span>
              <span className="badge badge-slate">{users.length} connected</span>
              <span className="badge badge-slate">{isAudioDevice ? 'Audio device' : 'Room sync'}</span>
            </div>
          </div>
        </div>

        {!hasSessionIdentity ? (
          <section className="mx-auto max-w-xl rounded-lg border border-[#C9A84C22] bg-[#141414] p-6 text-center">
            <h2 className="text-2xl font-semibold">You need to join the room first</h2>
            <p className="mt-2 text-sm text-[#888880]">
              Join as a guest first, or use your host account name to open this control panel.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={`/room/${roomCode}`} className="btn btn-secondary">
                Join as guest
              </Link>
              <button type="button" onClick={joinAsHost} className="btn btn-primary">
                Join as host
              </button>
            </div>
          </section>
        ) : !isConnected ? (
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
                isHost
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
