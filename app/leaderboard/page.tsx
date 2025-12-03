import { getLeaderboardData, LeaderboardTimeframe } from "@/app/actions/leaderboard";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";

export const dynamic = "force-dynamic";

interface LeaderboardPageProps {
    searchParams: {
        timeframe?: string;
    };
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
    const timeframe = (searchParams.timeframe || "Daily") as LeaderboardTimeframe;
    const data = await getLeaderboardData(timeframe);

    return (
        <div className="container mx-auto py-10">
            <LeaderboardTable data={data} currentTimeframe={timeframe} />
        </div>
    );
}
