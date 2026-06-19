import { useEffect, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { usePlaylist } from "./hooks/usePlaylist";
import RoomJoin from "./components/RoomJoin";
import UserAddSong from "./components/UserAddSong";
import HostController from "./components/HostController";
import PlaylistDisplay from "./components/PlaylistDisplay";
import NowPlaying from "./components/NowPlaying";

const getOrCreateClientId = () => {
  const existingClientId = localStorage.getItem("lanPlayClientId");
  if (existingClientId) return existingClientId;

  const newClientId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("lanPlayClientId", newClientId);
  return newClientId;
};

const getUrlRoomCode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("room")?.trim().toUpperCase() || "";
};

function App() {
  const [joined, setJoined] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [clientId] = useState(getOrCreateClientId);
  const [showCopied, setShowCopied] = useState(false);
  const [networkIP, setNetworkIP] = useState(null);
  const [isLoadingIP, setIsLoadingIP] = useState(false);
  const [sharedRoomCode] = useState(getUrlRoomCode);

  const getServerUrl = () => {
    const currentHostname = window.location.hostname;
    if (currentHostname !== "localhost" && currentHostname !== "127.0.0.1") {
      return `http://${currentHostname}:5000`;
    }
    return "http://localhost:5000";
  };

  const serverUrl = getServerUrl();
  const { socket, isConnected } = useSocket(serverUrl);
  const {
    playlist,
    currentSong,
    currentSource,
    isHost,
    isAudioDevice,
    users,
    isPlaying,
    currentTime,
    playAnnouncement,
    resetPlaylist,
  } = usePlaylist(socket, clientId);

  useEffect(() => {
    const fetchNetworkIP = async () => {
      if (!isConnected) return;

      setIsLoadingIP(true);
      try {
        const response = await fetch(`${serverUrl}/api/network-info`);
        const data = await response.json();

        if (data.primaryIP) {
          setNetworkIP(data.primaryIP);
        } else if (data.networkIPs && data.networkIPs.length > 0) {
          setNetworkIP(data.networkIPs[0]);
        } else if (data.serverIP && data.serverIP !== "127.0.0.1") {
          setNetworkIP(data.serverIP);
        } else {
          setNetworkIP(null);
        }
      } catch (error) {
        console.error("Failed to fetch network IP:", error);
        setNetworkIP(null);
      } finally {
        setIsLoadingIP(false);
      }
    };

    fetchNetworkIP();
  }, [isConnected, serverUrl]);

  const copyRoomLink = () => {
    const frontendPort = window.location.port;
    const baseUrl = networkIP && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `http://${networkIP}${frontendPort ? `:${frontendPort}` : ""}`
      : window.location.origin;
    const roomLink = `${baseUrl}?room=${userInfo?.roomCode}`;

    navigator.clipboard
      .writeText(roomLink)
      .then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  useEffect(() => {
    const roomCode = sharedRoomCode || localStorage.getItem("lanPlayRoomCode");
    const username = localStorage.getItem("lanPlayUsername");

    if (sharedRoomCode) {
      localStorage.setItem("lanPlayRoomCode", sharedRoomCode);
    }

    if (roomCode && username && socket && isConnected) {
      socket.emit("join-room", { roomCode, username, clientId });
      setUserInfo({ username, roomCode });
      setJoined(true);
    }
  }, [socket, isConnected, clientId, sharedRoomCode]);

  const handleJoin = (info) => {
    setUserInfo(info);
    setJoined(true);
    localStorage.setItem("lanPlayUsername", info.username);
    localStorage.setItem("lanPlayRoomCode", info.roomCode);
  };

  const handleLeaveRoom = () => {
    if (socket && joined) {
      socket.emit("leave-room");
    }
    localStorage.removeItem("lanPlayRoomCode");
    resetPlaylist();
    setJoined(false);
    setUserInfo(null);
    window.history.replaceState({}, "", window.location.pathname);
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400 text-sm font-black text-slate-950">
            LP
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Connecting to LAN Play</h1>
          <p className="text-slate-400">Starting the shared playlist session.</p>
          <div className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-cyan-300"></div>
          <p className="mt-5 rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-400">
            {serverUrl}
          </p>
          {serverUrl.includes("localhost") && (
            <p className="mt-3 text-xs text-amber-300">
              Make sure backend is running on localhost:5000
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <RoomJoin
        socket={socket}
        onJoin={handleJoin}
        clientId={clientId}
        initialRoomCode={sharedRoomCode || localStorage.getItem("lanPlayRoomCode") || ""}
      />
    );
  }

  const pendingCount = playlist?.songs?.filter((song) => !song.playedAt).length || 0;

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-lg border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-black/20 backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400 text-sm font-black text-slate-950">
                LP
              </div>
              <div>
                <p className="eyebrow">Live room</p>
                <h1 className="text-2xl font-black tracking-tight text-white">LAN Play</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                onClick={copyRoomLink}
                className="badge badge-slate gap-2 font-mono"
                title="Copy room link"
              >
                Room {userInfo?.roomCode}
                <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 font-sans text-[10px] text-cyan-100">
                  {showCopied ? "Copied" : "Copy"}
                </span>
              </button>
              <span className={isHost ? "badge badge-green" : "badge badge-blue"}>
                {isHost ? "Host" : "Listener"}
              </span>
              <span className="badge badge-slate">{users.length} connected</span>
              <span className="badge badge-slate">{pendingCount} pending</span>
              <button
                onClick={handleLeaveRoom}
                className="btn btn-secondary px-3 py-1.5 text-xs"
              >
                Leave room
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-400 md:grid-cols-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-950/60 px-3 py-2">
              <span className="font-semibold text-white">{userInfo?.username}</span>
              <span>signed in</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-950/60 px-3 py-2">
              <span className="font-semibold text-white">{playlist?.defaultSongs?.length || 0}</span>
              <span>default tracks</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-950/60 px-3 py-2">
              <span className="font-semibold text-white">
                {networkIP || (isLoadingIP ? "Detecting..." : "Local")}
              </span>
              <span>network</span>
            </div>
          </div>
        </div>

        {isHost && networkIP && (
          <div className="mb-5 rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold">Network access</p>
                <p className="text-cyan-200/80">
                  Other users can visit the room from your LAN using this address.
                </p>
              </div>
              <code className="rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-xs text-cyan-100">
                http://{networkIP}{window.location.port ? `:${window.location.port}` : ""}
              </code>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <NowPlaying
              currentSong={currentSong}
              currentSource={currentSource}
              isPlaying={isPlaying}
              syncedCurrentTime={currentTime}
              isHost={isHost}
              isAudioDevice={isAudioDevice}
              playAnnouncement={playAnnouncement}
              playlist={playlist}
              socket={socket}
            />

            <UserAddSong socket={socket} username={userInfo?.username} />

            <HostController
              socket={socket}
              isHost={isHost}
              users={users}
              playlist={playlist}
              clientId={clientId}
              isAudioDevice={isAudioDevice}
            />
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <PlaylistDisplay playlist={playlist} currentSong={currentSong} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
