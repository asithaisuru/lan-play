import { useEffect, useState } from 'react';

const RoomJoin = ({ socket, onJoin, clientId, initialRoomCode = '' }) => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode);

  useEffect(() => {
    setRoomCode(initialRoomCode);
  }, [initialRoomCode]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) return;

    socket.emit('join-room', {
      roomCode: roomCode.trim(),
      username: username.trim(),
      clientId
    });
    
    onJoin({ username: username.trim(), roomCode: roomCode.trim() });
  };

  const createNewRoom = () => {
    if (!username.trim()) return;
    
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(newRoomCode);
    
    socket.emit('join-room', {
      roomCode: newRoomCode,
      username: username.trim(),
      clientId
    });
    
    onJoin({ username: username.trim(), roomCode: newRoomCode });
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-slate-900/90 shadow-2xl shadow-black/40 md:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-black/40 p-8 text-white md:p-10">
          <div className="mb-10 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400 text-xl font-black text-slate-950">
            LP
          </div>
          <p className="eyebrow">Local room audio</p>
          <h1 className="mt-3 max-w-md text-4xl font-black tracking-tight md:text-5xl">LAN Play</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
            Run a shared room playlist from one host device, collect YouTube requests, and keep the music moving.
          </p>

          <div className="mt-10 grid gap-3 text-sm text-slate-200">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Host-controlled playback</p>
              <p className="mt-1 text-slate-400">One device handles the audio while everyone contributes.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Persistent room memory</p>
              <p className="mt-1 text-slate-400">Return to your recent room without re-entering details.</p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6">
            <p className="eyebrow">Enter room</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Join or create a playlist</h2>
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Your name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Asitha"
                className="input"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Room code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="input font-mono uppercase"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="submit" className="btn btn-primary w-full">
                Join room
              </button>
              
              <button 
                type="button" 
                onClick={createNewRoom}
                className="btn btn-secondary w-full"
                disabled={!username.trim()}
              >
                Create room
              </button>
            </div>
          </form>

          {roomCode && (
            <div className="panel mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Invite link</p>
                <button
                  onClick={copyInviteLink}
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                  title="Copy invite link"
                >
                  Copy
                </button>
              </div>
              <p className="break-all rounded-lg border border-white/10 bg-slate-950/70 p-3 font-mono text-xs text-slate-300">
                {window.location.origin}?room={roomCode}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomJoin;
