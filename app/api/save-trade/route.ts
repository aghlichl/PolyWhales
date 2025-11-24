import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SaveTradeRequest {
  assetId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  tradeValue: number;
  timestamp: number;
  walletAddress: string;
  type: 'STANDARD' | 'WHALE' | 'MEGA_WHALE' | 'SUPER_WHALE' | 'GOD_WHALE';
  conditionId?: string | null;
  outcome?: string;
  question?: string;
  image?: string;
}

export async function POST(request: Request) {
  try {
    const tradeData: SaveTradeRequest = await request.json();

    // Validate required fields
    if (!tradeData.assetId || !tradeData.walletAddress || !tradeData.side) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Skip if wallet address is empty
    if (!tradeData.walletAddress.trim()) {
      return NextResponse.json({ message: 'Skipped: empty wallet address' });
    }

    // Determine intelligence flags based on anomaly type
    const isWhale = tradeData.type !== 'STANDARD';
    const isSmartMoney = false; // Could be enhanced with more logic
    const isFresh = false; // Could be enhanced with wallet analysis
    const isSweeper = false; // Could be enhanced with more logic

    // Upsert wallet profile (create if doesn't exist)
    await prisma.walletProfile.upsert({
      where: { id: tradeData.walletAddress },
      update: {
        lastUpdated: new Date(),
      },
      create: {
        id: tradeData.walletAddress,
        label: null,
        totalPnl: 0,
        winRate: 0,
        isFresh: false,
        txCount: 0,
        maxTradeValue: tradeData.tradeValue,
        activityLevel: null,
        lastUpdated: new Date(),
      },
    });

    // Create trade record
    await prisma.trade.create({
      data: {
        assetId: tradeData.assetId,
        side: tradeData.side,
        size: tradeData.size,
        price: tradeData.price,
        tradeValue: tradeData.tradeValue,
        timestamp: new Date(tradeData.timestamp),
        walletAddress: tradeData.walletAddress,
        isWhale,
        isSmartMoney,
        isFresh,
        isSweeper,
        conditionId: tradeData.conditionId,
        outcome: tradeData.outcome,
        question: tradeData.question,
        image: tradeData.image,
      },
    });

    return NextResponse.json({ message: 'Trade saved successfully' });
  } catch (error) {
    console.error('[API] Error saving trade:', error);
    return NextResponse.json(
      { error: 'Failed to save trade' },
      { status: 500 }
    );
  }
}

