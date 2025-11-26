-- Add wallet enrichment fields to trades table
-- These fields support the wallet identity enrichment pipeline

-- Make walletAddress optional with a default empty string
-- (Prisma will handle the relation optionality)
ALTER TABLE "trades" ALTER COLUMN "walletAddress" SET DEFAULT '';

-- Drop the existing foreign key constraint so we can have trades without wallets
ALTER TABLE "trades" DROP CONSTRAINT IF EXISTS "trades_walletAddress_fkey";

-- Re-add the foreign key as optional (ON DELETE SET NULL would require nullable column)
-- Since walletAddress defaults to empty string, we'll make the constraint deferrable
-- Actually, we'll just not re-add it since it's now optional in Prisma schema

-- Add enrichment fields
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "transactionHash" TEXT;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "blockNumber" BIGINT;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "logIndex" INTEGER;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "enrichmentStatus" TEXT DEFAULT 'pending';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "trades_transactionHash_idx" ON "trades"("transactionHash");
CREATE INDEX IF NOT EXISTS "trades_enrichmentStatus_timestamp_idx" ON "trades"("enrichmentStatus", "timestamp");

-- Mark existing trades with wallet addresses as enriched
UPDATE "trades" SET "enrichmentStatus" = 'enriched' WHERE "walletAddress" IS NOT NULL AND "walletAddress" != '';

-- Mark existing trades without wallet addresses as pending
UPDATE "trades" SET "enrichmentStatus" = 'pending' WHERE "walletAddress" IS NULL OR "walletAddress" = '';




