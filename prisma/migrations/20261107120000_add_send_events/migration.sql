-- CreateTable
CREATE TABLE "SendEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sendAttemptId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendEvent_sendAttemptId_fkey" FOREIGN KEY ("sendAttemptId") REFERENCES "SendAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SendEvent_sendAttemptId_idx" ON "SendEvent"("sendAttemptId");

-- CreateIndex
CREATE INDEX "SendEvent_eventType_idx" ON "SendEvent"("eventType");

-- CreateIndex
CREATE INDEX "SendEvent_occurredAt_idx" ON "SendEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageInstance_cartId_templateId_scheduledAt_key" ON "MessageInstance"("cartId", "templateId", "scheduledAt");
