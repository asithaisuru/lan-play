import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/postgres.js';

const router = express.Router();

const cookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const hasGoogleConfig = Boolean(
  process.env.GOOGLE_CLIENT_ID
  && process.env.GOOGLE_CLIENT_SECRET
  && process.env.GOOGLE_REDIRECT_URI
);

if (hasGoogleConfig) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName || email;
      const avatar = profile.photos?.[0]?.value || null;

      if (!email) {
        return done(new Error('Google account did not return an email address.'));
      }

      const { rows } = await pool.query(
        `INSERT INTO users (email, name, avatar)
         VALUES ($1, $2, $3)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           avatar = EXCLUDED.avatar,
           updated_at = NOW()
         RETURNING id, email, name, avatar, tier, spotify_connected`,
        [email, name, avatar]
      );

      return done(null, rows[0]);
    } catch (error) {
      console.error('GoogleStrategy DB error:', error.message, error.stack);
      return done(error);
    }
  }));
}

const signUserToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      tier: user.tier
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
};

router.get('/google', authLimiter, (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
});

router.get('/google/callback', authLimiter, (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.redirect(`${clientUrl}/login?error=google_not_configured`);
  }

  return passport.authenticate('google', { session: false }, (error, user) => {
    if (error) {
      console.error('Google OAuth callback error:', error.message, error.stack);
      return res.redirect(`${clientUrl}/login?error=auth_failed`);
    }
    if (!user) {
      console.error('Google OAuth callback: no user returned');
      return res.redirect(`${clientUrl}/login?error=auth_failed`);
    }

    try {
      const token = signUserToken(user);
      res.cookie('waveio_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: cookieMaxAge
      });

      return res.redirect(`${clientUrl}/dashboard`);
    } catch {
      return res.redirect(`${clientUrl}/login?error=token_failed`);
    }
  })(req, res, next);
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.waveio_token;
    if (!token) {
      return res.json({ user: null });
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

    return res.json({ user: rows[0] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('waveio_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });

  return res.json({ success: true });
});

export default router;
