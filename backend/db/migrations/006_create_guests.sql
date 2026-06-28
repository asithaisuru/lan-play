CREATE TABLE IF NOT EXISTS guests (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  username  TEXT NOT NULL,
  client_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);
