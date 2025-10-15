import { useState, useEffect, useRef } from 'react';

export const usePlaylist = (socket) => {
  const [playlist, setPlaylist] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef(null);
  const announcementRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    const handlePlaylistState = (data) => {
      setPlaylist(data.playlist);
      setIsHost(data.isHost);
      setUsers(data.playlist.users);
      setCurrentSong(data.playlist.songs.find(song => 
        song._id === data.playlist.currentPlaying
      ));
      setIsPlaying(data.playlist.isPlaying);
    };

    const handleSongAdded = (data) => {
      setPlaylist(data.playlist);
    };

    const handlePlaybackStarted = (data) => {
      setIsPlaying(true);
      setCurrentTime(data.currentTime);
    };

    const handlePlaybackPaused = (data) => {
      setIsPlaying(false);
      setCurrentTime(data.currentTime);
    };

    const handleSongChanged = (data) => {
      setCurrentSong(playlist?.songs.find(song => song._id === data.songId));
      setIsPlaying(true);
      setCurrentTime(0);
    };

    const handleUserJoined = (data) => {
      setUsers(data.users);
    };

    const handleUserLeft = (data) => {
      setUsers(data.users);
    };

    const handleHostChanged = (data) => {
      setIsHost(socket.id === data.newHostSocketId);
    };

    const handleError = (data) => {
      alert(data.message);
    };

    socket.on('playlist-state', handlePlaylistState);
    socket.on('song-added', handleSongAdded);
    socket.on('playback-started', handlePlaybackStarted);
    socket.on('playback-paused', handlePlaybackPaused);
    socket.on('song-changed', handleSongChanged);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('host-changed', handleHostChanged);
    socket.on('error', handleError);

    return () => {
      socket.off('playlist-state', handlePlaylistState);
      socket.off('song-added', handleSongAdded);
      socket.off('playback-started', handlePlaybackStarted);
      socket.off('playback-paused', handlePlaybackPaused);
      socket.off('song-changed', handleSongChanged);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('host-changed', handleHostChanged);
      socket.off('error', handleError);
    };
  }, [socket, playlist]);

  // Announcement system with volume ducking
  // In usePlaylist.js, update the playAnnouncement function:
const playAnnouncement = async (text, youtubePlayer) => {
  if (!youtubePlayer) return;

  try {
    // Store current volume
    const currentVolume = youtubePlayer.getVolume ? youtubePlayer.getVolume() : 100;
    
    // Duck volume to 30%
    if (youtubePlayer.setVolume) {
      youtubePlayer.setVolume(30);
    }

    // Create speech synthesis
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onend = () => {
      // Gradually increase volume back to original
      if (youtubePlayer.setVolume) {
        const fadeBack = setInterval(() => {
          const currentVol = youtubePlayer.getVolume ? youtubePlayer.getVolume() : 50;
          if (currentVol < currentVolume) {
            youtubePlayer.setVolume(Math.min(currentVolume, currentVol + 10));
          } else {
            clearInterval(fadeBack);
          }
        }, 300);
      }
    };

    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Announcement failed:', error);
    // Ensure volume returns to normal even if announcement fails
    if (youtubePlayer.setVolume) {
      youtubePlayer.setVolume(100);
    }
  }
};

  return {
    playlist,
    currentSong,
    isHost,
    users,
    isPlaying,
    currentTime,
    audioRef,
    announcementRef,
    playAnnouncement,
    setPlaylist
  };
};

// Make sure it's the default export as well
export default usePlaylist;