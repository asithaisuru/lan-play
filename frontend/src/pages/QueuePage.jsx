import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import AdOverlay from '../components/room/AdOverlay';
import SessionEndedOverlay from '../components/room/SessionEndedOverlay';
import AdSenseSlot from '../components/ui/AdSenseSlot';
import Spinner from '../components/ui/Spinner';
import HostController from '../components/HostController';
import NowPlaying from '../components/NowPlaying';
import PlaylistDisplay from '../components/PlaylistDisplay';
import UserAddSong from '../components/UserAddSong';
import { useSocket } from '../hooks/useSocket';
import { usePlaylist } from '../hooks/usePlaylist';
import { useRoomJoin } from '../hooks/useRoomJoin';
import { SOCKET_URL } from '../services/socketConfig';

const QueuePage = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const clientId = sessionStorage.getItem('waveio_client_id');
  const username = sessionStorage.getItem(`waveio_username_${roomCode}`);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [activeAd, setActiveAd] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const { socket, isConnected } = useSocket(SOCKET_URL, Boolean(clientId && username));
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
    if (isConnected) {
      setHasEverConnected(true);
    }
  }, [isConnected]);

  useRoomJoin({
    socket,
    isConnected,
    roomCode,
    username,
    clientId,
    enabled: Boolean(clientId && username)
  });

  useEffect(() => {
    if (!socket) return undefined;

    const handleAdStart = (data) => {
      setActiveAd(data);
    };
    const handleAdEnd = () => {
      setActiveAd(null);
    };
    const handleSessionEnded = (data) => {
      setSessionEnded(data);
    };
    const handleRoomError = (data) => {
      if (['QUEUE_LIMIT_REACHED', 'GUEST_LIMIT_REACHED'].includes(data?.code)) {
        setRoomError({
          code: data.code,
          message: data.message || 'The room has reached a free plan limit.'
        });
      }
    };

    socket.on('ad-start', handleAdStart);
    socket.on('ad-end', handleAdEnd);
    socket.on('session-ended', handleSessionEnded);
    socket.on('error', handleRoomError);

    return () => {
      socket.off('ad-start', handleAdStart);
      socket.off('ad-end', handleAdEnd);
      socket.off('session-ended', handleSessionEnded);
      socket.off('error', handleRoomError);
    };
  }, [socket]);

  const handleAdSkip = () => {
    setActiveAd(null);
    socket?.emit('ad-skipped');
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    sessionStorage.removeItem('waveio_client_id');
    sessionStorage.removeItem('waveio_username_' + roomCode);
    sessionStorage.removeItem('waveio_audio_activated_' + roomCode);
    navigate('/');
  };

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
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                Leave room
              </button>
            </div>
          </div>
        </div>

        {roomError?.code === 'QUEUE_LIMIT_REACHED' && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#C9A84C33] bg-[#1A1810] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#F5F5F5]">
                Queue limit reached
              </p>
              <p className="mt-1 text-sm text-[#888880]">
                {roomError.message}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <a
                href="/pricing"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#0A0A0A] transition hover:bg-[#F0C040] whitespace-nowrap"
              >
                Upgrade ↗
              </a>
              <button
                type="button"
                onClick={() => setRoomError(null)}
                className="rounded-full p-2 text-[#888880] transition hover:text-[#F5F5F5]"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {roomError?.code === 'GUEST_LIMIT_REACHED' && (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-center">
            <p className="font-semibold text-rose-100">
              This room is full
            </p>
            <p className="mt-1 text-sm text-rose-200/70">
              {roomError.message}
            </p>
          </div>
        )}

        {!hasEverConnected && !isConnected ? (
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
                  tier={playlist?.tier}
                />
              )}
            </div>
            <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <PlaylistDisplay playlist={playlist} currentSong={currentSong} />
              <AdSenseSlot
                slot={import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR}
                format="rectangle"
                className="rounded-xl border border-[#C9A84C22] bg-[#141414] p-3"
              />
            </div>
          </div>
        )}
      </main>
      {activeAd && (
        <AdOverlay
          ad={activeAd.ad}
          duration={activeAd.duration || 10}
          skippableAfter={activeAd.skippableAfter || 5}
          onSkip={handleAdSkip}
          onEnd={() => setActiveAd(null)}
        />
      )}
      {sessionEnded && (
        <SessionEndedOverlay message={sessionEnded.message} />
      )}
      <Footer />
    </div>
  );
};

export default QueuePage;
