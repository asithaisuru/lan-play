import { pool } from '../db/postgres.js';

export const TIER_LIMITS = {
  free: {
    maxGuests: 5,
    maxQueueSize: 10,
    maxSessionMinutes: 120,
    maxRooms: 1,
    spotify: false,
    ads: true,
    customBranding: false,
    advancedControls: false
  },
  pro: {
    maxGuests: Infinity,
    maxQueueSize: Infinity,
    maxSessionMinutes: Infinity,
    maxRooms: 3,
    spotify: true,
    ads: false,
    customBranding: true,
    advancedControls: true
  },
  event: {
    maxGuests: Infinity,
    maxQueueSize: Infinity,
    maxSessionMinutes: Infinity,
    maxRooms: 1,
    spotify: true,
    ads: false,
    customBranding: true,
    advancedControls: true
  }
};

export const getTierLimits = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.free;

export const getRoomWithTier = async (roomCode) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.tier AS host_tier
     FROM rooms r
     JOIN users u ON u.id = r.host_id
     WHERE r.room_code = $1::text`,
    [roomCode]
  );
  return rows[0] || null;
};

export const checkGuestLimit = async (roomCode, tier) => {
  const limits = getTierLimits(tier);
  if (limits.maxGuests === Infinity) return true;

  const { rows } = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM room_users
     WHERE room_code = $1::text
       AND is_host = false`,
    [roomCode]
  );

  return Number(rows[0].count) < limits.maxGuests;
};

export const checkQueueLimit = async (roomCode, tier) => {
  const limits = getTierLimits(tier);
  if (limits.maxQueueSize === Infinity) return true;

  const { rows } = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM songs
     WHERE room_code = $1::text
       AND source = 'queue'
       AND played_at IS NULL`,
    [roomCode]
  );

  return Number(rows[0].count) < limits.maxQueueSize;
};

export const checkSessionExpiry = async (roomCode) => {
  const { rows } = await pool.query(
    `SELECT expires_at
     FROM rooms
     WHERE room_code = $1::text`,
    [roomCode]
  );

  if (!rows[0]?.expires_at) return false;
  return new Date() > new Date(rows[0].expires_at);
};
