import express from 'express';
import { pool, createRoom } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { getTierLimits } from '../middleware/tierEnforce.js';

const router = express.Router();
const codeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const mapRoom = (row) => row ? ({
  roomCode: row.room_code,
  name: row.playlist_name,
  playlistName: row.playlist_name,
  createdBy: row.created_by,
  currentSongId: row.current_song_id,
  currentSource: row.current_source,
  isPlaying: Boolean(row.is_playing),
  currentPosition: Number(row.current_position) || 0,
  currentTime: Number(row.current_position) || 0,
  defaultSongCount: Number(row.default_song_count) || 0,
  volume: Number(row.volume) || 100,
  announcementEnabled: Boolean(row.announcement_enabled),
  defaultIndex: Number(row.default_index) || 0,
  hostId: row.host_id,
  tier: row.tier,
  status: row.status,
  expiresAt: row.expires_at,
  endedAt: row.ended_at,
  customBrandName: row.custom_brand_name,
  customBrandLogo: row.custom_brand_logo,
  customBrandMessage: row.custom_brand_message,
  customBrandColor: row.custom_brand_color || '#C9A84C',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastActivity: row.last_activity
}) : null;

const generateCandidateCode = () => {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += codeCharacters[Math.floor(Math.random() * codeCharacters.length)];
  }
  return code;
};

const generateRoomCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateCandidateCode();
    const { rows } = await pool.query('SELECT room_code FROM rooms WHERE room_code = $1', [code]);
    if (!rows[0]) return code;
  }

  throw new Error('Could not generate a unique room code.');
};

router.get('/public/:code', async (req, res) => {
  const roomCode = String(req.params.code || '').trim().toUpperCase();

  try {
    if ((process.env.DB_MODE || 'sqlite') !== 'postgres') {
      return res.json({
        room: {
          roomCode,
          room_code: roomCode,
          name: `Room ${roomCode}`,
          playlistName: `Room ${roomCode}`,
          playlist_name: `Room ${roomCode}`,
          status: 'active',
          tier: 'lan',
          hostTier: 'lan',
          host_tier: 'lan',
          branding: null
        }
      });
    }

    const { rows } = await pool.query(
      `SELECT
         r.room_code,
         r.playlist_name,
         r.status,
         r.tier,
         r.expires_at,
         r.custom_brand_name,
         r.custom_brand_logo,
         r.custom_brand_message,
         r.custom_brand_color,
         u.name AS host_name,
         u.tier AS host_tier
       FROM rooms r
       JOIN users u ON u.id = r.host_id
       WHERE r.room_code = $1::text
         AND r.status = 'active'`,
      [roomCode]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Room not found or has ended' });
    }

    const room = rows[0];
    return res.json({
      room: {
        ...room,
        roomCode: room.room_code,
        playlistName: room.playlist_name,
        name: room.playlist_name,
        expiresAt: room.expires_at,
        customBrandName: room.custom_brand_name,
        customBrandLogo: room.custom_brand_logo,
        customBrandMessage: room.custom_brand_message,
        customBrandColor: room.custom_brand_color || '#C9A84C',
        hostName: room.host_name,
        hostTier: room.host_tier
      }
    });
  } catch (error) {
    console.error('Fetch public room error:', error);
    return res.status(500).json({ error: 'Failed to fetch room info' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT rooms.*,
            (
              SELECT COUNT(*)::int
              FROM songs
              WHERE songs.room_code = rooms.room_code
                AND songs.source = 'default'
            ) AS default_song_count
     FROM rooms
     WHERE rooms.host_id = $1 AND rooms.status = 'active'
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  return res.json({ rooms: rows.map(mapRoom) });
});

router.post('/', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const tier = req.user.tier || 'free';
  const limits = getTierLimits(tier);
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM rooms
     WHERE host_id = $1::uuid
       AND status = 'active'`,
    [req.user.id]
  );

  if (Number(countRows[0].count) >= limits.maxRooms) {
    return res.status(403).json({
      error: `Your ${tier} plan allows ${limits.maxRooms} active room(s). Upgrade to create more.`,
      code: 'ROOM_LIMIT_REACHED'
    });
  }

  const roomCode = await generateRoomCode();
  const ownerId = `cloud:${req.user.id}`;
  const expiresAt = tier === 'free' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null;

  await createRoom({
    roomCode,
    ownerSocketId: ownerId,
    ownerClientId: ownerId,
    username: req.user.name
  });

  const { rows } = await pool.query(
    `UPDATE rooms
     SET playlist_name = $1,
         created_by = $2,
         host_id = $3,
         tier = $4,
         status = 'active',
         expires_at = $5,
         updated_at = NOW(),
         last_activity = NOW()
     WHERE room_code = $6
     RETURNING *`,
    [name, req.user.name, req.user.id, tier, expiresAt, roomCode]
  );

  return res.status(201).json({ room: mapRoom(rows[0]) });
});

router.put('/:id/branding', requireAuth, async (req, res) => {
  try {
    if (!['pro', 'event'].includes(req.user.tier)) {
      return res.status(403).json({
        error: 'Custom branding requires Pro or Event tier',
        code: 'TIER_REQUIRED'
      });
    }

    const roomCode = String(req.params.id || '').trim().toUpperCase();
    const {
      customBrandName,
      customBrandLogo,
      customBrandMessage,
      customBrandColor
    } = req.body || {};

    const { rows } = await pool.query(
      `UPDATE rooms
       SET custom_brand_name = $1,
           custom_brand_logo = $2,
           custom_brand_message = $3,
           custom_brand_color = COALESCE($4, '#C9A84C'),
           updated_at = NOW()
       WHERE room_code = $5::text
         AND host_id = $6::uuid
       RETURNING *`,
      [
        customBrandName || null,
        customBrandLogo || null,
        customBrandMessage || null,
        customBrandColor || null,
        roomCode,
        req.user.id
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.json({ room: mapRoom(rows[0]) });
  } catch (error) {
    console.error('Update room branding error:', error);
    return res.status(500).json({ error: 'Failed to update branding' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const roomCode = String(req.params.id || '').trim().toUpperCase();
  const { rows } = await pool.query(
    'SELECT * FROM rooms WHERE room_code = $1 AND host_id = $2',
    [roomCode, req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.json({ room: mapRoom(rows[0]) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const roomCode = String(req.params.id || '').trim().toUpperCase();
  const { rows } = await pool.query(
    `UPDATE rooms
     SET status = 'ended',
         ended_at = NOW(),
         updated_at = NOW(),
         last_activity = NOW()
     WHERE room_code = $1 AND host_id = $2
     RETURNING *`,
    [roomCode, req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.json({ room: mapRoom(rows[0]) });
});

export default router;
