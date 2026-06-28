import { useEffect, useState } from 'react';

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('Copy command was blocked by the browser.');
    }
  } finally {
    document.body.removeChild(textArea);
  }
};

const RoomJoin = ({ socket, onJoin, clientId, initialRoomCode = '' }) => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [copyStatus, setCopyStatus] = useState('Copy');

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

  const copyInviteLink = async () => {
    const inviteLink = `${window.location.origin}?room=${roomCode}`;

    try {
      await copyTextToClipboard(inviteLink);
      setCopyStatus('Copied');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
      setCopyStatus('Failed');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-[#C9A84C22] bg-[#141414]/95 md:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-[#0A0A0A] p-8 text-[#F5F5F5] md:p-10">
          <div className="brand-mark mb-10 h-12 w-12 text-xl">
            ♛
          </div>
          <p className="eyebrow">Waveio LAN</p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-[0.02em] md:text-5xl">Waveio</h1>
          <p className="mt-2 text-sm text-[#C9A84C]">A KRODOT Product | Crown of Technology</p>
          <p className="mt-4 max-w-md text-base leading-7 text-[#888880]">
            Run a shared room playlist from one host device, collect YouTube requests, and keep the music moving.
          </p>

          <div className="mt-10 grid gap-3 text-sm text-[#F5F5F5]">
            <div className="rounded-lg border border-[#C9A84C22] bg-[#1A1810] p-4">
              <p className="font-semibold text-[#F5F5F5]">Host-controlled playback</p>
              <p className="mt-1 text-[#888880]">One assigned device handles the audio while everyone contributes.</p>
            </div>
            <div className="rounded-lg border border-[#C9A84C22] bg-[#1A1810] p-4">
              <p className="font-semibold text-[#F5F5F5]">Persistent room memory</p>
              <p className="mt-1 text-[#888880]">Return to your recent room without re-entering details.</p>
            </div>
            <div className="rounded-lg border border-[#C9A84C33] bg-[#C9A84C11] p-4">
              <p className="font-semibold text-[#C9A84C]">Cloud version</p>
              <p className="mt-1 text-[#888880]">Waveio Cloud is coming to waveio.app.</p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6">
            <p className="eyebrow">Enter room</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#F5F5F5]">Join or create a playlist</h2>
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
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
              <label className="mb-2 block text-sm font-semibold text-[#D0D0C8]">
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
                <p className="text-sm font-semibold text-[#F5F5F5]">Invite link</p>
                <button
                  onClick={copyInviteLink}
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                  title="Copy invite link"
                >
                  {copyStatus}
                </button>
              </div>
              <p className="break-all rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] p-3 font-mono text-xs text-[#888880]">
                {window.location.origin}?room={roomCode}
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#888880]">
            Waveio — A KRODOT Product | Crown of Technology
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoomJoin;
