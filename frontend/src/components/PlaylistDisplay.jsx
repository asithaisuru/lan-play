const PlaylistDisplay = ({ playlist, currentSong }) => {
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📋</span>
        <h2 className="text-xl font-semibold text-gray-900">
          Playlist ({playlist?.songs?.length || 0} songs)
        </h2>
      </div>

      {!playlist?.songs?.length ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-3 opacity-50">🎵</div>
          <p className="font-semibold">No songs in playlist yet</p>
          <p className="text-sm mt-1">Add YouTube links to get started!</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
          {playlist.songs.map((song, index) => (
            <div 
              key={song._id || index}
              className={`song-item ${currentSong?._id === song._id ? 'current-song' : ''}`}
            >
              <img 
                src={song.thumbnail} 
                alt={song.title}
                className="w-20 h-15 rounded-lg object-cover flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate mb-1">
                  {song.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    👤 {song.addedBy}
                  </span>
                  {song.message && (
                    <span className="flex items-center gap-1">
                      💬 "{song.message}"
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-500 flex-shrink-0">
                <span>⏱️</span>
                <span className="text-sm font-medium">
                  {formatDuration(song.duration)}
                </span>
              </div>

              {currentSong?._id === song._id && (
                <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold flex-shrink-0">
                  NOW PLAYING
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistDisplay;