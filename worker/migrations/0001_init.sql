-- Personal data is the email only: no name, avatar or date of birth.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- One row per sign-in method, so adding another provider needs no schema change.
CREATE TABLE identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);

CREATE INDEX identities_user ON identities (user_id);

-- Only a hash of the session token is stored, so a database leak does not leak sessions.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user ON sessions (user_id);

-- The client's append-only event log. `seq` is the sync cursor; a re-sent event (same id) is ignored.
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  at TEXT NOT NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE (user_id, id)
);

CREATE INDEX events_user_seq ON events (user_id, seq);

-- Synced settings as JSON with a timestamp per field (last write wins per field).
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Access to paid content; filled by a payment webhook later. Empty for now.
CREATE TABLE entitlements (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  valid_until TEXT,
  PRIMARY KEY (user_id, product)
);
