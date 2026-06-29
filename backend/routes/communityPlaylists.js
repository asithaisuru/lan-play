import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import {
  addSongToCommunityPlaylist,
  appendToRoomDefaultPlaylist,
  createCommunityPlaylist,
  deleteCommunityPlaylist,
  getCommunityPlaylist,
  getCommunityPlaylists,
  removeSongFromCommunityPlaylist,
  updateCommunityPlaylist
} from '../db/communityPlaylists.js';

const router = express.Router();

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true';
};

const parseTags = (value) => {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
};

const validateTags = (tags) => (
  Array.isArray(tags)
  && tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0)
);

const getAuthUser = async (req) => {
  const token = req.cookies?.waveio_token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, email, name, avatar, tier, spotify_connected
       FROM users WHERE id = $1::uuid`,
      [decoded.id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
};

const sendError = (res, error, fallback = 'Request failed') => {
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || fallback });
};

router.get('/', async (req, res) => {
  try {
    const wantsMine = req.query.hostId === 'me';
    const isPublic = parseBoolean(req.query.isPublic, true);
    const user = await getAuthUser(req);

    if ((wantsMine || !isPublic) && !user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const playlists = await getCommunityPlaylists({
      isPublic,
      hostId: wantsMine || !isPublic ? user.id : null,
      minSongs: Number(req.query.minSongs) || 0,
      minDuration: Number(req.query.minDuration) || 0,
      tags: parseTags(req.query.tags ?? req.query['tags[]']),
      search: String(req.query.search || ''),
      sortBy: String(req.query.sortBy || 'newest'),
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0
    });

    return res.json({ playlists });
  } catch (error) {
    return sendError(res, error, 'Could not load playlists');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const playlist = await getCommunityPlaylist(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (!playlist.isPublic) {
      const user = await getAuthUser(req);
      if (!user || user.id !== playlist.hostId) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
    }

    const user = await getAuthUser(req);
    return res.json({
      playlist: {
        ...playlist,
        isOwner: Boolean(user && user.id === playlist.hostId)
      }
    });
  } catch (error) {
    return sendError(res, error, 'Could not load playlist');
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const tags = req.body?.tags || [];

    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    if (!validateTags(tags)) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }

    const playlist = await createCommunityPlaylist({
      hostId: req.user.id,
      name,
      description,
      tags: tags.map((tag) => tag.trim()),
      isPublic: Boolean(req.body?.isPublic)
    });

    return res.status(201).json({ playlist });
  } catch (error) {
    return sendError(res, error, 'Could not create playlist');
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const tags = req.body?.tags || [];

    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    if (!validateTags(tags)) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }

    const playlist = await updateCommunityPlaylist({
      playlistId: req.params.id,
      hostId: req.user.id,
      name,
      description,
      tags: tags.map((tag) => tag.trim()),
      isPublic: Boolean(req.body?.isPublic)
    });

    return res.json({ playlist });
  } catch (error) {
    return sendError(res, error, 'Could not update playlist');
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await deleteCommunityPlaylist({
      playlistId: req.params.id,
      hostId: req.user.id
    });

    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, 'Could not delete playlist');
  }
});

router.post('/:id/songs', requireAuth, async (req, res) => {
  try {
    const youtubeId = String(req.body?.youtubeId || '').trim();
    const title = String(req.body?.title || '').trim();
    const thumbnail = String(req.body?.thumbnail || '').trim();
    const duration = Number(req.body?.duration) || 0;

    if (!youtubeId || !title) {
      return res.status(400).json({ error: 'YouTube ID and title are required' });
    }

    const playlist = await addSongToCommunityPlaylist({
      playlistId: req.params.id,
      hostId: req.user.id,
      youtubeId,
      title,
      thumbnail,
      duration
    });

    return res.status(201).json({ playlist });
  } catch (error) {
    return sendError(res, error, 'Could not add song');
  }
});

router.delete('/:id/songs/:songId', requireAuth, async (req, res) => {
  try {
    const playlist = await removeSongFromCommunityPlaylist({
      playlistId: req.params.id,
      songId: req.params.songId,
      hostId: req.user.id
    });

    return res.json({ playlist });
  } catch (error) {
    return sendError(res, error, 'Could not remove song');
  }
});

router.post('/:id/add-to-room', requireAuth, async (req, res) => {
  try {
    const roomCode = String(req.body?.roomCode || '').trim().toUpperCase();
    if (!roomCode) {
      return res.status(400).json({ error: 'Room code is required' });
    }

    const result = await appendToRoomDefaultPlaylist({
      playlistId: req.params.id,
      roomCode,
      hostId: req.user.id
    });

    return res.json({
      songsAdded: result.count,
      roomName: result.roomName
    });
  } catch (error) {
    return sendError(res, error, 'Could not add playlist to room');
  }
});

export default router;
