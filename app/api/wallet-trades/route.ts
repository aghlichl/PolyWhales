import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketMetadata, tradeToAnomaly } from "@/lib/polymarket";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletParam = searchParams.get("wallet") || searchParams.get("address");

    if (!walletParam) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const normalizedWallet = walletParam.toLowerCase();

    const limitParam = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const [trades, { marketsByCondition }] = await Promise.all([
      prisma.trade.findMany({
        where: {
          walletAddress: normalizedWallet,
          timestamp: { gte: since },
        },
        orderBy: { timestamp: "desc" },
        take: limit,
        include: { walletProfile: true },
      }),
      getMarketMetadata(),
    ]);

    const anomalies = trades.map((trade) => tradeToAnomaly(trade, { marketsByCondition }));

    return NextResponse.json({
      wallet: normalizedWallet,
      walletAddress: normalizedWallet,
      since: since.toISOString(),
      count: anomalies.length,
      trades: anomalies,
    });
  } catch (error) {
    console.error("[API] wallet-trades error:", error);
    return NextResponse.json(
      { error: "Failed to load wallet trades" },
      { status: 500 }
    );
  }
}

