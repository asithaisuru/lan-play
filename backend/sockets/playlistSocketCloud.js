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
  updateSongTiming,
  pool
} from '../db/postgres.js';
import {
  checkGuestLimit,
  checkQueueLimit,
  checkSessionExpiry,
  getRoomWithTier,
  getTierLimits
} from '../middleware/tierEnforce.js';
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

  const emitPlaylistUpdate = async (roomCode) => {
    const playlist = await getPlaylistState(roomCode);
    if (playlist) {
      io.to(roomCode).emit('playlist-updated', { playlist });
    }
    return playlist;
  };

  const requireHost = async (socket) => {
    const playlist = await getPlaylistState(socket.roomCode);
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

  const requireAudioDevice = async (socket) => {
    const playlist = await getPlaylistState(socket.roomCode);
    if (!playlist) {
      socket.emit('error', { message: 'Room not found' });
      return null;
    }

    const isHost = playlist.ownerClientId === socket.clientId || playlist.ownerSocketId === socket.id;
    const isAudioDevice = playlist.audioClientId === socket.clientId || playlist.audioSocketId === socket.id;

    if (!isHost && !isAudioDevice) {
      socket.emit('error', { message: 'Only the assigned audio device can advance playback' });
      return null;
    }

    return playlist;
  };

  const changeSong = async (roomCode, next, { fade = false, reason = 'next' } = {}) => {
    if (!next.song) {
      await setPlayback({ roomCode, songId: null, source: null, isPlaying: false, currentTime: 0 });
      io.to(roomCode).emit('playback-stopped');
      await emitPlaylistUpdate(roomCode);
      return null;
    }

    const currentTime = Number.isFinite(next.currentTime) ? Math.max(0, next.currentTime) : 0;

    await setPlayback({
      roomCode,
      songId: next.song._id,
      source: next.source,
      isPlaying: true,
      currentTime,
      defaultIndex: next.defaultIndex
    });

    const playlist = await emitPlaylistUpdate(roomCode);
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

  const playNextSong = async (roomCode) => {
    const expired = await checkSessionExpiry(roomCode);
    if (expired) {
      await pool.query(
        `UPDATE rooms
         SET status = 'ended',
             ended_at = NOW(),
             updated_at = NOW(),
             last_activity = NOW()
         WHERE room_code = $1::text`,
        [roomCode]
      );
      io.to(roomCode).emit('session-ended', {
        message: 'Your 2-hour free session has ended. Upgrade to Pro for unlimited sessions.',
        code: 'SESSION_EXPIRED'
      });
      return null;
    }

    const roomData = await getRoomWithTier(roomCode);
    const tier = roomData?.host_tier || roomData?.tier || 'free';
    const limits = getTierLimits(tier);
    const playlist = await getPlaylistState(roomCode);
    if (!playlist) return null;
    if (playlist.currentSource === 'queue') {
      await markQueueSongPlayed(playlist.currentPlaying);
    }

    const next = await getNextSong({
      roomCode,
      currentSongId: playlist.currentPlaying,
      currentSource: playlist.currentSource
    });

    if (limits.ads && next.song) {
      io.to(roomCode).emit('ad-start', {
        duration: 10,
        skippableAfter: 5,
        ad: {
          title: 'KRODOT - Crown of Technology',
          description: 'Enjoying the music? Upgrade to Pro for ad-free sessions.',
          url: 'https://waveio.app/pricing',
          logo: '/waveio-logo.svg'
        }
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 10000);
      });
      io.to(roomCode).emit('ad-end');
    }

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

    const removeSocketFromRoom = async ({ allowHostGrace = true } = {}) => {
      const removedUser = await removeRoomUser(socket.id);
      if (!removedUser) return null;

      const playlist = await getPlaylistState(removedUser.room_code);
      if (!playlist) return removedUser;

      if ((playlist.audioClientId === socket.clientId || playlist.audioSocketId === socket.id) && playlist.users.length > 0) {
        const replacementAudioUser = await getRoomUserByClientId(removedUser.room_code, playlist.ownerClientId)
          || await getOldestRoomUser(removedUser.room_code);
        if (replacementAudioUser) {
          await setRoomAudioDevice(removedUser.room_code, replacementAudioUser.socket_id, replacementAudioUser.client_id);
          const updatedPlaylistAfterAudioChange = await emitPlaylistUpdate(removedUser.room_code);
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
        const reassignHost = async () => {
          const latestPlaylist = await getPlaylistState(roomCode);
          if (!latestPlaylist || latestPlaylist.ownerClientId !== socket.clientId || latestPlaylist.ownerSocketId !== socket.id) {
            pendingHostReassignments.delete(roomCode);
            return;
          }

          const oldestUser = await getOldestRoomUser(roomCode);
          if (!oldestUser) {
            pendingHostReassignments.delete(roomCode);
            return;
          }

          await setRoomOwner(roomCode, oldestUser.socket_id, oldestUser.client_id);
          const updatedPlaylistAfterTransfer = await emitPlaylistUpdate(roomCode);

          io.to(roomCode).emit('host-changed', {
            newHost: oldestUser.username,
            newHostSocketId: oldestUser.socket_id,
            newHostClientId: oldestUser.client_id,
            playlist: updatedPlaylistAfterTransfer
          });
          pendingHostReassignments.delete(roomCode);
        };

        if (allowHostGrace) {
          const timeout = setTimeout(() => {
            reassignHost().catch((error) => {
              console.error('Host reassignment error:', error);
              pendingHostReassignments.delete(roomCode);
            });
          }, 15000);
          pendingHostReassignments.set(roomCode, timeout);
        } else {
          await reassignHost();
        }
      }

      const updatedPlaylist = await getPlaylistState(removedUser.room_code);
      socket.to(removedUser.room_code).emit('user-left', {
        socketId: socket.id,
        users: updatedPlaylist?.users || []
      });
      await emitPlaylistUpdate(removedUser.room_code);
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

        let room = await getRoom(roomCode);
        if (!room) {
          if (isPlayerDevice) {
            socket.emit('error', {
              message: 'Room not found. Ask the host to create a room first.'
            });
            return;
          }

          console.log(`Creating new room: ${roomCode}`);
          await createRoom({ roomCode, ownerSocketId: socket.id, ownerClientId: clientId, username });
          room = await getRoom(roomCode);
        }

        const existingState = await getPlaylistState(roomCode);
        const shouldBackfillOwner = !isPlayerDevice && !room.owner_client_id && room.owner_socket_id === socket.id;
        const shouldBecomeHost = !isPlayerDevice
          && (
            !existingState.users.length
            || room.owner_client_id === clientId
            || shouldBackfillOwner
          );

        const roomWithTier = await getRoomWithTier(roomCode);
        const roomTier = roomWithTier?.host_tier || roomWithTier?.tier || room.tier || 'free';
        const limits = getTierLimits(roomTier);
        const expired = await checkSessionExpiry(roomCode);
        if (expired) {
          await pool.query(
            `UPDATE rooms
             SET status = 'ended',
                 ended_at = NOW(),
                 updated_at = NOW(),
                 last_activity = NOW()
             WHERE room_code = $1::text`,
            [roomCode]
          );
          socket.emit('error', {
            message: 'This session has ended. The host needs to start a new room.',
            code: 'SESSION_EXPIRED'
          });
          return;
        }

        if (!shouldBecomeHost && !isPlayerDevice) {
          const withinLimit = await checkGuestLimit(roomCode, roomTier);
          if (!withinLimit) {
            socket.emit('error', {
              message: `This room is full (${limits.maxGuests} guest limit on free tier). Ask the host to upgrade to Pro for unlimited guests.`,
              code: 'GUEST_LIMIT_REACHED'
            });
            return;
          }
        }

        await addOrUpdateRoomUser({ roomCode, socketId: socket.id, clientId, username, isHost: shouldBecomeHost });
        let audioDeviceAssignedOnJoin = false;
        if (shouldBecomeHost) {
          const pendingReassignment = pendingHostReassignments.get(roomCode);
          if (pendingReassignment) {
            clearTimeout(pendingReassignment);
            pendingHostReassignments.delete(roomCode);
          }
          await setRoomOwner(roomCode, socket.id, clientId);

          const currentAudioClientId = room.audio_client_id;
          const isAudioSelf = currentAudioClientId === clientId;

          if (!currentAudioClientId || isAudioSelf) {
            await setRoomAudioDevice(roomCode, socket.id, clientId);
            audioDeviceAssignedOnJoin = true;
            console.log('Auto-assigned host as audio device:', clientId);
          } else {
            const audioUserConnected = await getRoomUserByClientId(roomCode, currentAudioClientId);
            if (!audioUserConnected) {
              await setRoomAudioDevice(roomCode, socket.id, clientId);
              audioDeviceAssignedOnJoin = true;
              console.log('Reassigned audio device to host:', clientId);
            }
          }
        }

        if (!audioDeviceAssignedOnJoin && !room.audio_client_id && !room.audio_socket_id) {
          await setRoomAudioDevice(roomCode, shouldBecomeHost ? socket.id : room.owner_socket_id, shouldBecomeHost ? clientId : room.owner_client_id);
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;
        socket.clientId = clientId;

        const playlist = await getPlaylistState(roomCode);
        socket.emit('playlist-state', {
          playlist,
          isHost: playlist.ownerClientId === clientId || playlist.ownerSocketId === socket.id,
          serverTimestamp: Date.now()
        });

        socket.to(roomCode).emit('user-joined', {
          username,
          users: playlist.users
        });
        await emitPlaylistUpdate(roomCode);

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
        const playlistBefore = await getPlaylistState(socket.roomCode);
        if (!playlistBefore) {
          const message = 'Room not found';
          socket.emit('error', { message });
          sendAck(ack, { ok: false, message });
          return;
        }

        const roomForQueue = await getRoomWithTier(socket.roomCode);
        const queueTier = roomForQueue?.host_tier || roomForQueue?.tier || 'free';
        const withinQueueLimit = await checkQueueLimit(socket.roomCode, queueTier);
        if (!withinQueueLimit) {
          const message = 'Queue is full (30 songs on free tier). The host needs to upgrade to Pro for unlimited queue.';
          socket.emit('error', {
            message,
            code: 'QUEUE_LIMIT_REACHED'
          });
          sendAck(ack, { ok: false, message, code: 'QUEUE_LIMIT_REACHED' });
          return;
        }

        const song = await addYouTubeSong({
          roomCode: socket.roomCode,
          source: 'queue',
          youtubeUrl: data?.youtubeUrl,
          username,
          message: String(data?.message || '').trim()
        });

        let playlist = await emitPlaylistUpdate(socket.roomCode);
        io.to(socket.roomCode).emit('song-added', { song, playlist });

        const shouldInterruptDefault = playlistBefore.currentSource === 'default';
        const shouldPrimeEmptyQueue = !playlistBefore.currentPlaying;
        if (shouldInterruptDefault || shouldPrimeEmptyQueue) {
          if (shouldInterruptDefault) {
            await updateSongTiming({
              roomCode: socket.roomCode,
              songId: playlistBefore.currentPlaying,
              currentTime: playlistBefore.currentPosition ?? 0,
              duration: playlistBefore.currentSong?.duration
            });
          }

          await setPlayback({
            roomCode: socket.roomCode,
            songId: song._id,
            source: 'queue',
            isPlaying: shouldInterruptDefault ? playlistBefore.isPlaying : false,
            currentTime: 0
          });

          playlist = await emitPlaylistUpdate(socket.roomCode);
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

    socket.on('play', async (data = {}) => {
      const playlist = await requireHost(socket);
      if (!playlist) return;

      let songId = data.songId || playlist.currentPlaying;
      let source = data.source || playlist.currentSource;
      let song = playlist.currentSong;

      if (!songId) {
        const firstQueueSong = await getFirstQueueSong(socket.roomCode);
        if (firstQueueSong) {
          song = firstQueueSong;
          songId = firstQueueSong._id;
          source = 'queue';
        } else {
          const next = await getNextSong({ roomCode: socket.roomCode, currentSongId: null, currentSource: null });
          song = next.song;
          songId = next.song?._id;
          source = next.source;
        }
      }

      if (!songId) {
        socket.emit('error', { message: 'Add a user song or default playlist song before playing' });
        return;
      }

      await setPlayback({
        roomCode: socket.roomCode,
        songId,
        source,
        isPlaying: true,
        currentTime: data.currentTime || 0
      });

      const updatedPlaylist = await emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-started', {
        currentTime: data.currentTime || 0,
        songId,
        source,
        song: song || updatedPlaylist.currentSong
      });
    });

    socket.on('pause', async (data = {}) => {
      const playlist = await requireHost(socket);
      if (!playlist) return;

      await setPlayback({
        roomCode: socket.roomCode,
        songId: playlist.currentPlaying,
        source: playlist.currentSource,
        isPlaying: false,
        currentTime: data.currentTime || 0
      });

      await emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-paused', {
        currentTime: data.currentTime || 0
      });
    });

    socket.on('playback-progress', async (data = {}) => {
      const playlist = await requireAudioDevice(socket);
      if (!playlist || !playlist.currentPlaying) return;

      const currentTime = Number(data.currentTime);
      const duration = Number(data.duration);

      await updateSongTiming({
        roomCode: socket.roomCode,
        songId: playlist.currentPlaying,
        currentTime: Number.isFinite(currentTime) ? currentTime : (playlist.currentPosition ?? 0),
        duration: Number.isFinite(duration) ? duration : playlist.currentSong?.duration
      });

      const updatedPlaylist = await emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('playback-progress', {
        songId: playlist.currentPlaying,
        currentTime: Number.isFinite(currentTime) ? currentTime : (updatedPlaylist.currentPosition ?? 0),
        duration: Number.isFinite(duration) ? duration : updatedPlaylist.currentSong?.duration || 0,
        playlist: updatedPlaylist,
        serverTimestamp: Date.now()
      });
    });

    socket.on('next-song', async (...args) => {
      const ack = args.find((arg) => typeof arg === 'function');
      const playlist = await requireAudioDevice(socket);
      if (!playlist) {
        sendAck(ack, { ok: false, message: 'Only the assigned audio device can advance playback' });
        return;
      }

      try {
        const updatedPlaylist = await playNextSong(socket.roomCode);
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

    socket.on('set-announcement-enabled', async (data = {}) => {
      if (!(await requireHost(socket))) return;
      await setAnnouncementEnabled(socket.roomCode, Boolean(data.enabled));
      await emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('set-volume', async (data = {}) => {
      if (!(await requireHost(socket))) return;
      const volume = await setRoomVolume(socket.roomCode, data.volume);
      const playlist = await emitPlaylistUpdate(socket.roomCode);
      io.to(socket.roomCode).emit('volume-changed', {
        volume,
        playlist
      });
    });

    socket.on('add-default-song', async (data = {}) => {
      try {
        if (!(await requireHost(socket))) return;

        const song = await addYouTubeSong({
          roomCode: socket.roomCode,
          source: 'default',
          youtubeUrl: data.youtubeUrl,
          username: socket.username || 'Host'
        });

        const playlistBefore = await getPlaylistState(socket.roomCode);
        const shouldPrimeDefault = !playlistBefore.currentPlaying && !playlistBefore.songs.length;
        if (shouldPrimeDefault) {
          await setPlayback({
            roomCode: socket.roomCode,
            songId: song._id,
            source: 'default',
            isPlaying: false,
            currentTime: 0,
            defaultIndex: 0
          });
        }

        await emitPlaylistUpdate(socket.roomCode);
      } catch (error) {
        console.error('Add default song error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('remove-default-song', async (data = {}) => {
      const playlist = await requireHost(socket);
      if (!playlist) return;

      await removeSong({ roomCode: socket.roomCode, source: 'default', songId: data.songId });
      if (playlist.currentPlaying === data.songId && playlist.currentSource === 'default') {
        await playNextSong(socket.roomCode);
      } else {
        await emitPlaylistUpdate(socket.roomCode);
      }
    });

    socket.on('reorder-default-songs', async (data = {}) => {
      if (!(await requireHost(socket))) return;
      await reorderDefaultSongs(socket.roomCode, Array.isArray(data.songIds) ? data.songIds : []);
      await emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('clear-default-playlist', async () => {
      if (!(await requireHost(socket))) return;
      await clearDefaultSongs(socket.roomCode);
      await emitPlaylistUpdate(socket.roomCode);
    });

    socket.on('transfer-host', async (data = {}) => {
      const playlist = await requireHost(socket);
      if (!playlist) return;

      const targetClientId = normalizeClientId(data.targetClientId);
      const targetUser = await getRoomUserByClientId(socket.roomCode, targetClientId);
      if (!targetUser) {
        socket.emit('error', { message: 'Selected user is not connected to this room' });
        return;
      }

      await setRoomOwner(socket.roomCode, targetUser.socket_id, targetUser.client_id);
      const updatedPlaylist = await emitPlaylistUpdate(socket.roomCode);

      io.to(socket.roomCode).emit('host-changed', {
        newHost: targetUser.username,
        newHostSocketId: targetUser.socket_id,
        newHostClientId: targetUser.client_id,
        playlist: updatedPlaylist
      });
    });

    socket.on('set-audio-device', async (data = {}) => {
      const playlist = await requireHost(socket);
      if (!playlist) return;

      const targetClientId = normalizeClientId(data.targetClientId);
      const targetUser = await getRoomUserByClientId(socket.roomCode, targetClientId);
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

      await setRoomAudioDevice(socket.roomCode, targetUser.socket_id, targetUser.client_id);
      const updatedPlaylist = await emitPlaylistUpdate(socket.roomCode);

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

    socket.on('ad-skipped', () => {
      // Client-side skip only hides the overlay; server keeps the ad break timing authoritative.
    });

    socket.on('leave-room', async () => {
      try {
        await removeSocketFromRoom({ allowHostGrace: false });
        socket.emit('left-room');
      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    socket.on('disconnect', async () => {
      try {
        console.log('User disconnected:', socket.id);
        await removeSocketFromRoom({ allowHostGrace: true });
      } catch (error) {
        console.error('Disconnection error:', error);
      }
    });
  });
};
