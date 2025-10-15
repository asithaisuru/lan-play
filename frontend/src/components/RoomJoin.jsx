import { useState } from 'react';

const RoomJoin = ({ socket, onJoin }) => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) return;

    socket.emit('join-room', {
      roomCode: roomCode.trim(),
      username: username.trim()
    });
    
    onJoin({ username: username.trim(), roomCode: roomCode.trim() });
  };

  const createNewRoom = () => {
    if (!username.trim()) return;
    
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(newRoomCode);
    
    socket.emit('join-room', {
      roomCode: newRoomCode,
      username: username.trim()
    });
    
    onJoin({ username: username.trim(), roomCode: newRoomCode });
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎵</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LAN Play</h1>
          <p className="text-gray-600">Share music across your local network</p>
        </div>
        
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              className="input"
              required
            />
          </div>

          <div className="space-y-3">
            <button type="submit" className="btn btn-primary w-full">
              🚪 Join Room
            </button>
            
            <button 
              type="button" 
              onClick={createNewRoom}
              className="btn btn-secondary w-full"
              disabled={!username.trim()}
            >
              👥 Create New Room
            </button>
          </div>
        </form>

        {roomCode && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-blue-900">📋 Invite Link:</p>
              <button
                onClick={copyInviteLink}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                title="Copy invite link"
              >
                📎
              </button>
            </div>
            <p className="font-mono text-sm bg-white p-2 rounded border break-all">
              {window.location.origin}?room={roomCode}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Share this link with others on your network
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomJoin;