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
      <div className="card-title mb-5">
        <div>
          <p className="eyebrow">Requests</p>
          <h2 className="mt-1 text-xl font-bold text-white">Add a song</h2>
        </div>
        <span className="badge badge-green">Queue priority</span>
      </div>
      
      <form onSubmit={handleAddSong} className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">
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
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            Message
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
          className="btn btn-primary h-[46px] w-full lg:w-auto"
          disabled={isLoading || !youtubeUrl.trim()}
        >
          {isLoading ? 'Adding...' : 'Add song'}
        </button>
      </form>
    </div>
  );
};

export default UserAddSong;
