import { getLeaderboardData, LeaderboardTimeframe } from "@/app/actions/leaderboard";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";

export const dynamic = "force-dynamic";

interface LeaderboardPageProps {
    searchParams: Promise<{
        timeframe?: string;
    }>;
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
    const { timeframe } = await searchParams;
    const resolvedTimeframe = (timeframe || "Daily") as LeaderboardTimeframe;
    const data = await getLeaderboardData(resolvedTimeframe);

    return (
        <div className="container mx-auto py-10">
            <LeaderboardTable data={data} currentTimeframe={resolvedTimeframe} />
        </div>
    );
}
