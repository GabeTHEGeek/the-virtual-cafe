CREATE TABLE "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "session" (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt DATE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user ON "session"(userId);
CREATE TABLE "account" (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt DATE,
  refreshTokenExpiresAt DATE,
  scope TEXT,
  password TEXT,
  createdAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (providerId, accountId)
);
CREATE INDEX account_user ON "account"(userId);
CREATE TABLE "verification" (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt DATE NOT NULL,
  createdAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX verification_identifier ON "verification"(identifier);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 18),
  animal TEXT NOT NULL CHECK(animal IN ('panda', 'fox', 'cat', 'rabbit')),
  work TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT ''
);
