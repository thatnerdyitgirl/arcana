CREATE TABLE IF NOT EXISTS subs (
  chat INTEGER PRIMARY KEY,
  tz INTEGER NOT NULL DEFAULT 300,
  morning TEXT,
  med TEXT,
  morning_utc INTEGER,
  med_utc INTEGER,
  last_morning TEXT,
  last_med TEXT
);
CREATE INDEX IF NOT EXISTS idx_subs_morning ON subs (morning_utc);
CREATE INDEX IF NOT EXISTS idx_subs_med ON subs (med_utc);
