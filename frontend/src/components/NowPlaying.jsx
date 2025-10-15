import { useEffect, useRef, useState } from 'react';

const NowPlaying = ({ 
  currentSong, 
  isPlaying, 
  isHost, 
  playAnnouncement,
  playlist,
  socket
}) => {
  const playerRef = useRef(null);
  const hasAnnouncedRef = useRef(false);
  const [player, setPlayer] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = initializePlayer;
    } else {
      initializePlayer();
    }
  }, []);

  // Initialize YouTube player when song changes (host only)
  const initializePlayer = () => {
    if (!currentSong || !isHost || !window.YT) return;
    
    // Clean up existing player
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    // Create new player
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '0',
      width: '0',
      videoId: currentSong.youtubeId,
      playerVars: {
        'autoplay': 0,
        'controls': 0,
        'disablekb': 1,
        'fs': 0,
        'modestbranding': 1,
        'playsinline': 1
      },
      events: {
        'onReady': (event) => {
          console.log('YouTube player ready');
          setPlayer(event.target);
          setIsPlayerReady(true);
          if (isPlaying) {
            event.target.playVideo();
          }
        },
        'onStateChange': (event) => {
          console.log('YouTube player state:', event.data);
          
          // Song started playing
          if (event.data === window.YT.PlayerState.PLAYING && !hasAnnouncedRef.current) {
            // Schedule announcement after 5 seconds
            setTimeout(() => {
              if (currentSong.message && isPlayerReady) {
                playAnnouncement(
                  `This song was added by ${currentSong.addedBy}. They say: ${currentSong.message}`,
                  event.target
                );
                hasAnnouncedRef.current = true;
              }
            }, 5000);
          }
          
          // Song ended - play next song
          if (event.data === window.YT.PlayerState.ENDED) {
            console.log('Song ended, playing next song...');
            hasAnnouncedRef.current = false;
            
            // Automatically play next song
            if (socket && isHost) {
              socket.emit('next-song');
            }
          }
          
          // Reset announcement flag when song is paused
          if (event.data === window.YT.PlayerState.PAUSED) {
            hasAnnouncedRef.current = false;
          }
        },
        'onError': (error) => {
          console.error('YouTube player error:', error);
          setIsPlayerReady(false);
          
          // If there's an error with the current song, skip to next
          if (socket && isHost) {
            console.log('Skipping to next song due to error');
            socket.emit('next-song');
          }
        }
      }
    });

    hasAnnouncedRef.current = false;
    setIsPlayerReady(false);
  };

  // Re-initialize player when song changes
  useEffect(() => {
    if (isHost && window.YT) {
      initializePlayer();
    }
  }, [currentSong, isHost]);

  // Handle play/pause controls (host only)
  useEffect(() => {
    if (isPlayerReady && player && isHost) {
      try {
        if (isPlaying) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } catch (error) {
        console.error('Player control error:', error);
      }
    }
  }, [isPlaying, isPlayerReady, player, isHost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  if (!currentSong) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-3 opacity-50">🎵</div>
          <h3 className="font-semibold text-lg mb-2">No Song Playing</h3>
          <p>Add songs to the playlist to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔊</span>
        <h2 className="text-xl font-semibold text-gray-900">Now Playing</h2>
        {!isHost && (
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full ml-2">
            Listening Mode
          </span>
        )}
        {isHost && (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full ml-2">
            Audio Host {isPlayerReady ? '✅' : '⏳'}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        <img 
          src={currentSong.thumbnail} 
          alt={currentSong.title}
          className="w-24 h-18 rounded-lg object-cover flex-shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
            {currentSong.title}
          </h3>
          
          <div className="flex items-center gap-2 text-gray-600 mb-3">
            <span>👤</span>
            <span className="font-medium">Added by: {currentSong.addedBy}</span>
          </div>
          
          {currentSong.message && (
            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3">
              <div className="flex items-center gap-2 text-blue-800 mb-1">
                <span>💬</span>
                <span className="font-semibold">Message:</span>
              </div>
              <p className="text-blue-700">"{currentSong.message}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden YouTube player - only for host */}
      {isHost && (
        <div className="hidden">
          <div id="youtube-player"></div>
        </div>
      )}

      {/* Status indicators */}
      {!isHost && isPlaying && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-xl">🎵</span>
            <div>
              <p className="font-semibold">Music is playing on host device</p>
              <p className="text-sm text-green-700">You're in sync with the playlist</p>
            </div>
          </div>
        </div>
      )}

      {!isHost && !isPlaying && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="text-xl">⏸️</span>
            <div>
              <p className="font-semibold">Playback paused</p>
              <p className="text-sm text-yellow-700">Waiting for host to resume</p>
            </div>
          </div>
        </div>
      )}

      {isHost && !isPlayerReady && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold">Initializing audio player...</p>
              <p className="text-sm text-yellow-700">Please wait a moment</p>
            </div>
          </div>
        </div>
      )}

      {isHost && isPlayerReady && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-800">
            <span className="text-xl">🔊</span>
            <div>
              <p className="font-semibold">Audio player ready</p>
              <p className="text-sm text-purple-700">All users are listening to your audio stream</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NowPlaying;