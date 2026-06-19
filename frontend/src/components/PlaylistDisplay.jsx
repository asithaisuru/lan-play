const PlaylistDisplay = ({ playlist, currentSong }) => {
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const pendingSongs = playlist?.songs?.filter((song) => !song.playedAt) || [];
  const playedSongs = playlist?.songs?.filter((song) => song.playedAt) || [];

  const renderSong = (song, index, options = {}) => (
    <div 
      key={song._id || index}
      className={`song-item ${currentSong?._id === song._id ? 'current-song' : ''}`}
    >
      <img 
        src={song.thumbnail} 
        alt={song.title}
        className="h-14 w-20 flex-shrink-0 rounded-lg object-cover"
      />
      
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-white">
          {song.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{options.defaultSong ? 'Default playlist' : song.addedBy}</span>
          {song.message && <span className="truncate">"{song.message}"</span>}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
        <span className="font-medium">{formatDuration(song.duration)}</span>
        {currentSong?._id === song._id && (
          <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-950">
            Live
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-title mb-5">
        <div>
          <p className="eyebrow">Queue</p>
          <h2 className="mt-1 text-xl font-bold text-white">Room playlist</h2>
        </div>
        <span className="badge badge-slate">{pendingSongs.length} pending</span>
      </div>

      {!playlist?.songs?.length && !playlist?.defaultSongs?.length ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/50 px-5 py-10 text-center">
          <p className="font-semibold text-slate-200">No tracks yet</p>
          <p className="mt-1 text-sm text-slate-400">New requests and default tracks will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-100">Upcoming requests</p>
              <span className="text-xs text-slate-400">{pendingSongs.length}</span>
            </div>
            {pendingSongs.length ? (
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/50">
                {pendingSongs.map((song, index) => renderSong(song, index))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400">
                No pending user requests.
              </div>
            )}
          </section>

          {playlist?.defaultSongs?.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-100">Default playlist</p>
                <span className="text-xs text-slate-400">{playlist.defaultSongs.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/50">
                {playlist.defaultSongs.map((song, index) => renderSong(song, index, { defaultSong: true }))}
              </div>
            </section>
          )}

          {playedSongs.length > 0 && (
            <section>
              <details className="rounded-lg border border-white/10 bg-slate-950/50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-300">
                  Played requests ({playedSongs.length})
                </summary>
                <div className="border-t border-white/10 bg-slate-950/40">
                  {playedSongs.map((song, index) => renderSong(song, index))}
                </div>
              </details>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default PlaylistDisplay;
