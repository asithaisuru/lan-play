import { useState } from 'react';

const UserAddSong = ({ socket, username }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState('');
  const [error, setError] = useState('');

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    if (!socket?.connected) {
      setError('Room server is reconnecting. Try again in a moment.');
      return;
    }

    setIsAdding(true);
    setAddedFeedback('');
    setError('');
    let feedbackTimer = null;
    let clearFeedbackTimer = null;
    
    try {
      const payload = {
        youtubeUrl: youtubeUrl.trim(),
        username,
        message: message.trim()
      };

      feedbackTimer = setTimeout(() => {
        setIsAdding(false);
        setAddedFeedback('Song added to queue!');
        clearFeedbackTimer = setTimeout(() => setAddedFeedback(''), 3000);
      }, 300);

      const response = await new Promise((resolve) => {
        socket.timeout(12000).emit('add-song', payload, (timeoutError, ack) => {
          if (timeoutError) {
            resolve({ ok: false, message: 'Song request timed out. Check the room connection and try again.' });
            return;
          }

          resolve(ack || { ok: false, message: 'The room server did not confirm the song request.' });
        });
      });

      if (!response.ok) {
        throw new Error(response.message || 'Failed to add song.');
      }
      
      setYoutubeUrl('');
      setMessage('');
    } catch (error) {
      clearTimeout(feedbackTimer);
      clearTimeout(clearFeedbackTimer);
      setAddedFeedback('');
      setError(error.message);
    } finally {
      setIsAdding(false);
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
          disabled={isAdding || !youtubeUrl.trim() || !socket?.connected}
        >
          {isAdding ? 'Adding...' : 'Add song'}
        </button>
      </form>
      {addedFeedback && (
        <p className="mt-2 text-sm text-[#C9A84C]">
          {addedFeedback}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      )}
    </div>
  );
};

export default UserAddSong;
