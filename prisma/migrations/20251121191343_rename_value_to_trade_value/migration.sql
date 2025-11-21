/*
  Warnings:

  - You are about to drop the column `value` on the `trades` table. All the data in the column will be lost.
  - Added the required column `tradeValue` to the `trades` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "trades" DROP COLUMN "value",
ADD COLUMN     "tradeValue" DOUBLE PRECISION NOT NULL;
