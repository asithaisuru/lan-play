import pg from 'pg';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const now = () => new Date().toISOString();

const mapSong = (row) => row ? ({
  _id: row.id,
  id: row.id,
  source: row.source,
  youtubeId: row.youtube_id,
  title: row.title,
  thumbnail: row.thumbnail,
  duration: Number(row.duration) || 0,
  currentTime: Number(row.current_time) || 0,
  addedBy: row.added_by,
  message: row.message || '',
  playedAt: row.played_at,
  addedAt: row.added_at
}) : null;

const mapUser = (row, room = null) => ({
  socketId: row.socket_id,
  clientId: row.client_id,
  username: row.username,
  joinedAt: row.joined_at,
  isHost: Boolean(row.is_host),
  isAudioDevice: Boolean(
    room
    && (
      (room.audio_client_id && row.client_id === room.audio_client_id)
      || row.socket_id === room.audio_socket_id
    )
  )
});

export const getRoom = async (roomCode) => {
  const { rows } = await pool.query(
    'SELECT * FROM rooms WHERE room_code = $1',
    [roomCode]
  );
  return rows[0] || null;
};

export const getPlaylistState = async (roomCode) => {
  const room = await getRoom(roomCode);
  if (!room) return null;

  const { rows: songRows } = await pool.query(
    `SELECT * FROM songs
     WHERE room_code = $1 AND source = 'queue'
     ORDER BY position ASC, added_at ASC`,
    [roomCode]
  );

  const { rows: defaultRows } = await pool.query(
    `SELECT * FROM songs
     WHERE room_code = $1 AND source = 'default'
     ORDER BY position ASC, added_at ASC`,
    [roomCode]
  );

  const { rows: userRows } = await pool.query(
    'SELECT * FROM room_users WHERE room_code = $1 ORDER BY joined_at ASC',
    [roomCode]
  );

  let currentSong = null;
  if (room.current_song_id) {
    const { rows } = await pool.query(
      'SELECT * FROM songs WHERE id = $1::uuid',
      [room.current_song_id]
    );
    currentSong = mapSong(rows[0] || null);
  }

  return {
    _id: room.room_code,
    roomCode: room.room_code,
    ownerSocketId: room.owner_socket_id,
    ownerClientId: room.owner_client_id,
    audioSocketId: room.audio_socket_id || room.owner_socket_id,
    audioClientId: room.audio_client_id || room.owner_client_id,
    playlistName: room.playlist_name,
    createdBy: room.created_by,
    songs: songRows.map(mapSong),
    defaultSongs: defaultRows.map(mapSong),
    currentPlaying: room.current_song_id,
    currentSource: room.current_source,
    currentSong,
    isPlaying: Boolean(room.is_playing),
    currentPosition: Number(room.current_position) || 0,
    currentTime: Number(room.current_position) || 0,
    volume: Number.isFinite(Number(room.volume)) ? Number(room.volume) : 100,
    announcementEnabled: Boolean(room.announcement_enabled),
    defaultIndex: Number(room.default_index) || 0,
    users: userRows.map((user) => mapUser(user, room)),
    lastActivity: room.last_activity,
    createdAt: room.created_at,
    updatedAt: room.updated_at
  };
};

export const createRoom = async ({ roomCode, ownerSocketId, ownerClientId, username }) => {
  const timestamp = now();
  await pool.query(
    `INSERT INTO rooms (
      room_code, owner_socket_id, owner_client_id, audio_socket_id, audio_client_id,
      playlist_name, created_by, is_playing, current_position, volume,
      announcement_enabled, default_index, created_at, updated_at, last_activity
    )
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, false, 0, 100, false, 0, $8::timestamptz, $9::timestamptz, $10::timestamptz)`,
    [
      roomCode,
      ownerSocketId,
      ownerClientId,
      ownerSocketId,
      ownerClientId,
      `${username}'s Playlist`,
      username,
      timestamp,
      timestamp,
      timestamp
    ]
  );
};

export const touchRoom = async (roomCode) => {
  const timestamp = now();
  await pool.query(
    'UPDATE rooms SET updated_at = $1, last_activity = $2 WHERE room_code = $3',
    [timestamp, timestamp, roomCode]
  );
};

export const addOrUpdateRoomUser = async ({ roomCode, socketId, clientId, username, isHost }) => {
  const { rows: existing } = await pool.query(
    `SELECT id FROM room_users
     WHERE room_code = $1::text
       AND ((client_id IS NOT NULL AND client_id = $2::text) OR socket_id = $3::text)
     ORDER BY (client_id IS NULL) ASC, joined_at ASC
     LIMIT 1`,
    [roomCode, clientId || null, socketId]
  );

  if (existing.length > 0) {
    await pool.query(
      'UPDATE room_users SET socket_id = $1::text, client_id = $2::text, username = $3::text, is_host = $4::boolean WHERE id = $5::uuid',
      [socketId, clientId || null, username, Boolean(isHost), existing[0].id]
    );
    return;
  }

  await pool.query(
    `INSERT INTO room_users (id, room_code, socket_id, client_id, username, joined_at, is_host)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::timestamptz, $7::boolean)`,
    [randomUUID(), roomCode, socketId, clientId || null, username, now(), Boolean(isHost)]
  );
};

export const removeRoomUser = async (socketId) => {
  const { rows } = await pool.query(
    'SELECT * FROM room_users WHERE socket_id = $1',
    [socketId]
  );
  if (!rows[0]) return null;

  await pool.query('DELETE FROM room_users WHERE socket_id = $1', [socketId]);
  await touchRoom(rows[0].room_code);
  return rows[0];
};

export const getOldestRoomUser = async (roomCode) => {
  const { rows } = await pool.query(
    'SELECT * FROM room_users WHERE room_code = $1 ORDER BY joined_at ASC LIMIT 1',
    [roomCode]
  );
  return rows[0] || null;
};

export const setRoomOwner = async (roomCode, socketId, clientId = null) => {
  await pool.query(
    `UPDATE rooms
     SET owner_socket_id = $1::text,
         owner_client_id = COALESCE($2::text, owner_client_id)
     WHERE room_code = $3::text`,
    [socketId, clientId, roomCode]
  );

  await pool.query(
    `UPDATE room_users
     SET is_host = CASE
       WHEN ($1::text IS NOT NULL AND client_id = $1::text) OR socket_id = $2::text THEN true
       ELSE false
     END
     WHERE room_code = $3::text`,
    [clientId, socketId, roomCode]
  );

  await touchRoom(roomCode);
};

export const setRoomAudioDevice = async (roomCode, socketId, clientId = null) => {
  await pool.query(
    `UPDATE rooms
     SET audio_socket_id = $1::text,
         audio_client_id = $2::text,
         updated_at = $3,
         last_activity = $4
     WHERE room_code = $5::text`,
    [socketId, clientId || null, now(), now(), roomCode]
  );
};

export const getRoomUserByClientId = async (roomCode, clientId) => {
  if (!clientId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM room_users
     WHERE room_code = $1::text AND client_id = $2::text
     ORDER BY joined_at ASC
     LIMIT 1`,
    [roomCode, clientId]
  );
  return rows[0] || null;
};

export const addSong = async ({ roomCode, source, youtubeId, title, thumbnail, duration, addedBy, message = '' }) => {
  const { rows: maxRows } = await pool.query(
    'SELECT COALESCE(MAX(position), -1) AS max_position FROM songs WHERE room_code = $1 AND source = $2',
    [roomCode, source]
  );
  const position = Number(maxRows[0].max_position) + 1;
  const id = randomUUID();

  await pool.query(
    `INSERT INTO songs (
      id, room_code, source, youtube_id, title, thumbnail, duration, added_by, message, position, added_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, roomCode, source, youtubeId, title, thumbnail, duration || 0, addedBy, message, position, now()]
  );

  await touchRoom(roomCode);

  const { rows } = await pool.query('SELECT * FROM songs WHERE id = $1', [id]);
  return mapSong(rows[0]);
};

export const removeSong = async ({ roomCode, source, songId }) => {
  await pool.query(
    'DELETE FROM songs WHERE room_code = $1 AND source = $2 AND id = $3',
    [roomCode, source, songId]
  );

  const { rows: remaining } = await pool.query(
    'SELECT id FROM songs WHERE room_code = $1 AND source = $2 ORDER BY position ASC, added_at ASC',
    [roomCode, source]
  );

  for (let index = 0; index < remaining.length; index += 1) {
    await pool.query('UPDATE songs SET position = $1 WHERE id = $2', [index, remaining[index].id]);
  }

  await touchRoom(roomCode);
};

export const clearDefaultSongs = async (roomCode) => {
  await pool.query(
    "DELETE FROM songs WHERE room_code = $1 AND source = 'default'",
    [roomCode]
  );

  await pool.query(
    `UPDATE rooms
     SET current_song_id = NULL::text,
         current_source = NULL::text,
         is_playing = false
     WHERE room_code = $1::text AND current_source = 'default'`,
    [roomCode]
  );

  await touchRoom(roomCode);
};

export const markQueueSongPlayed = async (songId) => {
  if (!songId) return;
  await pool.query(
    "UPDATE songs SET played_at = COALESCE(played_at, $1) WHERE id = $2 AND source = 'queue'",
    [now(), songId]
  );
};

export const reorderDefaultSongs = async (roomCode, songIds) => {
  for (let index = 0; index < songIds.length; index += 1) {
    await pool.query(
      "UPDATE songs SET position = $1 WHERE room_code = $2 AND source = 'default' AND id = $3",
      [index, roomCode, songIds[index]]
    );
  }

  await touchRoom(roomCode);
};

export const setPlayback = async ({ roomCode, songId, source, isPlaying, currentTime = 0, defaultIndex }) => {
  await pool.query(
    `UPDATE rooms
     SET current_song_id = $1::text,
         current_source = $2::text,
         is_playing = $3::boolean,
         current_position = $4,
         default_index = COALESCE($5::integer, default_index),
         updated_at = $6,
         last_activity = $7
     WHERE room_code = $8::text`,
    [songId || null, source || null, Boolean(isPlaying), currentTime, defaultIndex ?? null, now(), now(), roomCode]
  );
};

export const updateSongTiming = async ({ songId, duration, currentTime, roomCode }) => {
  if (songId && Number.isFinite(duration) && duration > 0) {
    await pool.query(
      'UPDATE songs SET duration = $1 WHERE id = $2 AND (duration = 0 OR duration IS NULL)',
      [duration, songId]
    );
  }

  if (songId && Number.isFinite(currentTime)) {
    await pool.query(
      'UPDATE songs SET current_time = $1 WHERE id = $2',
      [currentTime, songId]
    );
  }

  if (roomCode && Number.isFinite(currentTime)) {
    await pool.query(
      'UPDATE rooms SET current_position = $1, updated_at = $2, last_activity = $3 WHERE room_code = $4',
      [currentTime, now(), now(), roomCode]
    );
  }
};

export const setAnnouncementEnabled = async (roomCode, enabled) => {
  await pool.query(
    'UPDATE rooms SET announcement_enabled = $1, updated_at = $2, last_activity = $3 WHERE room_code = $4',
    [Boolean(enabled), now(), now(), roomCode]
  );
};

export const setRoomVolume = async (roomCode, volume) => {
  const safeVolume = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
  await pool.query(
    'UPDATE rooms SET volume = $1, updated_at = $2, last_activity = $3 WHERE room_code = $4',
    [safeVolume, now(), now(), roomCode]
  );
  return safeVolume;
};

export const getNextSong = async ({ roomCode, currentSongId, currentSource }) => {
  const { rows: queueSongs } = await pool.query(
    `SELECT * FROM songs
     WHERE room_code = $1 AND source = 'queue' AND played_at IS NULL
     ORDER BY position ASC, added_at ASC`,
    [roomCode]
  );

  const { rows: defaultSongs } = await pool.query(
    `SELECT * FROM songs
     WHERE room_code = $1 AND source = 'default'
     ORDER BY position ASC, added_at ASC`,
    [roomCode]
  );

  if (currentSource === 'queue') {
    const currentIndex = queueSongs.findIndex((song) => song.id === currentSongId);
    const nextQueue = queueSongs[currentIndex + 1];
    if (nextQueue) {
      return { song: mapSong(nextQueue), source: 'queue', defaultIndex: null };
    }
  }

  if (queueSongs.length > 0 && currentSource !== 'queue') {
    return { song: mapSong(queueSongs[0]), source: 'queue', defaultIndex: null };
  }

  if (defaultSongs.length > 0) {
    const room = await getRoom(roomCode);
    const currentDefaultIndex = defaultSongs.findIndex((song) => song.id === currentSongId);
    const fallbackIndex = Number.isInteger(Number(room?.default_index)) ? Number(room.default_index) : 0;
    const nextIndex = currentSource === 'default'
      ? (currentDefaultIndex + 1) % defaultSongs.length
      : fallbackIndex % defaultSongs.length;

    return {
      song: mapSong(defaultSongs[nextIndex]),
      source: 'default',
      defaultIndex: nextIndex,
      currentTime: currentSource === 'queue' ? (Number(defaultSongs[nextIndex].current_time) || 0) : 0
    };
  }

  return { song: null, source: null, defaultIndex: null };
};

export const getFirstQueueSong = async (roomCode) => {
  const { rows } = await pool.query(
    `SELECT * FROM songs
     WHERE room_code = $1 AND source = 'queue' AND played_at IS NULL
     ORDER BY position ASC, added_at ASC
     LIMIT 1`,
    [roomCode]
  );
  return mapSong(rows[0] || null);
};

export default pool;
