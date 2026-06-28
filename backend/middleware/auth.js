import jwt from 'jsonwebtoken';
import { pool } from '../db/postgres.js';

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.waveio_token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, email, name, avatar, tier, spotify_connected
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
