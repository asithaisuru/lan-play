import { useState, useEffect } from "react";
import { useSocket } from "./hooks/useSocket";
import { usePlaylist } from "./hooks/usePlaylist";
import RoomJoin from "./components/RoomJoin";
import UserAddSong from "./components/UserAddSong";
import HostController from "./components/HostController";
import PlaylistDisplay from "./components/PlaylistDisplay";
import NowPlaying from "./components/NowPlaying";

function App() {
  const [joined, setJoined] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
  const [networkIP, setNetworkIP] = useState(null);
  const [isLoadingIP, setIsLoadingIP] = useState(false);

  // Dynamic server URL based on current access method
  const getServerUrl = () => {
    const currentHostname = window.location.hostname;
    
    // If accessing via network IP, use network IP for backend too
    if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
      return `http://${currentHostname}:5000`;
    }
    
    // Otherwise use localhost
    return "http://localhost:5000";
  };

  const serverUrl = getServerUrl();

  const { socket, isConnected } = useSocket(serverUrl);
  const {
    playlist,
    currentSong,
    isHost,
    users,
    isPlaying,
    currentTime,
    playAnnouncement,
  } = usePlaylist(socket);

  // Get network IP from backend
  useEffect(() => {
    const fetchNetworkIP = async () => {
      if (!isConnected) return;
      
      setIsLoadingIP(true);
      try {
        const response = await fetch(`${serverUrl}/api/network-info`);
        const data = await response.json();
        
        console.log('Network info from backend:', data);
        
        // Use the first network IP, or fallback to client IP
        if (data.networkIPs && data.networkIPs.length > 0) {
          setNetworkIP(data.networkIPs[0]);
        } else if (data.serverIP && data.serverIP !== '127.0.0.1') {
          setNetworkIP(data.serverIP);
        } else {
          setNetworkIP(null);
        }
      } catch (error) {
        console.error('Failed to fetch network IP:', error);
        setNetworkIP(null);
      } finally {
        setIsLoadingIP(false);
      }
    };

    if (isConnected) {
      fetchNetworkIP();
    }
  }, [isConnected, serverUrl]);

  const copyRoomLink = () => {
    let baseUrl;
    
    // If we have a valid network IP and user is on localhost, use network IP
    if (networkIP && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      baseUrl = `http://${networkIP}:3000`;
    } else {
      // Use current URL
      baseUrl = window.location.origin;
    }
    
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
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get("room");
    const username = localStorage.getItem("lanPlayUsername");

    if (roomCode && username && socket && isConnected) {
      socket.emit("join-room", { roomCode, username });
      setUserInfo({ username, roomCode });
      setJoined(true);
    }
  }, [socket, isConnected]);

  const handleJoin = (info) => {
    setUserInfo(info);
    setJoined(true);
    localStorage.setItem("lanPlayUsername", info.username);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-md w-full">
          <div className="text-5xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">LAN Play</h1>
          <p className="text-gray-600">Connecting to server...</p>
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Trying to connect to: {serverUrl}
          </p>
          {serverUrl.includes('localhost') && (
            <p className="text-xs text-orange-600 mt-2">
              Make sure backend is running on localhost:5000
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!joined) {
    return <RoomJoin socket={socket} onJoin={handleJoin} />;
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🎵</div>
            <div>
              <h1 className="text-2xl font-bold text-white">LAN Play</h1>
              <p className="text-purple-200 text-sm">
                Real-time shared playlist
                {networkIP && ` | Network: ${networkIP}`}
                {isLoadingIP && ` | Detecting IP...`}
              </p>
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-white">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span>Room:</span>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-2 py-1">
                  <strong>{userInfo?.roomCode}</strong>
                  <button
                    onClick={copyRoomLink}
                    className="p-1 hover:bg-white/20 rounded transition-colors duration-200"
                    title="Copy room link"
                  >
                    {showCopied ? "✅" : "📋"}
                  </button>
                </div>
                {showCopied && (
                  <span className="text-xs bg-green-500 text-white px-2 py-1 rounded animate-pulse">
                    Copied!
                  </span>
                )}
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div>
                User: <strong>{userInfo?.username}</strong>
                {isHost && " 👑"}
              </div>
            </div>
          </div>
        </div>

        {/* Network IP Help Section */}
        {isHost && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-xl">🌐</span>
              <div className="flex-1">
                <p className="font-semibold">Network Access Information</p>
                <div className="text-sm text-blue-700 mt-1">
                  {isLoadingIP ? (
                    <p>Detecting your network IP...</p>
                  ) : networkIP ? (
                    <div>
                      <p>Your network IP: <strong>{networkIP}</strong></p>
                      <p className="mt-1">Other users should visit: <code className="bg-blue-100 px-2 py-1 rounded">http://{networkIP}:3000</code></p>
                    </div>
                  ) : (
                    <div>
                      <p>Could not detect network IP automatically.</p>
                      <p className="mt-1">To find your IP:</p>
                      <ul className="list-disc list-inside mt-1 ml-2">
                        <li>Windows: Open cmd and type <code className="bg-blue-100 px-1 rounded">ipconfig</code></li>
                        <li>Mac/Linux: Open terminal and type <code className="bg-blue-100 px-1 rounded">ifconfig</code></li>
                        <li>Look for your local IP (usually starts with 192.168.x.x or 10.x.x.x or 172.x.x.x)</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <NowPlaying
              currentSong={currentSong}
              isPlaying={isPlaying}
              isHost={isHost}
              playAnnouncement={playAnnouncement}
              playlist={playlist}
              socket={socket}
            />

            <HostController
              socket={socket}
              isHost={isHost}
              currentSong={currentSong}
              isPlaying={isPlaying}
              users={users}
              playlist={playlist}
            />

            <UserAddSong socket={socket} username={userInfo?.username} />
          </div>

          {/* Right Column */}
          <div>
            <PlaylistDisplay playlist={playlist} currentSong={currentSong} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;