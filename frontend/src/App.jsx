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

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was blocked by the browser.");
    }
  } finally {
    document.body.removeChild(textArea);
  }
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

    copyTextToClipboard(roomLink)
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
          <div className="brand-mark mx-auto mb-4 h-12 w-12 text-sm">
            ♛
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-[#F5F5F5]">Connecting to Waveio</h1>
          <p className="text-[#888880]">Starting the shared playlist session.</p>
          <div className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-2 border-[#C9A84C22] border-t-[#C9A84C]"></div>
          <p className="mt-5 rounded-lg bg-[#141414] px-3 py-2 font-mono text-xs text-[#888880]">
            {serverUrl}
          </p>
          {serverUrl.includes("localhost") && (
            <p className="mt-3 text-xs text-[#C9A84C]">
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
        <div className="mb-4 rounded-lg border border-[#C9A84C33] bg-[#1A1810] p-4 text-sm text-[#F5F5F5] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#C9A84C]">Waveio Cloud</p>
              <p className="mt-1 text-[#888880]">Need internet rooms, subscriptions, Spotify, and unlimited guests? Get the cloud version.</p>
            </div>
            <a
              href="https://waveio.app"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary whitespace-nowrap"
            >
              waveio.app
            </a>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-[#C9A84C22] bg-[#141414]/90 p-4 backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="brand-mark h-12 w-12 text-sm">
                ♛
              </div>
              <div>
                <p className="eyebrow">Waveio LAN</p>
                <h1 className="text-2xl font-semibold tracking-[0.02em] text-[#F5F5F5]">Waveio</h1>
                <p className="text-xs text-[#888880]">A KRODOT Product | Crown of Technology</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                onClick={copyRoomLink}
                className="badge badge-slate gap-2 font-mono"
                title="Copy room link"
              >
                Room {userInfo?.roomCode}
                <span className="rounded-full bg-[#C9A84C22] px-1.5 py-0.5 font-sans text-[10px] text-[#F0C040]">
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
                className="btn btn-danger px-3 py-1.5 text-xs font-bold shadow-lg shadow-rose-950/20"
              >
                Leave room
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-[#888880] md:grid-cols-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#0A0A0A]/70 px-3 py-2">
              <span className="font-semibold text-[#F5F5F5]">{userInfo?.username}</span>
              <span>signed in</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[#0A0A0A]/70 px-3 py-2">
              <span className="font-semibold text-[#F5F5F5]">{playlist?.defaultSongs?.length || 0}</span>
              <span>default tracks</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[#0A0A0A]/70 px-3 py-2">
              <span className="font-semibold text-[#F5F5F5]">
                {networkIP || (isLoadingIP ? "Detecting..." : "Local")}
              </span>
              <span>network</span>
            </div>
          </div>
        </div>

        {isHost && networkIP && (
          <div className="mb-5 rounded-lg border border-[#C9A84C33] bg-[#C9A84C11] p-4 text-sm text-[#F5F5F5]">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold">Network access</p>
                <p className="text-[#888880]">
                  Other users can visit the room from your LAN using this address.
                </p>
              </div>
              <code className="rounded-lg bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-[#C9A84C]">
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

        <footer className="mt-8 border-t border-[#C9A84C22] py-5 text-center text-xs text-[#888880]">
          Waveio — A KRODOT Product | Crown of Technology
          <span className="mx-2">|</span>
          © 2026 KRODOT. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

export default App;
