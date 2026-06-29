import { useCallback, useEffect, useRef, useState } from 'react';

const findCurrentSong = (playlist) => {
  if (!playlist) return null;
  if (playlist.currentSong) return playlist.currentSong;

  const allSongs = [
    ...(playlist.songs || []),
    ...(playlist.defaultSongs || [])
  ];

  return allSongs.find((song) => song._id === playlist.currentPlaying) || null;
};

const getServerCorrectedTime = (currentTime, serverTimestamp) => {
  const rawTime = Number(currentTime) || 0;
  if (!serverTimestamp) return rawTime;

  const serverAge = Math.max(0, (Date.now() - serverTimestamp) / 1000);
  return rawTime + serverAge;
};

export const usePlaylist = (socket, clientId) => {
  const [playlist, setPlaylist] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isAudioDevice, setIsAudioDevice] = useState(false);
  const [users, setUsers] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSource, setCurrentSource] = useState(null);

  const audioRef = useRef(null);
  const announcementRef = useRef(null);

  const applyPlaylist = useCallback((nextPlaylist) => {
    if (!nextPlaylist) return;

    setPlaylist(nextPlaylist);
    setUsers(nextPlaylist.users || []);
    setCurrentSong(findCurrentSong(nextPlaylist));
    setIsPlaying(Boolean(nextPlaylist.isPlaying));
    setCurrentTime(nextPlaylist.currentTime || 0);
    setCurrentSource(nextPlaylist.currentSource || null);
    setIsAudioDevice(nextPlaylist.audioClientId === clientId);
  }, [clientId]);

  const resetPlaylist = useCallback(() => {
    setPlaylist(null);
    setCurrentSong(null);
    setIsHost(false);
    setIsAudioDevice(false);
    setUsers([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentSource(null);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePlaylistState = (data) => {
      applyPlaylist(data.playlist);
      setIsHost(Boolean(data.isHost));

      if (data.playlist?.isPlaying && data.serverTimestamp) {
        setCurrentTime(getServerCorrectedTime(data.playlist.currentTime, data.serverTimestamp));
      }
    };

    const handlePlaylistUpdated = (data) => {
      applyPlaylist(data.playlist);
      if (data.playlist) {
        setIsHost(data.playlist.ownerClientId === clientId || data.playlist.ownerSocketId === socket.id);
      }
    };

    const handleSongAdded = (data) => {
      applyPlaylist(data.playlist);
    };

    const handlePlaybackStarted = (data) => {
      setIsPlaying(true);
      setCurrentTime(data.currentTime || 0);
      setCurrentSource(data.source || null);
      if (data.song) {
        setCurrentSong(data.song);
      }
    };

    const handlePlaybackPaused = (data) => {
      setIsPlaying(false);
      setCurrentTime(data.currentTime || 0);
    };

    const handlePlaybackProgress = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      } else if (data.duration && currentSong?._id === data.songId) {
        setCurrentSong((song) => song ? { ...song, duration: data.duration } : song);
      }

      setCurrentTime(getServerCorrectedTime(data.currentTime, data.serverTimestamp));
    };

    const handleSongChanged = (data) => {
      applyPlaylist(data.playlist);
      if (data.song) {
        setCurrentSong(data.song);
      }
      setIsPlaying(Boolean(data.playlist?.isPlaying ?? true));
      setCurrentTime(data.currentTime || data.playlist?.currentTime || 0);
      setCurrentSource(data.source || data.playlist?.currentSource || null);
    };

    const handlePlaybackStopped = () => {
      setCurrentSong(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentSource(null);
    };

    const handleUserJoined = (data) => {
      setUsers(data.users || []);
    };

    const handleUserLeft = (data) => {
      setUsers(data.users || []);
    };

    const handleHostChanged = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      }
      setIsHost(data.newHostClientId === clientId || socket.id === data.newHostSocketId);

      if (data.reason === 'owner-reclaim') {
        console.log('Room owner has rejoined and reclaimed host:', data.newHost);
      }
    };

    const handleAudioDeviceChanged = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      }
      setIsAudioDevice(data.audioClientId === clientId || socket.id === data.audioSocketId);
    };

    const handleAudioDeviceAssigned = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      }
      setIsAudioDevice(true);
    };

    const handleAudioDeviceRelease = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      }
      setIsAudioDevice(false);
    };

    const handleVolumeChanged = (data) => {
      if (data.playlist) {
        applyPlaylist(data.playlist);
      }
    };

    const handleLeftRoom = () => {
      resetPlaylist();
    };

    const handleError = (data) => {
      console.error('Room socket error:', data.message);
      // Only show UI error for critical messages.
      // Do not use alert() because it blocks the UI and can interrupt audio.
    };

    socket.on('playlist-state', handlePlaylistState);
    socket.on('playlist-updated', handlePlaylistUpdated);
    socket.on('song-added', handleSongAdded);
    socket.on('playback-started', handlePlaybackStarted);
    socket.on('playback-paused', handlePlaybackPaused);
    socket.on('playback-progress', handlePlaybackProgress);
    socket.on('playback-stopped', handlePlaybackStopped);
    socket.on('song-changed', handleSongChanged);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('host-changed', handleHostChanged);
    socket.on('audio-device-changed', handleAudioDeviceChanged);
    socket.on('audio-device-assigned', handleAudioDeviceAssigned);
    socket.on('audio-device-release', handleAudioDeviceRelease);
    socket.on('volume-changed', handleVolumeChanged);
    socket.on('left-room', handleLeftRoom);
    socket.on('error', handleError);

    return () => {
      socket.off('playlist-state', handlePlaylistState);
      socket.off('playlist-updated', handlePlaylistUpdated);
      socket.off('song-added', handleSongAdded);
      socket.off('playback-started', handlePlaybackStarted);
      socket.off('playback-paused', handlePlaybackPaused);
      socket.off('playback-progress', handlePlaybackProgress);
      socket.off('playback-stopped', handlePlaybackStopped);
      socket.off('song-changed', handleSongChanged);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('host-changed', handleHostChanged);
      socket.off('audio-device-changed', handleAudioDeviceChanged);
      socket.off('audio-device-assigned', handleAudioDeviceAssigned);
      socket.off('audio-device-release', handleAudioDeviceRelease);
      socket.off('volume-changed', handleVolumeChanged);
      socket.off('left-room', handleLeftRoom);
      socket.off('error', handleError);
    };
  }, [socket, clientId, applyPlaylist, resetPlaylist, currentSong?._id]);

  const playAnnouncement = async (text, youtubePlayer) => {
    if (!youtubePlayer) return;

    const safePlayerCall = (methodName, fallback, ...args) => {
      if (!youtubePlayer?.[methodName]) return fallback;
      try {
        return youtubePlayer[methodName](...args);
      } catch (error) {
        console.warn(`Announcement player ${methodName} failed:`, error);
        return fallback;
      }
    };

    try {
      const currentVolume = safePlayerCall('getVolume', 100);

      safePlayerCall('setVolume', undefined, 30);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onend = () => {
        if (youtubePlayer.setVolume) {
          const fadeBack = setInterval(() => {
            const iframe = safePlayerCall('getIframe', null);
            if (iframe && !iframe.isConnected) {
              clearInterval(fadeBack);
              return;
            }

            const currentVol = safePlayerCall('getVolume', 50);
            if (currentVol < currentVolume) {
              safePlayerCall('setVolume', undefined, Math.min(currentVolume, currentVol + 10));
            } else {
              clearInterval(fadeBack);
            }
          }, 300);
        }
      };

      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Announcement failed:', error);
      safePlayerCall('setVolume', undefined, 100);
    }
  };

  return {
    playlist,
    currentSong,
    currentSource,
    isHost,
    isAudioDevice,
    users,
    isPlaying,
    currentTime,
    audioRef,
    announcementRef,
    playAnnouncement,
    setPlaylist,
    resetPlaylist
  };
};

export default usePlaylist;
