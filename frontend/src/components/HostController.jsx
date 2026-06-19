import { useState } from 'react';

const HostController = ({ 
  socket, 
  isHost, 
  users,
  playlist,
  clientId,
  isAudioDevice
}) => {
  const [defaultUrl, setDefaultUrl] = useState('');
  const [isAddingDefault, setIsAddingDefault] = useState(false);

  const handleAnnouncementToggle = (event) => {
    socket.emit('set-announcement-enabled', { enabled: event.target.checked });
  };

  const handleAddDefaultSong = (event) => {
    event.preventDefault();
    if (!defaultUrl.trim()) return;

    setIsAddingDefault(true);
    socket.emit('add-default-song', { youtubeUrl: defaultUrl.trim() });
    setDefaultUrl('');
    setTimeout(() => setIsAddingDefault(false), 800);
  };

  const handleRemoveDefaultSong = (songId) => {
    socket.emit('remove-default-song', { songId });
  };

  const handleMoveDefaultSong = (songId, direction) => {
    const songs = [...(playlist?.defaultSongs || [])];
    const currentIndex = songs.findIndex((song) => song._id === songId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= songs.length) return;

    const [song] = songs.splice(currentIndex, 1);
    songs.splice(nextIndex, 0, song);
    socket.emit('reorder-default-songs', { songIds: songs.map((item) => item._id) });
  };

  const handleClearDefaultPlaylist = () => {
    socket.emit('clear-default-playlist');
  };

  const handleTransferHost = (targetClientId) => {
    if (!targetClientId || targetClientId === clientId) return;
    socket.emit('transfer-host', { targetClientId });
  };

  const handleAssignAudioDevice = (targetClientId) => {
    if (!targetClientId || targetClientId === playlist?.audioClientId) return;
    socket.emit('set-audio-device', { targetClientId });
  };

  if (!isHost) {
    return (
      <div className="card">
        <div className="rounded-lg border border-violet-300/20 bg-violet-400/10 p-5">
          <p className="eyebrow">Listener mode</p>
          <h3 className="mt-1 text-lg font-bold text-white">Host controls are locked</h3>
          <p className="mt-2 text-sm text-slate-400">
            The host controls the room. Audio plays from the assigned playback device.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-slate-200">
            {isAudioDevice ? 'This device plays audio' : `${users.length} connected`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title mb-5">
        <div>
          <p className="eyebrow">Admin</p>
          <h2 className="mt-1 text-xl font-bold text-white">Host controls</h2>
        </div>
        <span className="badge badge-green">You are host</span>
      </div>

      <div className="panel mb-4">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Spoken messages</p>
            <p className="text-sm text-slate-400">Read user song messages aloud on the assigned audio device.</p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(playlist?.announcementEnabled)}
            onChange={handleAnnouncementToggle}
            className="h-5 w-5 accent-cyan-400"
          />
        </label>
      </div>

      <div className="panel mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-white">Default playlist</p>
            <p className="text-sm text-slate-400">Loops when there are no pending user songs.</p>
          </div>
          <span className="badge badge-slate">
            {playlist?.defaultSongs?.length || 0}
          </span>
        </div>

        <form onSubmit={handleAddDefaultSong} className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="url"
            value={defaultUrl}
            onChange={(event) => setDefaultUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input flex-1"
          />
          <button
            type="submit"
            className="btn btn-primary justify-center sm:w-auto"
            disabled={isAddingDefault || !defaultUrl.trim()}
          >
            Add
          </button>
        </form>

        {playlist?.defaultSongs?.length ? (
          <div className="space-y-2">
            <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/60">
              {playlist.defaultSongs.map((song, index) => (
                <div key={song._id} className="flex items-center gap-3 border-b border-white/10 p-3 last:border-b-0">
                  <img
                    src={song.thumbnail}
                    alt={song.title}
                    className="h-10 w-14 flex-shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{song.title}</p>
                    {playlist.currentPlaying === song._id && playlist.currentSource === 'default' && (
                      <p className="text-xs text-cyan-300">Playing as default</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveDefaultSong(song._id, -1)}
                      disabled={index === 0}
                      className="rounded bg-white/10 px-2 py-1 text-slate-200 disabled:opacity-40"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDefaultSong(song._id, 1)}
                      disabled={index === playlist.defaultSongs.length - 1}
                      className="rounded bg-white/10 px-2 py-1 text-slate-200 disabled:opacity-40"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDefaultSong(song._id)}
                      className="rounded bg-rose-500/10 px-2 py-1 text-rose-200"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClearDefaultPlaylist}
              className="text-sm font-semibold text-rose-300 hover:text-rose-200"
            >
              Clear default playlist
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No default songs yet.</p>
        )}
      </div>

      <div className="panel">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-white">Connected users</p>
          <span className="badge badge-slate">{users.length}</span>
        </div>
        <div className="grid gap-2">
          {users.map(user => (
            <div
              key={user.socketId}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                user.isHost 
                  ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' 
                  : 'border-white/10 bg-slate-950/60 text-slate-300'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 truncate font-semibold">
                <span className="truncate">{user.username}</span>
                {user.isHost && <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs font-bold uppercase text-cyan-100">Host</span>}
                {user.isAudioDevice && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-bold uppercase text-emerald-100">Audio</span>}
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                {user.clientId && !user.isAudioDevice && (
                  <button
                    type="button"
                    onClick={() => handleAssignAudioDevice(user.clientId)}
                    className="rounded-md bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
                    title={`Play audio from ${user.username}'s device`}
                  >
                    Use audio
                  </button>
                )}
                {!user.isHost && user.clientId && (
                  <button
                    type="button"
                    onClick={() => handleTransferHost(user.clientId)}
                    className="rounded-md bg-cyan-400 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                    title={`Transfer host to ${user.username}`}
                  >
                    Make host
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostController;
