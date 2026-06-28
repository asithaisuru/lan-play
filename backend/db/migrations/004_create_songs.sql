CREATE TABLE IF NOT EXISTS songs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code     TEXT NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK(source IN ('queue', 'default')),
  youtube_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  thumbnail     TEXT NOT NULL,
  duration      NUMERIC NOT NULL DEFAULT 0,
  current_time  NUMERIC NOT NULL DEFAULT 0,
  added_by      TEXT NOT NULL,
  message       TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL,
  played_at     TIMESTAMPTZ,
  added_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_songs_room_source_position
  ON songs(room_code, source, position);
