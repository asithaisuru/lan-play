import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'lan-play.sqlite'));
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    room_code TEXT PRIMARY KEY,
    owner_socket_id TEXT NOT NULL,
    owner_client_id TEXT,
    audio_socket_id TEXT,
    audio_client_id TEXT,
    playlist_name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    current_song_id TEXT,
    current_source TEXT,
    is_playing INTEGER NOT NULL DEFAULT 0,
    current_time REAL NOT NULL DEFAULT 0,
    volume INTEGER NOT NULL DEFAULT 100,
    announcement_enabled INTEGER NOT NULL DEFAULT 0,
    default_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_activity TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_users (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    socket_id TEXT NOT NULL,
    client_id TEXT,
    username TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    is_host INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (room_code) REFERENCES rooms(room_code) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('queue', 'default')),
    youtube_id TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 0,
    current_time REAL NOT NULL DEFAULT 0,
    added_by TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    played_at TEXT,
    added_at TEXT NOT NULL,
    FOREIGN KEY (room_code) REFERENCES rooms(room_code) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_room_users_room ON room_users(room_code);
  CREATE INDEX IF NOT EXISTS idx_songs_room_source_position ON songs(room_code, source, position);
`);

try {
  db.exec('ALTER TABLE songs ADD COLUMN played_at TEXT');
} catch (error) {
  if (!String(error.message).includes('duplicate column')) {
    throw error;
  }
}

for (const statement of [
  'ALTER TABLE rooms ADD COLUMN owner_client_id TEXT',
  'ALTER TABLE rooms ADD COLUMN audio_socket_id TEXT',
  'ALTER TABLE rooms ADD COLUMN audio_client_id TEXT',
  'ALTER TABLE rooms ADD COLUMN volume INTEGER NOT NULL DEFAULT 100',
  'ALTER TABLE room_users ADD COLUMN client_id TEXT',
  'ALTER TABLE songs ADD COLUMN current_time REAL NOT NULL DEFAULT 0'
]) {
  try {
    db.exec(statement);
  } catch (error) {
    if (!String(error.message).includes('duplicate column')) {
      throw error;
    }
  }
}

const now = () => new Date().toISOString();

const roomStmt = db.prepare('SELECT * FROM rooms WHERE room_code = ?');
const usersStmt = db.prepare('SELECT * FROM room_users WHERE room_code = ? ORDER BY joined_at ASC');
const songsStmt = db.prepare('SELECT * FROM songs WHERE room_code = ? AND source = ? ORDER BY position ASC, added_at ASC');
const songByIdStmt = db.prepare('SELECT * FROM songs WHERE id = ?');
const maxPositionStmt = db.prepare('SELECT COALESCE(MAX(position), -1) AS max_position FROM songs WHERE room_code = ? AND source = ?');

const mapSong = (row) => row ? ({
  _id: row.id,
  id: row.id,
  source: row.source,
  youtubeId: row.youtube_id,
  title: row.title,
  thumbnail: row.thumbnail,
  duration: row.duration,
  currentTime: row.current_time || 0,
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

const touchRoom = (roomCode) => {
  const timestamp = now();
  db.prepare('UPDATE rooms SET updated_at = ?, last_activity = ? WHERE room_code = ?')
    .run(timestamp, timestamp, roomCode);
};

export const getRoom = (roomCode) => roomStmt.get(roomCode);

export const getPlaylistState = (roomCode) => {
  const room = getRoom(roomCode);
  if (!room) return null;

  const songs = songsStmt.all(roomCode, 'queue').map(mapSong);
  const defaultSongs = songsStmt.all(roomCode, 'default').map(mapSong);
  const users = usersStmt.all(roomCode).map((user) => mapUser(user, room));

  return {
    _id: room.room_code,
    roomCode: room.room_code,
    ownerSocketId: room.owner_socket_id,
    ownerClientId: room.owner_client_id,
    audioSocketId: room.audio_socket_id || room.owner_socket_id,
    audioClientId: room.audio_client_id || room.owner_client_id,
    playlistName: room.playlist_name,
    createdBy: room.created_by,
    songs,
    defaultSongs,
    currentPlaying: room.current_song_id,
    currentSource: room.current_source,
    currentSong: mapSong(songByIdStmt.get(room.current_song_id)),
    isPlaying: Boolean(room.is_playing),
    currentTime: room.current_time,
    volume: Number.isFinite(room.volume) ? room.volume : 100,
    announcementEnabled: Boolean(room.announcement_enabled),
    defaultIndex: room.default_index,
    users,
    lastActivity: room.last_activity,
    createdAt: room.created_at,
    updatedAt: room.updated_at
  };
};

export const createRoom = ({ roomCode, ownerSocketId, ownerClientId, username }) => {
  const timestamp = now();
  db.prepare(`
    INSERT INTO rooms (
      room_code, owner_socket_id, owner_client_id, audio_socket_id, audio_client_id, playlist_name, created_by, is_playing,
      current_time, volume, announcement_enabled, default_index, created_at, updated_at, last_activity
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 100, 0, 0, ?, ?, ?)
  `).run(roomCode, ownerSocketId, ownerClientId, ownerSocketId, ownerClientId, `${username}'s Playlist`, username, timestamp, timestamp, timestamp);
};

export const addOrUpdateRoomUser = ({ roomCode, socketId, clientId, username, isHost }) => {
  const existing = db.prepare(`
    SELECT id FROM room_users
    WHERE room_code = ? AND ((client_id IS NOT NULL AND client_id = ?) OR socket_id = ?)
    ORDER BY client_id IS NULL ASC, joined_at ASC
    LIMIT 1
  `).get(roomCode, clientId || null, socketId);

  if (existing) {
    db.prepare('UPDATE room_users SET socket_id = ?, client_id = ?, username = ?, is_host = ? WHERE id = ?')
      .run(socketId, clientId || null, username, isHost ? 1 : 0, existing.id);
    return;
  }

  db.prepare(`
    INSERT INTO room_users (id, room_code, socket_id, client_id, username, joined_at, is_host)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), roomCode, socketId, clientId || null, username, now(), isHost ? 1 : 0);
};

export const removeRoomUser = (socketId) => {
  const user = db.prepare('SELECT * FROM room_users WHERE socket_id = ?').get(socketId);
  if (!user) return null;
  db.prepare('DELETE FROM room_users WHERE socket_id = ?').run(socketId);
  touchRoom(user.room_code);
  return user;
};

export const getOldestRoomUser = (roomCode) => usersStmt.get(roomCode);

export const setRoomOwner = (roomCode, socketId, clientId = null) => {
  db.prepare('UPDATE rooms SET owner_socket_id = ?, owner_client_id = COALESCE(?, owner_client_id) WHERE room_code = ?')
    .run(socketId, clientId, roomCode);
  db.prepare(`
    UPDATE room_users
    SET is_host = CASE
      WHEN (? IS NOT NULL AND client_id = ?) OR socket_id = ? THEN 1
      ELSE 0
    END
    WHERE room_code = ?
  `).run(clientId, clientId, socketId, roomCode);
  touchRoom(roomCode);
};

export const setRoomAudioDevice = (roomCode, socketId, clientId = null) => {
  db.prepare('UPDATE rooms SET audio_socket_id = ?, audio_client_id = ?, updated_at = ?, last_activity = ? WHERE room_code = ?')
    .run(socketId, clientId || null, now(), now(), roomCode);
};

export const getRoomUserByClientId = (roomCode, clientId) => {
  if (!clientId) return null;
  return db.prepare('SELECT * FROM room_users WHERE room_code = ? AND client_id = ? ORDER BY joined_at ASC LIMIT 1')
    .get(roomCode, clientId);
};

export const addSong = ({ roomCode, source, youtubeId, title, thumbnail, duration, addedBy, message = '' }) => {
  const id = randomUUID();
  const position = maxPositionStmt.get(roomCode, source).max_position + 1;
  db.prepare(`
    INSERT INTO songs (id, room_code, source, youtube_id, title, thumbnail, duration, added_by, message, position, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomCode, source, youtubeId, title, thumbnail, duration || 0, addedBy, message, position, now());
  touchRoom(roomCode);
  return mapSong(songByIdStmt.get(id));
};

export const removeSong = ({ roomCode, source, songId }) => {
  db.prepare('DELETE FROM songs WHERE room_code = ? AND source = ? AND id = ?').run(roomCode, source, songId);
  const songs = songsStmt.all(roomCode, source);
  const updatePosition = db.prepare('UPDATE songs SET position = ? WHERE id = ?');
  songs.forEach((song, index) => updatePosition.run(index, song.id));
  touchRoom(roomCode);
};

export const clearDefaultSongs = (roomCode) => {
  db.prepare("DELETE FROM songs WHERE room_code = ? AND source = 'default'").run(roomCode);
  db.prepare("UPDATE rooms SET current_song_id = NULL, current_source = NULL, is_playing = 0 WHERE room_code = ? AND current_source = 'default'")
    .run(roomCode);
  touchRoom(roomCode);
};

export const markQueueSongPlayed = (songId) => {
  if (!songId) return;
  db.prepare("UPDATE songs SET played_at = COALESCE(played_at, ?) WHERE id = ? AND source = 'queue'")
    .run(now(), songId);
};

export const reorderDefaultSongs = (roomCode, songIds) => {
  const updatePosition = db.prepare("UPDATE songs SET position = ? WHERE room_code = ? AND source = 'default' AND id = ?");
  songIds.forEach((songId, index) => updatePosition.run(index, roomCode, songId));
  touchRoom(roomCode);
};

export const setPlayback = ({ roomCode, songId, source, isPlaying, currentTime = 0, defaultIndex }) => {
  db.prepare(`
    UPDATE rooms
    SET current_song_id = ?, current_source = ?, is_playing = ?, current_time = ?,
        default_index = COALESCE(?, default_index), updated_at = ?, last_activity = ?
    WHERE room_code = ?
  `).run(songId || null, source || null, isPlaying ? 1 : 0, currentTime, defaultIndex ?? null, now(), now(), roomCode);
};

export const updateSongTiming = ({ songId, duration, currentTime, roomCode }) => {
  if (songId && Number.isFinite(duration) && duration > 0) {
    db.prepare('UPDATE songs SET duration = ? WHERE id = ? AND (duration = 0 OR duration IS NULL)')
      .run(duration, songId);
  }

  if (songId && Number.isFinite(currentTime)) {
    db.prepare('UPDATE songs SET current_time = ? WHERE id = ?')
      .run(currentTime, songId);
  }

  if (roomCode && Number.isFinite(currentTime)) {
    db.prepare('UPDATE rooms SET current_time = ?, updated_at = ?, last_activity = ? WHERE room_code = ?')
      .run(currentTime, now(), now(), roomCode);
  }
};

export const setAnnouncementEnabled = (roomCode, enabled) => {
  db.prepare('UPDATE rooms SET announcement_enabled = ?, updated_at = ?, last_activity = ? WHERE room_code = ?')
    .run(enabled ? 1 : 0, now(), now(), roomCode);
};

export const setRoomVolume = (roomCode, volume) => {
  const safeVolume = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
  db.prepare('UPDATE rooms SET volume = ?, updated_at = ?, last_activity = ? WHERE room_code = ?')
    .run(safeVolume, now(), now(), roomCode);
  return safeVolume;
};

export const getNextSong = ({ roomCode, currentSongId, currentSource }) => {
  const queueSongs = db.prepare(`
    SELECT * FROM songs
    WHERE room_code = ? AND source = 'queue' AND played_at IS NULL
    ORDER BY position ASC, added_at ASC
  `).all(roomCode);
  const defaultSongs = songsStmt.all(roomCode, 'default');

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
    const room = getRoom(roomCode);
    const currentDefaultIndex = defaultSongs.findIndex((song) => song.id === currentSongId);
    const fallbackIndex = Number.isInteger(room?.default_index) ? room.default_index : 0;
    const nextIndex = currentSource === 'default'
      ? (currentDefaultIndex + 1) % defaultSongs.length
      : fallbackIndex % defaultSongs.length;

    return {
      song: mapSong(defaultSongs[nextIndex]),
      source: 'default',
      defaultIndex: nextIndex,
      currentTime: currentSource === 'queue' ? (defaultSongs[nextIndex].current_time || 0) : 0
    };
  }

  return { song: null, source: null, defaultIndex: null };
};

export const getFirstQueueSong = (roomCode) => {
  const song = db.prepare("SELECT * FROM songs WHERE room_code = ? AND source = 'queue' AND played_at IS NULL ORDER BY position ASC, added_at ASC LIMIT 1")
    .get(roomCode);
  return mapSong(song);
};

export default db;
