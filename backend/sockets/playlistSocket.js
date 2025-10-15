import Playlist from '../models/Playlist.js';
import { extractYouTubeId, getYouTubeVideoInfo } from '../utils/youtube.js';

export const initializePlaylistSocket = (io) => {
  
  // Helper functions that need access to io
  const playNextSong = async (playlist, roomCode) => {
    const currentIndex = playlist.songs.findIndex(song => 
      song._id.toString() === playlist.currentPlaying?.toString()
    );
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < playlist.songs.length) {
      playlist.currentPlaying = playlist.songs[nextIndex]._id;
      playlist.isPlaying = true;
      playlist.currentTime = 0;
      
      io.to(roomCode).emit('song-changed', {
        songId: playlist.currentPlaying,
        playlist: playlist
      });
    } else {
      playlist.currentPlaying = null;
      playlist.isPlaying = false;
      playlist.currentTime = 0;
      
      io.to(roomCode).emit('playback-stopped');
    }
  };

  const handleHostAction = async (socket, action, data = {}) => {
    try {
      const playlist = await Playlist.findOne({ roomCode: socket.roomCode });
      
      if (!playlist) {
        socket.emit('error', { message: 'Room not found' });
        return null;
      }
      
      if (playlist.ownerSocketId !== socket.id) {
        socket.emit('error', { message: 'Only host can control playback' });
        return null;
      }
      
      switch (action) {
        case 'play':
          playlist.isPlaying = true;
          playlist.currentTime = data.currentTime || 0;
          if (data.songId) {
            playlist.currentPlaying = data.songId;
          }
          io.to(socket.roomCode).emit('playback-started', {
            currentTime: playlist.currentTime,
            songId: playlist.currentPlaying
          });
          break;
        case 'pause':
          playlist.isPlaying = false;
          playlist.currentTime = data.currentTime || 0;
          io.to(socket.roomCode).emit('playback-paused', {
            currentTime: playlist.currentTime
          });
          break;
        case 'next':
          await playNextSong(playlist, socket.roomCode);
          break;
      }
      
      playlist.lastActivity = new Date();
      await playlist.save();
      return playlist;
    } catch (error) {
      console.error('Host action error:', error);
      socket.emit('error', { message: 'Action failed' });
      return null;
    }
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', async (data) => {
      try {
        const { roomCode, username } = data;
        console.log(`User ${username} joining room: ${roomCode}`);
        
        let playlist = await Playlist.findOne({ roomCode });
        
        if (!playlist) {
          // Create new room
          console.log(`Creating new room: ${roomCode}`);
          playlist = new Playlist({
            roomCode,
            ownerSocketId: socket.id,
            playlistName: `${username}'s Playlist`,
            users: [{
              socketId: socket.id,
              username,
              joinedAt: new Date(),
              isHost: true
            }]
          });
          await playlist.save();
          console.log(`Room ${roomCode} created successfully`);
        } else {
          // Join existing room
          console.log(`Joining existing room: ${roomCode}`);
          const userExists = playlist.users.some(user => user.socketId === socket.id);
          if (!userExists) {
            playlist.users.push({
              socketId: socket.id,
              username,
              joinedAt: new Date(),
              isHost: false
            });
            await playlist.save();
          }
        }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        // Send current playlist state to new user
        const playlistData = await Playlist.findOne({ roomCode });
        socket.emit('playlist-state', {
          playlist: playlistData,
          isHost: playlistData.ownerSocketId === socket.id
        });
        
        // Notify others in the room
        socket.to(roomCode).emit('user-joined', {
          username,
          users: playlistData.users
        });
        
        console.log(`User ${username} successfully joined room ${roomCode}`);
        
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room: ' + error.message });
      }
    });

    // Add song to playlist
    socket.on('add-song', async (data) => {
      try {
        const { youtubeUrl, username, message } = data;
        console.log(`Adding song from ${username}: ${youtubeUrl}`);
        
        const playlist = await Playlist.findOne({ roomCode: socket.roomCode });
        
        if (!playlist) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Extract YouTube ID and get video info
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
          socket.emit('error', { message: 'Invalid YouTube URL' });
          return;
        }
        
        const videoInfo = await getYouTubeVideoInfo(videoId);
        const songData = {
          youtubeId: videoId,
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          duration: videoInfo.duration,
          addedBy: username,
          message: message,
          addedAt: new Date()
        };
        
        playlist.songs.push(songData);
        playlist.lastActivity = new Date();
        await playlist.save();
        
        // Get updated playlist
        const updatedPlaylist = await Playlist.findOne({ roomCode: socket.roomCode });
        
        io.to(socket.roomCode).emit('song-added', {
          song: songData,
          playlist: updatedPlaylist
        });
        
        console.log(`Song added successfully by ${username}`);
        
      } catch (error) {
        console.error('Add song error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Host controls
    socket.on('play', async (data) => {
      await handleHostAction(socket, 'play', data);
    });

    socket.on('pause', async (data) => {
      await handleHostAction(socket, 'pause', data);
    });

    socket.on('next-song', async () => {
      await handleHostAction(socket, 'next');
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        console.log('User disconnected:', socket.id);
        const playlist = await Playlist.findOne({ roomCode: socket.roomCode });
        if (playlist) {
          // Remove user
          playlist.users = playlist.users.filter(user => user.socketId !== socket.id);
          
          // If host disconnected, assign new host (oldest user)
          if (playlist.ownerSocketId === socket.id && playlist.users.length > 0) {
            const oldestUser = playlist.users.reduce((oldest, user) => 
              user.joinedAt < oldest.joinedAt ? user : oldest
            );
            playlist.ownerSocketId = oldestUser.socketId;
            
            io.to(socket.roomCode).emit('host-changed', {
              newHost: oldestUser.username,
              newHostSocketId: oldestUser.socketId
            });
          }
          
          playlist.lastActivity = new Date();
          await playlist.save();
          
          socket.to(socket.roomCode).emit('user-left', {
            socketId: socket.id,
            users: playlist.users
          });
        }
      } catch (error) {
        console.error('Disconnection error:', error);
      }
    });
  });
};