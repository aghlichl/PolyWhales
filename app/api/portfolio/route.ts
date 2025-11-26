import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchPortfolio } from '@/lib/gamma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const walletAddress = address.toLowerCase();

    try {
        // 1. Check for fresh snapshot in DB (last 5 mins)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingSnapshot = await prisma.walletPortfolioSnapshot.findFirst({
            where: {
                walletAddress,
                timestamp: {
                    gt: fiveMinutesAgo,
                },
            },
            orderBy: {
                timestamp: 'desc',
            },
        });

        if (existingSnapshot) {
            return NextResponse.json(existingSnapshot);
        }

        // 2. If no fresh snapshot, fetch from Gamma
        const portfolio = await fetchPortfolio(walletAddress);

        if (!portfolio) {
            // If we have an old snapshot, return it as fallback?
            // Or just return 404 if we really can't get data.
            // Let's check for ANY snapshot
            const oldSnapshot = await prisma.walletPortfolioSnapshot.findFirst({
                where: { walletAddress },
                orderBy: { timestamp: 'desc' },
            });

            if (oldSnapshot) {
                return NextResponse.json({ ...oldSnapshot, isStale: true });
            }

            return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
        }

        // 3. Save new snapshot
        // Ensure wallet profile exists first (foreign key constraint)
        // If it doesn't exist, we might need to create a dummy one or skip saving?
        // Usually we want to save it.

        // Upsert wallet profile to ensure it exists
        await prisma.walletProfile.upsert({
            where: { id: walletAddress },
            update: {},
            create: {
                id: walletAddress,
                totalPnl: portfolio.totalPnl,
                winRate: 0, // Unknown
            },
        });

        const newSnapshot = await prisma.walletPortfolioSnapshot.create({
            data: {
                walletAddress,
                totalValue: portfolio.totalValue,
                totalPnl: portfolio.totalPnl,
                positions: portfolio.positions as any,
                timestamp: new Date(),
            },
        });

        return NextResponse.json(newSnapshot);

    } catch (error) {
        console.error('[API] Error fetching portfolio:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
