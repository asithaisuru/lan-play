import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, Music, Trash2, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  addPlaylistToRoom,
  addSongToPlaylist,
  deletePlaylist,
  getPlaylist,
  removeSongFromPlaylist,
  updatePlaylist
} from '../services/playlistsApi';
import { formatDuration, formatSongDuration } from '../utils/formatDuration';
import { PLAYLIST_TAGS } from '../utils/playlistTags';

const getYoutubeId = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '');
    return url.searchParams.get('v') || '';
  } catch {
    return trimmed;
  }
};

const fetchYoutubeMeta = async (youtubeId) => {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!response.ok) throw new Error('Could not read YouTube metadata.');
  const data = await response.json();
  return {
    title: data.title || 'Untitled YouTube video',
    thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
  };
};

const EditModal = ({ playlist, onClose, onSave }) => {
  const [name, setName] = useState(playlist.name || '');
  const [description, setDescription] = useState(playlist.description || '');
  const [tags, setTags] = useState(playlist.tags || []);
  const [isPublic, setIsPublic] = useState(Boolean(playlist.isPublic));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: description.trim(), tags, isPublic });
      onClose();
    } catch (saveError) {
      setError(saveError.response?.data?.error || 'Could not save playlist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-[#C9A84C66] bg-[#141414] p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">Edit playlist</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#888880] hover:bg-[#0A0A0A] hover:text-[#F5F5F5]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <input value={name} onChange={(event) => setName(event.target.value)} className="input" placeholder="Playlist name" required />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="input min-h-28 resize-y" placeholder="Description" />
          <div className="flex flex-wrap gap-2">
            {PLAYLIST_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${tags.includes(tag) ? 'border-[#C9A84C] bg-[#C9A84C] text-[#0A0A0A]' : 'border-[#C9A84C22] text-[#888880]'}`}>
                {tag}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-3 text-sm text-[#D0D0C8]">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="accent-[#C9A84C]" />
            Make public
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};

const AddToRoomPanel = ({ playlist }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const loadRooms = async () => {
      setLoading(true);
      try {
        const response = await api.get('/rooms');
        const nextRooms = response.data?.rooms || [];
        setRooms(nextRooms);
        setRoomCode(nextRooms[0]?.roomCode || '');
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, [user]);

  const handleAdd = async () => {
    if (!roomCode) return;
    setError('');
    setMessage('');
    try {
      const response = await addPlaylistToRoom(playlist.id, roomCode);
      setMessage(`✓ ${response.data?.songsAdded || playlist.songCount} songs added to ${response.data?.roomName || roomCode}`);
    } catch (addError) {
      setError(addError.response?.data?.error || 'Could not add playlist to room.');
    }
  };

  if (!user) {
    return <Link to={`/login?from=/playlists/${playlist.id}`} className="btn btn-primary">Sign in to add to room</Link>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select value={roomCode} onChange={(event) => setRoomCode(event.target.value)} className="input sm:max-w-xs" disabled={loading}>
        {rooms.map((room) => <option key={room.roomCode} value={room.roomCode}>{room.name || room.playlistName} · {room.roomCode}</option>)}
      </select>
      <button type="button" onClick={handleAdd} className="btn btn-primary" disabled={!roomCode}>Add to my room</button>
      {message && <p className="self-center text-sm text-[#C9A84C]">{message}</p>}
      {error && <p className="self-center text-sm text-rose-200">{error}</p>}
    </div>
  );
};

const PlaylistDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [addingSong, setAddingSong] = useState(false);
  const [songError, setSongError] = useState('');

  const loadPlaylist = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getPlaylist(id);
      setPlaylist(response.data?.playlist);
    } catch (loadError) {
      setError(loadError.response?.data?.error || 'Could not load playlist.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const isOwner = Boolean(playlist?.isOwner || (user && playlist?.hostId === user.id));

  const handleDelete = async () => {
    if (!window.confirm('Delete this playlist?')) return;
    await deletePlaylist(playlist.id);
    navigate('/dashboard/playlists');
  };

  const handleSave = async (data) => {
    const response = await updatePlaylist(playlist.id, data);
    setPlaylist(response.data?.playlist);
  };

  const handleRemoveSong = async (songId) => {
    const response = await removeSongFromPlaylist(playlist.id, songId);
    setPlaylist(response.data?.playlist);
  };

  const handleAddSong = async (event) => {
    event.preventDefault();
    const youtubeId = getYoutubeId(youtubeUrl);
    if (!youtubeId) return;

    setAddingSong(true);
    setSongError('');
    try {
      const meta = await fetchYoutubeMeta(youtubeId);
      const response = await addSongToPlaylist(playlist.id, {
        youtubeId,
        title: meta.title,
        thumbnail: meta.thumbnail,
        duration: 0
      });
      setPlaylist(response.data?.playlist);
      setYoutubeUrl('');
    } catch (addError) {
      setSongError(addError.response?.data?.error || addError.message || 'Could not add song.');
    } finally {
      setAddingSong(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <Header />
        <Spinner label="Loading playlist" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error || 'Playlist not found.'}</p>
          <Link to="/playlists" className="btn btn-primary mt-6">Back to library</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>{playlist.name} — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <Link to="/playlists" className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A84C] hover:text-[#F0C040]">
          <ArrowLeft size={16} /> Back to library
        </Link>

        <section className="mt-8 rounded-xl border border-[#C9A84C22] bg-[#141414] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-black">{playlist.name}</h1>
              <p className="mt-2 text-[#888880]">by {playlist.hostName}</p>
              <p className="mt-5 max-w-2xl leading-7 text-[#D0D0C8]">{playlist.description || 'No description yet.'}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(playlist.tags || []).map((tag) => <span key={tag} className="rounded-full border border-[#C9A84C33] bg-[#C9A84C10] px-3 py-1 text-sm font-semibold text-[#C9A84C]">{tag}</span>)}
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#888880]">
                <span className="inline-flex items-center gap-1.5"><Music size={16} /> {playlist.songCount} songs</span>
                <span className="inline-flex items-center gap-1.5"><Clock size={16} /> {formatDuration(playlist.totalDuration)} total</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner ? (
                <>
                  <button type="button" onClick={() => setEditOpen(true)} className="btn btn-secondary">Edit playlist</button>
                  <button type="button" onClick={handleDelete} className="btn btn-danger">Delete</button>
                </>
              ) : (
                <AddToRoomPanel playlist={playlist} />
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-[#C9A84C22] bg-[#141414] p-5">
          <h2 className="text-xl font-bold">Songs</h2>
          {playlist.songs?.length ? (
            <div className="mt-5 divide-y divide-[#C9A84C14]">
              {playlist.songs.map((song, index) => (
                <div key={song.id} className="grid grid-cols-[32px_48px_minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <span className="font-mono text-sm text-[#C9A84C]">{index + 1}</span>
                  <img src={song.thumbnail || `https://i.ytimg.com/vi/${song.youtubeId}/default.jpg`} alt="" className="h-12 w-12 rounded object-cover" />
                  <p className="truncate font-semibold">{song.title}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-[#888880]">{formatSongDuration(song.duration)}</span>
                    {isOwner && (
                      <button type="button" onClick={() => handleRemoveSong(song.id)} className="rounded-full p-2 text-[#888880] transition hover:bg-rose-500/10 hover:text-rose-200" aria-label="Remove song">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-4 text-sm text-[#888880]">No songs yet.</p>
          )}

          {isOwner && (
            <form onSubmit={handleAddSong} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} className="input" placeholder="YouTube URL" />
              <button type="submit" className="btn btn-primary" disabled={addingSong || !youtubeUrl.trim()}>{addingSong ? 'Adding...' : 'Add song'}</button>
              {songError && <p className="sm:col-span-2 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{songError}</p>}
            </form>
          )}
        </section>
      </main>
      <Footer />
      {editOpen && <EditModal playlist={playlist} onClose={() => setEditOpen(false)} onSave={handleSave} />}
    </div>
  );
};

export default PlaylistDetailPage;
