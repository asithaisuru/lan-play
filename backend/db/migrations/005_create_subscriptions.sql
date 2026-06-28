CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_sub_id        TEXT UNIQUE,
  stripe_payment_id    TEXT,
  tier                 TEXT NOT NULL,
  status               TEXT NOT NULL,
  current_period_end   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
