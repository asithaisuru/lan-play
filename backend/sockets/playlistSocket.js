import {
  addOrUpdateRoomUser,
  addSong,
  clearDefaultSongs,
  createRoom,
  getFirstQueueSong,
  getNextSong,
  getOldestRoomUser,
  getPlaylistState,
  getRoom,
  getRoomUserByClientId,
  markQueueSongPlayed,
  removeRoomUser,
  removeSong,
  reorderDefaultSongs,
  setAnnouncementEnabled,
  setRoomAudioDevice,
  setRoomVolume,
  setPlayback,
  setRoomOwner,
  updateSongTiming
} from '../db/sqlite.js';
import { extractYouTubeId, getYouTubeVideoInfo } from '../utils/youtube.js';

const normalizeRoomCode = (roomCode) => String(roomCode || '').trim().toUpperCase();
const normalizeUsername = (username) => String(username || '').trim();
const normalizeClientId = (clientId) => String(clientId || '').trim();
const sendAck = (ack, payload) => {
  if (typeof ack === 'function') {
    ack(payload);
  }
};

export const initializePlaylistSocket = (io) => {
  const pendingHostReassignments = new Map();

  const emitPlaylistUpdate = (roomCode) => {
    const playlist = getPlaylistState(roomCode);
    if (playlist) {
      io.to(roomCode).emit('playlist-updated', { playlist });
    }
    return playlist;
  };

  const requireHost = (socket) => {
    const playlist = getPlaylistState(socket.roomCode);
    if (!playlist) {
      socket.emit('error', { message: 'Room not found' });
      return null;
    }

    if (playlist.ownerClientId !== socket.clientId && playlist.ownerSocketId !== socket.id) {
      socket.emit('error', { message: 'Only host can control playback' });
      return null;
    }

    return playlist;
  };

  const requireAudioDevice = (socket) => {
    const playlist = getPlaylistState(socket.roomCode);
    if (!playlist) {
      socket.emit('error', { message: 'Room not found' });
      return null;
    }

    const isHost = playlist.ownerClientId === socket.clientId || playlist.ownerSocketId === socket.id;
    const isAudioDevice = playlist.audioClientId === socket.clientId || playlist.audioSocketId === socket.id;
    if (!isHost && !isAudioDevice) {
      socket.emit('error', { message: 'Only the assigned audio device can report playback' });
      return null;
    }

    return playlist;
  };

  const changeSong = (roomCode, next, { fade = false, reason = 'next' } = {}) => {
    if (!next.song) {
      setPlayback({ roomCode, songId: null, source: null, isPlaying: false, currentTime: 0 });
      io.to(roomCode).emit('playback-stopped');
      emitPlaylistUpdate(roomCode);
      return null;
    }

    const currentTime = Number.isFinite(next.currentTime) ? Math.max(0, next.currentTime) : 0;

    setPlayback({
      roomCode,
      songId: next.song._id,
      source: next.source,
      isPlaying: true,
      currentTime,
      defaultIndex: next.defaultIndex
    });

    const playlist = emitPlaylistUpdate(roomCode);
    io.to(roomCode).emit('song-changed', {
      songId: next.song._id,
      source: next.source,
      song: next.song,
      playlist,
      currentTime,
      fade,
      reason
    });
    return playlist;
  };

  const playNextSong = (roomCode) => {
    const playlist = getPlaylistState(roomCode);
    if (!playlist) return null;
    if (playlist.currentSource === 'queue') {
      markQueueSongPlayed(playlist.currentPlaying);
    }

    const next = getNextSong({
      roomCode,
      currentSongId: playlist.currentPlaying,
      currentSource: playlist.currentSource
    });

    return changeSong(roomCode, next, {
      fade: playlist.currentSource !== next.source,
      reason: next.source === 'default' ? 'default-fallback' : 'next'
    });
  };

  const addYouTubeSong = async ({ roomCode, source, youtubeUrl, username, message = '' }) => {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const videoInfo = await getYouTubeVideoInfo(videoId);
    return addSong({
      roomCode,
      source,
      youtubeId: videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      addedBy: username,
      message
    });
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    const removeSocketFromRoom = ({ allowHostGrace = true } = {}) => {
      const removedUser = removeRoomUser(socket.id);
      if (!removedUser) return null;

      const playlist = getPlaylistState(removedUser.room_code);
      if (!playlist) return removedUser;

      if ((playlist.audioClientId === socket.clientId || playlist.audioSocketId === socket.id) && playlist.users.length > 0) {
        const replacementAudioUser = getRoomUserByClientId(removedUser.room_code, playlist.ownerClientId) || getOldestRoomUser(removedUser.room_code);
        if (replacementAudioUser) {
          setRoomAudioDevice(removedUser.room_code, replacementAudioUser.socket_id, replacementAudioUser.client_id);
          const updatedPlaylistAfterAudioChange = emitPlaylistUpdate(removedUser.room_code);
          io.to(removedUser.room_code).emit('audio-device-changed', {
            audioUsername: replacementAudioUser.username,
            audioSocketId: replacementAudioUser.socket_id,
            audioClientId: replacementAudioUser.client_id,
            playlist: updatedPlaylistAfterAudioChange
          });
        }
      }

      if ((playlist.ownerClientId === socket.clientId || playlist.ownerSocketId === socket.id) && playlist.users.length > 0) {
        const roomCode = removedUser.room_code;
        const reassignHost = () => {
          const latestPlaylist = getPlaylistState(roomCode);
          if (!latestPlaylist || latestPlaylist.ownerClientId !== socket.clientId || latestPlaylist.ownerSocketId !== socket.id) {
            pendingHostReassignments.delete(roomCode);
            return;
          }

          const oldestUser = getOldestRoomUser(roomCode);
          if (!oldestUser) {
            pendingHostReassignments.delete(roomCode);
            return;
          }

          setRoomOwner(roomCode, oldestUser.socket_id, oldestUser.client_id);
          const updatedPlaylistAfterTransfer = emitPlaylistUpdate(roomCode);

          io.to(roomCode).emit('host-changed', {
            newHost: oldestUser.username,
            newHostSocketId: oldestUser.socket_id,
            newHostClientId: oldestUser.client_id,
            playlist: updatedPlaylistAfterTransfer
          });
          pendingHostReassignments.delete(roomCode);
        };

        if (allowHostGrace) {
          const timeout = setTimeout(reassignHost, 15000);
          pendingHostReassignments.set(roomCode, timeout);
        } else {
          reassignHost();
        }
      }

      const updatedPlaylist = getPlaylistState(removedUser.room_code);
      socket.to(removedUser.room_code).emit('user-left', {
        socketId: socket.id,
        users: updatedPlaylist?.users || []
      });
      emitPlaylistUpdate(removedUser.room_code);
      socket.leave(removedUser.room_code);
      socket.roomCode = null;
      socket.username = null;

      return removedUser;
    };

    socket.on('join-room', async (data) => {
      try {
        const roomCode = normalizeRoomCode(data?.roomCode);
        const username = normalizeUsername(data?.username);
        const clientId = normalizeClientId(data?.clientId);
        const isPlayerDevice = Boolean(data?.isPlayerDevice);

        if (!roomCode || !username || !clientId) {
          socket.emit('error', { message: 'Room code, username, and client ID are required' });
          return;
        }

        let room = getRoom(roomCode);
        if (!room) {
          if (isPlayerDevice) {
            socket.emit('error', {
              message: 'Room not found. Ask the host to create a room first.'
            });
            return;
          }

          console.log(`Creating new room: ${roomCode}`);
          createRoom({ roomCode, ownerSocketId: socket.id, ownerClientId: clientId, username });
          room = getRoom(roomCode);
        }

        const existingState = getPlaylistState(roomCode);
        const shouldBackfillOwner = !isPlayerDevice && !room.owner_client_id && room.owner_socket_id === socket.id;
        const shouldBecomeHost = !isPlayerDevice
          && (
            !existingState.users.length
            || room.owner_client_id === clientId
            || shouldBackfillOwner
          );

        addOrUpdateRoomUser({ roomCode, socketId: socket.id, clientId, username, isHost: shouldBecomeHost });
        if (shouldBecomeHost) {
          const pendingReassignment = pendingHostReassignments.get(roomCode);
          if (pendingReassignment) {
            clearTimeout(pendingReassignment);
            pendingHostReassignments.delete(roomCode);
          }
          setRoomOwner(roomCode, socket.id, clientId);

          const currentAudioClientId = room.audio_client_id;
          const audioUserConnected = currentAudioClientId
            ? getRoomUserByClientId(roomCode, currentAudioClientId)
            : null;

          if (!audioUserConnected || currentAudioClientId === clientId) {
            setRoomAudioDevice(roomCode, socket.id, clientId);
          }
        }

        if (!room.audio_client_id && !room.audio_socket_id) {
          setRoomAudioDevice(roomCode, shouldBecomeHost ? socket.id : room.owner_socket_id, shouldBecomeHost ? clientId : room.owner_client_id);
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;
        socket.clientId = clientId;

        const playlist = getPlaylistState(roomCode);
        socket.emit('playlist-state', {
          playlist,
          isHost: playlist.ownerClientId === clientId || playlist.ownerSocketId === socket.id
        });

        socket.to(roomCode).emit('user-joined', {
          username,
          users: playlist.users
        });
        emitPlaylistUpdate(roomCode);

        const adapterName = io.of('/').adapter?.constructor?.name || 'unknown';
        console.log(`User ${username} joined room ${roomCode}`, {
          clientId,
          socketId: socket.id,
          adapter: adapterName
        });
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room: ' + error.message });
      }
    });

    socket.on('add-song', async (data, ack) => {
      try {
        if (!socket.roomCode) {
          const message = 'Join a room before adding songs';
          socket.emit('error', { message });
          sendAck(ack, { ok: false, message });
          return;
        }

        const username = normalizeUsername(data?.username) || socket.username || 'Guest';
        const playlistBefore = getPlaylistState(socket.roomCode);
        if (!playlistBefore) {
          const message = 'Room not found';
          socket.emit('error', { message });
          sendAck(ack, { ok: false, message });
          return;
        }

        const song = await addYouTubeSong({
          roomCode: socket.roomCode,
          source: 'queue',
          youtubeUrl: data?.youtubeUrl,
          username,
          message: String(data?.message || '').trim()
        });

        let playlist = emitPlaylistUpdate(socket.roomCode);
        io.to(socket.roomCode).emit('song-added', { song, playlist });

        const shouldInterruptDefault = playlistBefore.currentSource === 'default';
        const shouldPrimeEmptyQueue = !playlistBefore.currentPlaying;
        if (shouldInterruptDefault || shouldPrimeEmptyQueue) {
          if (shouldInterruptDefault) {
            updateSongTiming({
              roomCode: socket.roomCode,
              songId: playlistBefore.currentPlaying,
              currentTime: playlistBefore.currentTime,
              duration: playlistBefore.currentSong?.duration
            });
          }

          setPlayback({
            roomCode: socket.roomCode,
            songId: song._id,
            source: 'queue',
            isPlaying: shouldInterruptDefault ? playlistBefore.isPlaying : false,
            currentTime: 0
          });

          playlist = emitPlaylistUpdate(socket.roomCode);
          io.to(socket.roomCode).emit('song-changed', {
            songId: song._id,
            source: 'queue',
            song,
            playlist,
            fade: shouldInterruptDefault,
            reason: shouldInterruptDefault ? 'user-priority' : 'queue-primed'
          });
        }

        sendAck(ack, { ok: true, song, playlist });
        console.log(`Song added successfully by ${username} in room ${socket.roomCode}`);
      } catch (error) {
        console.error('Add song error:', error);
        socket.emit('error', { message: error.message });
        sendAck(ack, { ok: false, message: error.message });
      }
    });

    socket.on('play', (data = {}) => {
      const playlist = requireHost(socket);
      if (!playlist) return;

      let songId = data.songId || playlist.currentPlaying;
      let source = data.source || playlist.currentSource;
      let song = playlist.currentSong;

      if (!songId) {
        const firstQueueSong = getFirstQueueSong(socket.roomCode);
        if (firstQueueSong) {
          song = firstQueueSong;
          songId = firstQueueSong._id;
          source = 'queue';
        } else {
          const next = getNextSong({ roomCode: socket.roomCode, currentSongId: null, currentSource: null });
          song = next.song;
          songId = next.song?._id;
          source = next.source;
        }
      }

      if (!songId) {
        socket.emit('error', { message: 'Add a user song or default playlist song before playing' });
        return;
      }

      setPlayback({
        roomCode: socket.roomCode,
        songId,
        source,
        isPlaying: true,
        currentTime: data.currentTime || 0
      });

      const updatedPlaylist = emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-started', {
        currentTime: data.currentTime || 0,
        songId,
        source,
        song: song || updatedPlaylist.currentSong
      });
    });

    socket.on('pause', (data = {}) => {
      const playlist = requireHost(socket);
      if (!playlist) return;

      setPlayback({
        roomCode: socket.roomCode,
        songId: playlist.currentPlaying,
        source: playlist.currentSource,
        isPlaying: false,
        currentTime: data.currentTime || 0
      });

      emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-paused', {
        currentTime: data.currentTime || 0
      });
    });

    socket.on('playback-progress', (data = {}) => {
      const playlist = requireAudioDevice(socket);
      if (!playlist || !playlist.currentPlaying) return;

      const currentTime = Number(data.currentTime);
      const duration = Number(data.duration);

      updateSongTiming({
        roomCode: socket.roomCode,
        songId: playlist.currentPlaying,
        currentTime: Number.isFinite(currentTime) ? currentTime : playlist.currentTime,
        duration: Number.isFinite(duration) ? duration : playlist.currentSong?.duration
      });

      const updatedPlaylist = emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-progress', {
        songId: playlist.currentPlaying,
        currentTime: Number.isFinite(currentTime) ? currentTime : updatedPlaylist.currentTime,
        duration: Number.isFinite(duration) ? duration : updatedPlaylist.currentSong?.duration || 0,
        playlist: updatedPlaylist
      });
    });

    socket.on('next-song', (...args) => {
      const ack = args.find((arg) => typeof arg === 'function');
      const playlist = requireAudioDevice(socket);
      if (!playlist) {
        sendAck(ack, { ok: false, message: 'Only the assigned audio device can advance playback' });
        return;
      }

      try {
        const updatedPlaylist = playNextSong(socket.roomCode);
        sendAck(ack, {
          ok: true,
          playlist: updatedPlaylist,
          reason: updatedPlaylist ? 'advanced' : 'stopped'
        });
        console.log(`Next song advanced in room ${socket.roomCode}`);
      } catch (error) {
        console.error('Next song error:', error);
        socket.emit('error', { message: error.message });
        sendAck(ack, { ok: false, message: error.message });
      }
    });

    socket.on('set-announcement-enabled', (data = {}) => {
      if (!requireHost(socket)) return;
      setAnnouncementEnabled(socket.roomCode, Boolean(data.enabled));
      emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('set-volume', (data = {}) => {
      if (!requireHost(socket)) return;
      const volume = setRoomVolume(socket.roomCode, data.volume);
      const playlist = emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('volume-changed', {
        volume,
        playlist
      });
    });

    socket.on('add-default-song', async (data = {}) => {
      try {
        if (!requireHost(socket)) return;

        const song = await addYouTubeSong({
          roomCode: socket.roomCode,
          source: 'default',
          youtubeUrl: data.youtubeUrl,
          username: socket.username || 'Host'
        });

        const playlistBefore = getPlaylistState(socket.roomCode);
        const shouldPrimeDefault = !playlistBefore.currentPlaying && !playlistBefore.songs.length;
        if (shouldPrimeDefault) {
          setPlayback({
            roomCode: socket.roomCode,
            songId: song._id,
            source: 'default',
            isPlaying: false,
            currentTime: 0,
            defaultIndex: 0
          });
        }

        emitPlaylistUpdate(socket.roomCode);
      } catch (error) {
        console.error('Add default song error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('remove-default-song', (data = {}) => {
      const playlist = requireHost(socket);
      if (!playlist) return;

      removeSong({ roomCode: socket.roomCode, source: 'default', songId: data.songId });
      if (playlist.currentPlaying === data.songId && playlist.currentSource === 'default') {
        playNextSong(socket.roomCode);
      } else {
        emitPlaylistUpdate(socket.roomCode);
      }
    });

    socket.on('reorder-default-songs', (data = {}) => {
      if (!requireHost(socket)) return;
      reorderDefaultSongs(socket.roomCode, Array.isArray(data.songIds) ? data.songIds : []);
      emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('clear-default-playlist', () => {
      if (!requireHost(socket)) return;
      clearDefaultSongs(socket.roomCode);
      emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('transfer-host', (data = {}) => {
      const playlist = requireHost(socket);
      if (!playlist) return;

      const targetClientId = normalizeClientId(data.targetClientId);
      const targetUser = getRoomUserByClientId(socket.roomCode, targetClientId);
      if (!targetUser) {
        socket.emit('error', { message: 'Selected user is not connected to this room' });
        return;
      }

      setRoomOwner(socket.roomCode, targetUser.socket_id, targetUser.client_id);
      const updatedPlaylist = emitPlaylistUpdate(socket.roomCode);

      io.to(socket.roomCode).emit('host-changed', {
        newHost: targetUser.username,
        newHostSocketId: targetUser.socket_id,
        newHostClientId: targetUser.client_id,
        playlist: updatedPlaylist
      });
    });

    socket.on('set-audio-device', (data = {}) => {
      const playlist = requireHost(socket);
      if (!playlist) return;

      const targetClientId = normalizeClientId(data.targetClientId);
      const targetUser = getRoomUserByClientId(socket.roomCode, targetClientId);
      if (!targetUser) {
        socket.emit('error', { message: 'Selected audio device is not connected to this room' });
        return;
      }

      const previousAudioSocketId = playlist.audioSocketId;
      const previousAudioClientId = playlist.audioClientId;
      if (previousAudioClientId === targetUser.client_id || previousAudioSocketId === targetUser.socket_id) {
        socket.emit('audio-device-changed', {
          audioUsername: targetUser.username,
          audioSocketId: targetUser.socket_id,
          audioClientId: targetUser.client_id,
          playlist
        });
        return;
      }

      setRoomAudioDevice(socket.roomCode, targetUser.socket_id, targetUser.client_id);
      const updatedPlaylist = emitPlaylistUpdate(socket.roomCode);

      if (previousAudioSocketId) {
        io.to(previousAudioSocketId).emit('audio-device-release', {
          playlist: updatedPlaylist
        });
      }

      io.to(targetUser.socket_id).emit('audio-device-assigned', {
        audioUsername: targetUser.username,
        audioSocketId: targetUser.socket_id,
        audioClientId: targetUser.client_id,
        playlist: updatedPlaylist
      });

      io.to(socket.roomCode).emit('audio-device-changed', {
        audioUsername: targetUser.username,
        audioSocketId: targetUser.socket_id,
        audioClientId: targetUser.client_id,
        playlist: updatedPlaylist
      });
    });

    socket.on('leave-room', () => {
      try {
        removeSocketFromRoom({ allowHostGrace: false });
        socket.emit('left-room');
      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    socket.on('disconnect', () => {
      try {
        console.log('User disconnected:', socket.id);
        removeSocketFromRoom({ allowHostGrace: true });
      } catch (error) {
        console.error('Disconnection error:', error);
      }
    });
  });
};
