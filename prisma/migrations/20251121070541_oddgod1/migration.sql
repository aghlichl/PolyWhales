-- CreateTable
CREATE TABLE "wallet_profiles" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "totalPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFresh" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "isWhale" BOOLEAN NOT NULL DEFAULT false,
    "isSmartMoney" BOOLEAN NOT NULL DEFAULT false,
    "isFresh" BOOLEAN NOT NULL DEFAULT false,
    "isSweeper" BOOLEAN NOT NULL DEFAULT false,
    "conditionId" TEXT,
    "outcome" TEXT,
    "question" TEXT,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trades_walletAddress_idx" ON "trades"("walletAddress");

-- CreateIndex
CREATE INDEX "trades_timestamp_idx" ON "trades"("timestamp");

-- CreateIndex
CREATE INDEX "trades_isWhale_timestamp_idx" ON "trades"("isWhale", "timestamp");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "wallet_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
