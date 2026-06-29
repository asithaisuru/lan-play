import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Clock, ListMusic, Music, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { addPlaylistToRoom, getPublicPlaylists } from '../services/playlistsApi';
import { formatDuration } from '../utils/formatDuration';
import { PLAYLIST_TAGS } from '../utils/playlistTags';

const songFilters = [
  { label: 'Any', value: 0 },
  { label: '5+', value: 5 },
  { label: '10+', value: 10 },
  { label: '20+', value: 20 },
  { label: '50+', value: 50 }
];

const durationFilters = [
  { label: 'Any', value: 0 },
  { label: '30min+', value: 1800 },
  { label: '1hr+', value: 3600 },
  { label: '2hr+', value: 7200 },
  { label: '3hr+', value: 10800 }
];

const sortOptions = [
  { label: 'Newest', value: 'newest' },
  { label: 'Most songs', value: 'most_songs' },
  { label: 'Longest', value: 'longest' },
  { label: 'Most played', value: 'most_played' }
];

const getRoomCode = (room) => room.roomCode || room.room_code || room.code;
const getRoomName = (room) => room.name || room.playlistName || room.playlist_name || 'Untitled room';

const FilterButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
      active
        ? 'border-[#C9A84C] bg-[#C9A84C] text-[#0A0A0A]'
        : 'border-[#C9A84C22] bg-transparent text-[#888880] hover:border-[#C9A84C66] hover:text-[#F5F5F5]'
    }`}
  >
    {children}
  </button>
);

const AddToRoomModal = ({ playlist, onClose }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const loadRooms = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/rooms');
        const nextRooms = response.data?.rooms || [];
        setRooms(nextRooms);
        setSelectedRoom(getRoomCode(nextRooms[0]) || '');
      } catch (loadError) {
        setError(loadError.response?.data?.error || 'Could not load your rooms.');
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
  }, [user]);

  useEffect(() => () => {
    clearTimeout(closeTimerRef.current);
  }, []);

  const handleConfirm = async () => {
    if (!selectedRoom) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const response = await addPlaylistToRoom(playlist.id, selectedRoom);
      setMessage(`✓ ${response.data?.songsAdded || playlist.songCount} songs added to ${response.data?.roomName || selectedRoom}`);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 2000);
    } catch (addError) {
      setError(addError.response?.data?.error || 'Could not add this playlist to the room.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-[#C9A84C66] bg-[#141414] p-5 text-[#F5F5F5] shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Add to room</h2>
            <p className="mt-1 text-sm text-[#888880]">{playlist.name} · {playlist.songCount} songs</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#888880] transition hover:bg-[#0A0A0A] hover:text-[#F5F5F5]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <div className="mt-6 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4 text-sm text-[#D0D0C8]">
            Sign in to add community playlists to your rooms.
            <Link to="/login?from=/playlists" className="btn btn-primary mt-4 w-full">Sign in</Link>
          </div>
        ) : loading ? (
          <div className="mt-6 grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-[#1A1810]" />
            ))}
          </div>
        ) : rooms.length ? (
          <>
            <div className="mt-6 grid gap-3">
              {rooms.map((room) => {
                const code = getRoomCode(room);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedRoom(code)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedRoom === code
                        ? 'border-[#C9A84C] bg-[#C9A84C14]'
                        : 'border-[#C9A84C22] bg-[#0A0A0A] hover:border-[#C9A84C66]'
                    }`}
                  >
                    <p className="font-semibold">{getRoomName(room)}</p>
                    <p className="mt-1 font-mono text-sm text-[#888880]">{code}</p>
                    <p className="mt-2 text-xs text-[#888880]">
                      {room.defaultSongCount || room.default_song_count || 0} default songs
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !selectedRoom}
              className="btn btn-primary mt-5 w-full"
            >
              {submitting ? 'Adding...' : `Add ${playlist.songCount} songs`}
            </button>
          </>
        ) : (
          <p className="mt-6 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4 text-sm text-[#888880]">
            You do not have an active room yet. Create one from the dashboard first.
          </p>
        )}

        {message && <p className="mt-4 rounded-lg border border-[#C9A84C33] bg-[#C9A84C12] px-3 py-2 text-sm text-[#C9A84C]">{message}</p>}
        {error && <p className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
      </div>
    </div>
  );
};

const PlaylistsPage = () => {
  const [playlists, setPlaylists] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [minSongs, setMinSongs] = useState(0);
  const [minDuration, setMinDuration] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalPlaylist, setModalPlaylist] = useState(null);

  const filters = useMemo(() => ({
    isPublic: true,
    search,
    sortBy,
    minSongs,
    minDuration,
    tags: selectedTags
  }), [minDuration, minSongs, search, selectedTags, sortBy]);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getPublicPlaylists(filters);
      setPlaylists(response.data?.playlists || []);
    } catch (loadError) {
      setPlaylists([]);
      setError(loadError.response?.data?.error || 'Could not load playlists.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(loadPlaylists, 250);
    return () => clearTimeout(timer);
  }, [loadPlaylists]);

  const toggleTag = (tag) => {
    setSelectedTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>Playlist Library — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div>
          <p className="eyebrow">Community</p>
          <h1 className="mt-2 text-4xl font-black">Playlist Library</h1>
          <p className="mt-3 max-w-2xl text-[#888880]">Browse and add community playlists to your rooms</p>
        </div>

        <section className="mt-8 rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#141414] p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#888880]" size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-10"
                placeholder="Search playlists"
              />
            </label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="input">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {songFilters.map((filter) => (
              <FilterButton key={filter.label} active={minSongs === filter.value} onClick={() => setMinSongs(filter.value)}>
                {filter.label}
              </FilterButton>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {durationFilters.map((filter) => (
              <FilterButton key={filter.label} active={minDuration === filter.value} onClick={() => setMinDuration(filter.value)}>
                {filter.label}
              </FilterButton>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {PLAYLIST_TAGS.slice(0, 9).map((tag) => (
              <FilterButton key={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </FilterButton>
            ))}
          </div>
        </section>

        {error && <p className="mt-6 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

        {loading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-xl bg-[#1A1810]" />
            ))}
          </div>
        ) : playlists.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist) => (
              <article key={playlist.id} className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[#141414] p-5 transition hover:border-[rgba(201,168,76,0.4)]">
                <h2 className="line-clamp-1 text-xl font-semibold">{playlist.name}</h2>
                <p className="mt-1 text-sm text-[#888880]">by {playlist.hostName}</p>
                <p className="mt-4 line-clamp-2 min-h-[3rem] text-sm leading-6 text-[#D0D0C8]">{playlist.description || 'No description yet.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(playlist.tags || []).slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full border border-[#C9A84C33] bg-[#C9A84C10] px-2.5 py-1 text-xs font-semibold text-[#C9A84C]">{tag}</span>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-4 text-sm text-[#888880]">
                  <span className="inline-flex items-center gap-1.5"><Music size={16} /> {playlist.songCount} songs</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={16} /> {formatDuration(playlist.totalDuration)}</span>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link to={`/playlists/${playlist.id}`} className="btn btn-secondary">View playlist</Link>
                  <button type="button" onClick={() => setModalPlaylist(playlist)} className="btn btn-primary">Add to room</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-[#C9A84C22] bg-[#141414] px-6 py-14 text-center">
            <ListMusic className="mx-auto text-[#C9A84C]" size={42} />
            <h2 className="mt-4 text-2xl font-bold">No playlists found</h2>
            <p className="mt-2 text-[#888880]">Try adjusting your filters</p>
          </div>
        )}
      </main>
      <Footer />
      {modalPlaylist && <AddToRoomModal playlist={modalPlaylist} onClose={() => setModalPlaylist(null)} />}
    </div>
  );
};

export default PlaylistsPage;
