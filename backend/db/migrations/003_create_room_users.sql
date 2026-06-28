CREATE TABLE IF NOT EXISTS room_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  socket_id   TEXT NOT NULL,
  client_id   TEXT,
  username    TEXT NOT NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  is_host     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_room_users_room ON room_users(room_code);
