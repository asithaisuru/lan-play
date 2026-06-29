import api from './api';

export const getPublicPlaylists = (filters) => (
  api.get('/playlists', { params: filters })
);

export const getMyPlaylists = () => (
  api.get('/playlists', {
    params: { hostId: 'me', isPublic: false }
  })
);

export const getPlaylist = (id) => (
  api.get(`/playlists/${id}`)
);

export const createPlaylist = (data) => (
  api.post('/playlists', data)
);

export const updatePlaylist = (id, data) => (
  api.put(`/playlists/${id}`, data)
);

export const deletePlaylist = (id) => (
  api.delete(`/playlists/${id}`)
);

export const addSongToPlaylist = (id, song) => (
  api.post(`/playlists/${id}/songs`, song)
);

export const removeSongFromPlaylist = (id, songId) => (
  api.delete(`/playlists/${id}/songs/${songId}`)
);

export const addPlaylistToRoom = (id, roomCode) => (
  api.post(`/playlists/${id}/add-to-room`, { roomCode })
);
