import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const timePeriod = searchParams.get("timePeriod") || "day";

        // Get the most recent snapshot timestamp for this time period
        const latestSnapshot = await prisma.biggestWinner.findFirst({
            where: { timePeriod },
            orderBy: { snapshotAt: "desc" },
            select: { snapshotAt: true },
        });

        if (!latestSnapshot) {
            return NextResponse.json([]);
        }

        // Fetch all entries for that snapshot and time period
        const winners = await prisma.biggestWinner.findMany({
            where: {
                snapshotAt: latestSnapshot.snapshotAt,
                timePeriod,
            },
            orderBy: {
                winRank: "asc",
            },
        });

        return NextResponse.json(winners);
    } catch (error) {
        console.error("[API] Failed to fetch biggest winners:", error);
        return NextResponse.json(
            { error: "Failed to fetch biggest winners" },
            { status: 500 }
        );
    }
}
