import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Copy, Plus, XCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const getRoomCode = (room) => room.roomCode || room.room_code || room.code;
const getRoomName = (room) => room.name || room.playlistName || room.playlist_name || 'Untitled room';

const DashboardPage = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState('');
  const [copiedRoomCode, setCopiedRoomCode] = useState('');

  const tier = user?.tier || 'free';

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError('');
    try {
      const response = await api.get('/rooms');
      setRooms(response.data?.rooms || response.data || []);
    } catch (loadError) {
      setRooms([]);
      setError(loadError.response?.data?.message || 'Could not load rooms.');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const createRoom = async (event) => {
    event.preventDefault();
    if (!roomName.trim()) return;

    try {
      await api.post('/rooms', { name: roomName.trim() });
      setRoomName('');
      await loadRooms();
    } catch (createError) {
      setError(createError.response?.data?.message || 'Could not create room.');
    }
  };

  const endRoom = async (room) => {
    const code = getRoomCode(room);
    if (!code) return;

    try {
      await api.delete(`/rooms/${code}`);
      await loadRooms();
    } catch (endError) {
      setError(endError.response?.data?.message || 'Could not end room.');
    }
  };

  const copyGuestLink = async (room) => {
    const code = getRoomCode(room);
    if (!code) return;
    await navigator.clipboard.writeText(`https://waveio.app/room/${code}`);
    setCopiedRoomCode(code);
    setTimeout(() => setCopiedRoomCode((currentCode) => (currentCode === code ? '' : currentCode)), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Dashboard — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">Welcome back, {user?.name || 'Host'}</h1>
          </div>
          <span className="badge badge-green w-fit capitalize">{tier}</span>
        </div>

        {tier === 'free' && (
          <div className="mt-8 rounded-lg border border-[#C9A84C33] bg-[#1A1810] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-[#D0D0C8]">Upgrade to Pro for unlimited guests, Spotify, and no ads</p>
              <Link to="/pricing" className="btn btn-primary w-fit">View pricing</Link>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
            <h2 className="text-xl font-semibold">Active rooms</h2>
            {loadingRooms ? (
              <Spinner label="Loading rooms" />
            ) : rooms.length ? (
              <div className="mt-5 space-y-3">
                {rooms.map((room) => {
                  const code = getRoomCode(room);
                  return (
                    <div key={code || getRoomName(room)} className="rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4">
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="font-semibold">{getRoomName(room)}</p>
                          <p className="mt-1 font-mono text-sm text-[#888880]">{code}</p>
                          <p className="mt-1 break-all text-xs text-[#888880]">waveio.app/room/{code}</p>
                          <Link to={`/room/${code}`} className="mt-2 inline-flex text-xs font-semibold text-[#C9A84C] hover:text-[#F0C040]">
                            Open as Guest
                          </Link>
                          <p className="mt-3 text-xs leading-5 text-[#D0D0C8]">
                            Open Host Controls on this device, then open Player View on your speaker device.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/room/${code}/host`}
                            className="btn border border-[#C9A84C] bg-transparent px-3 py-2 text-[#C9A84C] hover:bg-[#C9A84C11] hover:text-[#F0C040]"
                          >
                            Host Controls
                          </Link>
                          <Link to={`/room/${code}/player`} className="btn btn-secondary px-3 py-2">
                            Player View
                          </Link>
                          <button type="button" onClick={() => copyGuestLink(room)} className="btn btn-secondary px-3 py-2" title="Copy guest link">
                            <Copy size={16} />
                            {copiedRoomCode === code ? 'Copied!' : 'Copy Guest Link'}
                          </button>
                          <button type="button" onClick={() => endRoom(room)} className="btn btn-danger px-3 py-2" title="End room">
                            <XCircle size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4 text-sm text-[#888880]">
                No active rooms. Create one to get started.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-[#C9A84C22] bg-[#141414] p-5">
            <h2 className="text-xl font-semibold">Create room</h2>
            <form onSubmit={createRoom} className="mt-5 space-y-4">
              <input
                type="text"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                className="input"
                placeholder="Friday night party"
              />
              <button type="submit" className="btn btn-primary w-full" disabled={!roomName.trim()}>
                <Plus size={17} />
                Create room
              </button>
            </form>
            <div className="mt-5 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4">
              <h3 className="font-semibold">My Playlists</h3>
              <p className="mt-2 text-sm leading-6 text-[#888880]">Create and manage your playlist library</p>
              <Link to="/dashboard/playlists" className="btn btn-secondary mt-4 w-full">
                Open playlists
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardPage;
