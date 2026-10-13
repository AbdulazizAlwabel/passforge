-- Session versioning: bumping token_version invalidates every issued session cookie
-- (password change/reset, "sign out everywhere").
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
