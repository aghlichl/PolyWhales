-- CreateTable
CREATE TABLE "ai_insight_history" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "eventTitle" TEXT,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" INTEGER NOT NULL,
    "confidencePercentile" DOUBLE PRECISION NOT NULL,
    "totalVolume" DOUBLE PRECISION NOT NULL,
    "topTraderVolume" DOUBLE PRECISION NOT NULL,
    "topTraderCount" INTEGER NOT NULL,
    "latestPrice" DOUBLE PRECISION NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "volumeZScore" DOUBLE PRECISION,
    "hhiConcentration" DOUBLE PRECISION,
    "rankWeightedScore" DOUBLE PRECISION,
    "directionConviction" DOUBLE PRECISION,
    "isUnusualActivity" BOOLEAN NOT NULL DEFAULT false,
    "isConcentrated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ai_insight_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_insight_history_conditionId_outcome_snapshotAt_key" ON "ai_insight_history"("conditionId", "outcome", "snapshotAt");

-- CreateIndex
CREATE INDEX "ai_insight_history_conditionId_outcome_snapshotAt_idx" ON "ai_insight_history"("conditionId", "outcome", "snapshotAt");

-- CreateIndex
CREATE INDEX "ai_insight_history_snapshotAt_idx" ON "ai_insight_history"("snapshotAt");




