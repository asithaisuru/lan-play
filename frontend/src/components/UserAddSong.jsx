import { useState } from 'react';

const UserAddSong = ({ socket, username }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsLoading(true);
    
    try {
      socket.emit('add-song', {
        youtubeUrl: youtubeUrl.trim(),
        username,
        message: message.trim()
      });
      
      setYoutubeUrl('');
      setMessage('');
    } catch (error) {
      alert('Failed to add song: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎵</span>
        <h2 className="text-xl font-semibold text-gray-900">Add a Song</h2>
      </div>
      
      <form onSubmit={handleAddSong} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            YouTube URL
          </label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Message (Optional)
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something about this song..."
            className="input"
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary w-full"
          disabled={isLoading || !youtubeUrl.trim()}
        >
          ➕ {isLoading ? 'Adding...' : 'Add to Playlist'}
        </button>
      </form>

      <div className="mt-4 text-sm text-gray-600">
        <p className="font-semibold mb-1">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>youtube.com/watch?v=ID</li>
          <li>youtu.be/ID</li>
          <li>music.youtube.com/watch?v=ID</li>
        </ul>
      </div>
    </div>
  );
};

export default UserAddSong;