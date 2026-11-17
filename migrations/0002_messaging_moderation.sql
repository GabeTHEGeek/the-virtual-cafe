CREATE TABLE direct_messages (
  id INTEGER PRIMARY KEY,
  sender TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
  time INTEGER NOT NULL,
  CHECK(sender <> recipient)
);
CREATE INDEX dm_sender_recipient ON direct_messages(sender, recipient, id DESC);
CREATE INDEX dm_recipient_sender ON direct_messages(recipient, sender, id DESC);
CREATE INDEX dm_sender_time ON direct_messages(sender, time DESC);

CREATE TABLE blocks (
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  PRIMARY KEY (owner, target),
  CHECK(owner <> target)
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  room TEXT NOT NULL,
  reporter TEXT NOT NULL,
  target TEXT NOT NULL,
  target_account TEXT,
  reason TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL
);
