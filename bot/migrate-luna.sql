-- Для уже созданной базы (один раз): добавляет колонки для новолуний и полнолуний
ALTER TABLE subs ADD COLUMN luna TEXT;
ALTER TABLE subs ADD COLUMN luna_utc INTEGER;
ALTER TABLE subs ADD COLUMN last_luna TEXT;
CREATE INDEX IF NOT EXISTS idx_subs_luna ON subs (luna_utc);
