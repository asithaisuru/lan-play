import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Spinner from '../components/ui/Spinner';
import {
  createPlaylist,
  deletePlaylist,
  getMyPlaylists,
  updatePlaylist
} from '../services/playlistsApi';
import { formatDuration } from '../utils/formatDuration';
import { PLAYLIST_TAGS } from '../utils/playlistTags';

const PlaylistModal = ({ playlist = null, onClose, onSave }) => {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [tags, setTags] = useState(playlist?.tags || []);
  const [isPublic, setIsPublic] = useState(Boolean(playlist?.isPublic));
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
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-[#C9A84C66] bg-[#141414] p-5 text-[#F5F5F5]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">{playlist ? 'Edit playlist' : 'New playlist'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#888880] hover:bg-[#0A0A0A] hover:text-[#F5F5F5]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <input value={name} onChange={(event) => setName(event.target.value)} className="input" placeholder="Name" required />
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
            Make public — visible to all Waveio users
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? 'Saving...' : playlist ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
};

const MyPlaylistsPage = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalPlaylist, setModalPlaylist] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMyPlaylists();
      setPlaylists(response.data?.playlists || []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || 'Could not load playlists.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handleCreate = async (data) => {
    await createPlaylist(data);
    await loadPlaylists();
  };

  const handleUpdate = async (data) => {
    await updatePlaylist(modalPlaylist.id, data);
    await loadPlaylists();
  };

  const handleDelete = async (playlist) => {
    if (!window.confirm(`Delete ${playlist.name}?`)) return;
    await deletePlaylist(playlist.id);
    await loadPlaylists();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Helmet>
        <title>My Playlists — Waveio</title>
      </Helmet>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A84C] hover:text-[#F0C040]">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Library manager</p>
            <h1 className="mt-2 text-4xl font-black">My Playlists</h1>
          </div>
          <button type="button" onClick={() => setNewOpen(true)} className="btn btn-primary w-fit">
            <Plus size={17} /> New playlist
          </button>
        </div>

        {error && <p className="mt-6 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

        {loading ? (
          <Spinner label="Loading playlists" />
        ) : playlists.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {playlists.map((playlist) => (
              <article key={playlist.id} className="rounded-xl border border-[#C9A84C22] bg-[#141414] p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-1 text-xl font-bold">{playlist.name}</h2>
                  <span className={playlist.isPublic ? 'badge badge-green' : 'badge badge-slate'}>{playlist.isPublic ? 'Public' : 'Private'}</span>
                </div>
                <p className="mt-3 text-sm text-[#888880]">{playlist.songCount} songs · {formatDuration(playlist.totalDuration)}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={`/playlists/${playlist.id}`} className="btn btn-secondary">View</Link>
                  <button type="button" onClick={() => setModalPlaylist(playlist)} className="btn btn-secondary">Edit</button>
                  <button type="button" onClick={() => handleDelete(playlist)} className="btn btn-danger">Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-[#C9A84C22] bg-[#141414] px-6 py-14 text-center">
            <h2 className="text-2xl font-bold">No playlists yet</h2>
            <p className="mt-2 text-[#888880]">Create your first reusable playlist library.</p>
            <button type="button" onClick={() => setNewOpen(true)} className="btn btn-primary mt-6">New playlist</button>
          </div>
        )}
      </main>
      <Footer />
      {newOpen && <PlaylistModal onClose={() => setNewOpen(false)} onSave={handleCreate} />}
      {modalPlaylist && <PlaylistModal playlist={modalPlaylist} onClose={() => setModalPlaylist(null)} onSave={handleUpdate} />}
    </div>
  );
};

export default MyPlaylistsPage;
