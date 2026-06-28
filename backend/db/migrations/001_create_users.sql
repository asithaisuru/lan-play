CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  avatar                TEXT,
  tier                  TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id    TEXT,
  spotify_access_token  TEXT,
  spotify_refresh_token TEXT,
  spotify_connected     BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
