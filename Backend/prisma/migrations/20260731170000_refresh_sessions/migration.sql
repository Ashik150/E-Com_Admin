CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdByIp" TEXT,
    "lastUsedIp" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key"
ON "refresh_sessions"("tokenHash");

CREATE UNIQUE INDEX "refresh_sessions_replacedById_key"
ON "refresh_sessions"("replacedById");

CREATE INDEX "refresh_sessions_userId_idx"
ON "refresh_sessions"("userId");

CREATE INDEX "refresh_sessions_familyId_idx"
ON "refresh_sessions"("familyId");

CREATE INDEX "refresh_sessions_expiresAt_idx"
ON "refresh_sessions"("expiresAt");

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_replacedById_fkey"
FOREIGN KEY ("replacedById") REFERENCES "refresh_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
