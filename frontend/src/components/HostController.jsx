const HostController = ({ 
  socket, 
  isHost, 
  currentSong, 
  isPlaying, 
  users,
  playlist 
}) => {
  const handlePlay = () => {
    socket.emit('play', { 
      currentTime: 0,
      songId: currentSong?._id 
    });
  };

  const handlePause = () => {
    socket.emit('pause', { currentTime: 0 });
  };

  const handleNext = () => {
    socket.emit('next-song');
  };

  if (!isHost) {
    return (
      <div className="card">
        <div className="text-center py-6">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Listener Mode</h3>
          <p className="text-gray-600 mb-4">
            Only the host can control playback. Your device is synced to the host's music.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 inline-block">
            <span className="font-semibold">Connected Users:</span> 
            <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
              {users.length}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎛️</span>
        <h2 className="text-xl font-semibold text-gray-900">Host Controls</h2>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-green-800 mb-1">
          <span className="text-xl">👑</span>
          <p className="font-semibold">You are the Host</p>
        </div>
        <p className="text-sm text-green-700">
          You control the music for everyone. Audio plays from your device only.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        {isPlaying ? (
          <button 
            onClick={handlePause} 
            className="btn btn-secondary flex-1"
          >
            ⏸️ Pause
          </button>
        ) : (
          <button 
            onClick={handlePlay} 
            className="btn btn-primary flex-1"
            disabled={!currentSong}
          >
            ▶️ Play
          </button>
        )}
        
        <button 
          onClick={handleNext} 
          className="btn btn-secondary flex-1"
          disabled={!playlist?.songs?.length}
        >
          ⏭️ Next
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="font-semibold text-gray-900 mb-3">
          👥 Connected Users: <span className="text-purple-600">{users.length}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {users.map(user => (
            <span 
              key={user.socketId}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                user.isHost 
                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {user.username}
              {user.isHost && '👑'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostController;