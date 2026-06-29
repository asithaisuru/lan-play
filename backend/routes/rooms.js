import express from 'express';
import { pool, createRoom } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const codeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomLimits = {
  free: 1,
  pro: 3,
  event: 1
};

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

  if ((process.env.DB_MODE || 'sqlite') !== 'postgres') {
    return res.json({
      room: {
        roomCode,
        name: `Room ${roomCode}`,
        status: 'active',
        tier: 'lan',
        branding: null
      }
    });
  }

  const { rows } = await pool.query(
    `SELECT room_code, playlist_name, status, tier
     FROM rooms
     WHERE room_code = $1 AND status = 'active'`,
    [roomCode]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'This room does not exist or has ended' });
  }

  const room = rows[0];
  return res.json({
    room: {
      roomCode: room.room_code,
      name: room.playlist_name,
      status: room.status,
      tier: room.tier,
      branding: room.tier === 'pro' || room.tier === 'event'
        ? { product: 'Waveio', company: 'KRODOT' }
        : null
    }
  });
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
  const limit = roomLimits[tier] || roomLimits.free;
  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM rooms WHERE host_id = $1 AND status = 'active'",
    [req.user.id]
  );

  if (countRows[0].count >= limit) {
    return res.status(403).json({
      error: `Your ${tier} plan allows ${limit} active room${limit === 1 ? '' : 's'}. Upgrade to create more rooms.`
    });
  }

  const roomCode = await generateRoomCode();
  const ownerId = `cloud:${req.user.id}`;
  const expiresAt = tier === 'free' ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;

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
