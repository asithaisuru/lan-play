import { useEffect, useRef } from 'react';
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

const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
})();

const QueuePage = () => {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const clientId = sessionStorage.getItem('waveio_client_id');
  const username = sessionStorage.getItem(`waveio_username_${roomCode}`);
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
  } = usePlaylist(socket, clientId);

  useEffect(() => {
    if (!socket || !isConnected || !clientId || !username || joinedRef.current) return;
    socket.emit('join-room', { roomCode, username, clientId });
    joinedRef.current = true;
  }, [socket, isConnected, clientId, username, roomCode]);

  if (!clientId || !username) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold">Join this room first</h1>
          <Link to={`/room/${roomCode}`} className="btn btn-primary mt-6">Go to join page</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{roomCode} Queue — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
          <p className="eyebrow">Room queue</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="font-mono text-2xl font-semibold">{roomCode}</h1>
            <div className="flex flex-wrap gap-2">
              <span className={isHost ? 'badge badge-green' : 'badge badge-blue'}>{isHost ? 'Host' : 'Guest'}</span>
              <span className="badge badge-slate">{users.length} connected</span>
              <span className="badge badge-slate">{isAudioDevice ? 'Audio device' : 'Room sync'}</span>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <Spinner label="Connecting to room" />
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
              <UserAddSong socket={socket} username={username} />
              {isHost && (
                <HostController
                  socket={socket}
                  isHost={isHost}
                  users={users}
                  playlist={playlist}
                  clientId={clientId}
                  isAudioDevice={isAudioDevice}
                />
              )}
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

export default QueuePage;
