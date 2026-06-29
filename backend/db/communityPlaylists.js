import { randomUUID } from 'crypto';
import { pool } from './postgres.js';

const now = () => new Date().toISOString();

const sortColumns = {
  newest: 'cp.created_at DESC',
  most_songs: 'cp.song_count DESC, cp.created_at DESC',
  longest: 'cp.total_duration DESC, cp.created_at DESC',
  most_played: 'cp.play_count DESC, cp.created_at DESC'
};

const mapPlaylist = (row) => row ? ({
  id: row.id,
  hostId: row.host_id,
  hostName: row.host_name || 'Waveio host',
  name: row.name,
  description: row.description || '',
  tags: row.tags || [],
  isPublic: Boolean(row.is_public),
  songCount: Number(row.song_count) || 0,
  totalDuration: Number(row.total_duration) || 0,
  playCount: Number(row.play_count) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
}) : null;

const mapSong = (row) => row ? ({
  id: row.id,
  playlistId: row.playlist_id,
  youtubeId: row.youtube_id,
  title: row.title,
  thumbnail: row.thumbnail || '',
  duration: Number(row.duration) || 0,
  position: Number(row.position) || 0,
  addedAt: row.added_at
}) : null;

const playlistSelect = `
  SELECT cp.*,
         COALESCE(u.name, u.email, 'Waveio host') AS host_name
  FROM community_playlists cp
  LEFT JOIN users u ON u.id = cp.host_id
`;

const assertOwnedPlaylist = async (client, playlistId, hostId) => {
  const { rows } = await client.query(
    'SELECT * FROM community_playlists WHERE id = $1::uuid AND host_id = $2::uuid',
    [playlistId, hostId]
  );

  if (!rows[0]) {
    const error = new Error('Playlist not found');
    error.status = 404;
    throw error;
  }

  return rows[0];
};

const refreshPlaylistStats = async (client, playlistId) => {
  await client.query(
    `UPDATE community_playlists cp
     SET song_count = stats.song_count,
         total_duration = stats.total_duration,
         updated_at = $2::timestamptz
     FROM (
       SELECT COUNT(*)::integer AS song_count,
              COALESCE(SUM(duration), 0)::integer AS total_duration
       FROM community_playlist_songs
       WHERE playlist_id = $1::uuid
     ) stats
     WHERE cp.id = $1::uuid`,
    [playlistId, now()]
  );
};

export const getCommunityPlaylists = async ({
  isPublic = true,
  hostId = null,
  minSongs = 0,
  minDuration = 0,
  tags = [],
  search = '',
  sortBy = 'newest',
  limit = 20,
  offset = 0
} = {}) => {
  const conditions = [];
  const values = [];

  if (hostId && isPublic === false) {
    values.push(hostId);
    conditions.push(`cp.host_id = $${values.length}::uuid`);
  } else if (hostId) {
    values.push(hostId);
    conditions.push(`(cp.is_public = true OR cp.host_id = $${values.length}::uuid)`);
  } else {
    values.push(Boolean(isPublic));
    conditions.push(`cp.is_public = $${values.length}::boolean`);
  }

  if (minSongs > 0) {
    values.push(Number(minSongs));
    conditions.push(`cp.song_count >= $${values.length}::integer`);
  }

  if (minDuration > 0) {
    values.push(Number(minDuration));
    conditions.push(`cp.total_duration >= $${values.length}::integer`);
  }

  if (tags.length > 0) {
    values.push(tags);
    conditions.push(`cp.tags && $${values.length}::text[]`);
  }

  if (search.trim()) {
    values.push(`%${search.trim()}%`);
    conditions.push(`(cp.name ILIKE $${values.length}::text OR cp.description ILIKE $${values.length}::text)`);
  }

  const safeLimit = Math.max(1, Math.min(60, Number(limit) || 20));
  const safeOffset = Math.max(0, Number(offset) || 0);
  values.push(safeLimit);
  const limitParam = `$${values.length}::integer`;
  values.push(safeOffset);
  const offsetParam = `$${values.length}::integer`;

  const { rows } = await pool.query(
    `${playlistSelect}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${sortColumns[sortBy] || sortColumns.newest}
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  return rows.map(mapPlaylist);
};

export const getCommunityPlaylist = async (playlistId) => {
  const { rows } = await pool.query(
    `${playlistSelect}
     WHERE cp.id = $1::uuid`,
    [playlistId]
  );

  const playlist = mapPlaylist(rows[0]);
  if (!playlist) return null;

  const { rows: songRows } = await pool.query(
    `SELECT *
     FROM community_playlist_songs
     WHERE playlist_id = $1::uuid
     ORDER BY position ASC, added_at ASC`,
    [playlistId]
  );

  return {
    ...playlist,
    songs: songRows.map(mapSong)
  };
};

export const createCommunityPlaylist = async ({
  hostId,
  name,
  description = '',
  tags = [],
  isPublic = false
}) => {
  const { rows } = await pool.query(
    `INSERT INTO community_playlists (
       host_id, name, description, tags, is_public, created_at, updated_at
     )
     VALUES ($1::uuid, $2::text, $3::text, $4::text[], $5::boolean, $6::timestamptz, $7::timestamptz)
     RETURNING *`,
    [hostId, name, description, tags, Boolean(isPublic), now(), now()]
  );

  return getCommunityPlaylist(rows[0].id);
};

export const addSongToCommunityPlaylist = async ({
  playlistId,
  hostId,
  youtubeId,
  title,
  thumbnail = '',
  duration = 0
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertOwnedPlaylist(client, playlistId, hostId);

    const { rows: positionRows } = await client.query(
      'SELECT COALESCE(MAX(position), -1)::integer AS max_position FROM community_playlist_songs WHERE playlist_id = $1::uuid',
      [playlistId]
    );
    const position = Number(positionRows[0].max_position) + 1;

    await client.query(
      `INSERT INTO community_playlist_songs (
         id, playlist_id, youtube_id, title, thumbnail, duration, position, added_at
       )
       VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::integer, $7::integer, $8::timestamptz)`,
      [randomUUID(), playlistId, youtubeId, title, thumbnail, Number(duration) || 0, position, now()]
    );

    await refreshPlaylistStats(client, playlistId);
    await client.query('COMMIT');
    return getCommunityPlaylist(playlistId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const removeSongFromCommunityPlaylist = async ({
  playlistId,
  songId,
  hostId
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertOwnedPlaylist(client, playlistId, hostId);

    const { rowCount } = await client.query(
      'DELETE FROM community_playlist_songs WHERE id = $1::uuid AND playlist_id = $2::uuid',
      [songId, playlistId]
    );

    if (!rowCount) {
      const error = new Error('Song not found');
      error.status = 404;
      throw error;
    }

    const { rows: remainingRows } = await client.query(
      `SELECT id
       FROM community_playlist_songs
       WHERE playlist_id = $1::uuid
       ORDER BY position ASC, added_at ASC`,
      [playlistId]
    );

    for (let index = 0; index < remainingRows.length; index += 1) {
      await client.query(
        'UPDATE community_playlist_songs SET position = $1::integer WHERE id = $2::uuid',
        [index, remainingRows[index].id]
      );
    }

    await refreshPlaylistStats(client, playlistId);
    await client.query('COMMIT');
    return getCommunityPlaylist(playlistId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateCommunityPlaylist = async ({
  playlistId,
  hostId,
  name,
  description = '',
  tags = [],
  isPublic = false
}) => {
  const { rows } = await pool.query(
    `UPDATE community_playlists
     SET name = $1::text,
         description = $2::text,
         tags = $3::text[],
         is_public = $4::boolean,
         updated_at = $5::timestamptz
     WHERE id = $6::uuid AND host_id = $7::uuid
     RETURNING id`,
    [name, description, tags, Boolean(isPublic), now(), playlistId, hostId]
  );

  if (!rows[0]) {
    const error = new Error('Playlist not found');
    error.status = 404;
    throw error;
  }

  return getCommunityPlaylist(playlistId);
};

export const deleteCommunityPlaylist = async ({ playlistId, hostId }) => {
  const { rowCount } = await pool.query(
    'DELETE FROM community_playlists WHERE id = $1::uuid AND host_id = $2::uuid',
    [playlistId, hostId]
  );

  if (!rowCount) {
    const error = new Error('Playlist not found');
    error.status = 404;
    throw error;
  }
};

export const appendToRoomDefaultPlaylist = async ({
  playlistId,
  roomCode,
  hostId
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: playlistRows } = await client.query(
      'SELECT id, host_id, is_public FROM community_playlists WHERE id = $1::uuid',
      [playlistId]
    );

    if (!playlistRows[0] || (!playlistRows[0].is_public && playlistRows[0].host_id !== hostId)) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }

    const { rows: roomRows } = await client.query(
      `SELECT room_code, playlist_name
       FROM rooms
       WHERE room_code = $1::text AND host_id = $2::uuid AND status = 'active'`,
      [roomCode, hostId]
    );

    if (!roomRows[0]) {
      const error = new Error('Room not found');
      error.status = 404;
      throw error;
    }

    const { rows: songRows } = await client.query(
      `SELECT *
       FROM community_playlist_songs
       WHERE playlist_id = $1::uuid
       ORDER BY position ASC, added_at ASC`,
      [playlistId]
    );

    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(position), -1)::integer AS max_position
       FROM songs
       WHERE room_code = $1::text AND source = 'default'`,
      [roomCode]
    );

    let position = Number(maxRows[0].max_position) + 1;
    for (const song of songRows) {
      await client.query(
        `INSERT INTO songs (
           id, room_code, source, youtube_id, title, thumbnail, duration,
           added_by, message, position, added_at
         )
         VALUES (
           $1::uuid, $2::text, 'default', $3::text, $4::text, $5::text,
           $6::integer, $7::text, '', $8::integer, $9::timestamptz
         )`,
        [
          randomUUID(),
          roomCode,
          song.youtube_id,
          song.title,
          song.thumbnail || '',
          Number(song.duration) || 0,
          'Playlist Library',
          position,
          now()
        ]
      );
      position += 1;
    }

    await client.query(
      `UPDATE rooms
       SET updated_at = $1::timestamptz,
           last_activity = $2::timestamptz
       WHERE room_code = $3::text`,
      [now(), now(), roomCode]
    );

    await client.query(
      `UPDATE community_playlists
       SET play_count = play_count + 1,
           updated_at = $1::timestamptz
       WHERE id = $2::uuid`,
      [now(), playlistId]
    );

    await client.query('COMMIT');
    return {
      count: songRows.length,
      roomName: roomRows[0].playlist_name
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
