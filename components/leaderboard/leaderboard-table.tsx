"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaderboardTimeframe } from "@/app/actions/leaderboard";

// Types matching the server action result
type Position = {
    id: string;
    marketTitle: string | null;
    outcome: string | null;
    size: number;
    avgPrice: number;
    curPrice: number;
    percentPnl: number;
    cashPnl: number;
    marketSlug: string | null;
};

type LeaderboardRow = {
    id: string;
    rank: number;
    accountName: string | null;
    walletAddress: string;
    totalPnl: number;
    totalVolume: number;
    positions: Position[];
};

interface LeaderboardTableProps {
    data: LeaderboardRow[];
    currentTimeframe: LeaderboardTimeframe;
}

export function LeaderboardTable({ data, currentTimeframe }: LeaderboardTableProps) {
    const router = useRouter();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const handleTabChange = (value: string) => {
        router.push(`/leaderboard?timeframe=${value}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Whale Leaderboard</h1>
                <Tabs value={currentTimeframe} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="Daily">Daily</TabsTrigger>
                        <TabsTrigger value="Weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="Monthly">Monthly</TabsTrigger>
                        <TabsTrigger value="All Time">All Time</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Performers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Rank</TableHead>
                                    <TableHead>Trader</TableHead>
                                    <TableHead className="text-right">PnL</TableHead>
                                    <TableHead className="text-right">Volume</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No data available for this timeframe.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((row) => (
                                        <>
                                            <TableRow
                                                key={row.id}
                                                className={cn(
                                                    "cursor-pointer transition-colors hover:bg-muted/50",
                                                    expandedRows.has(row.id) && "bg-muted/50"
                                                )}
                                                onClick={() => toggleRow(row.id)}
                                            >
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                                                row.rank === 1 && "bg-yellow-500/20 text-yellow-500",
                                                                row.rank === 2 && "bg-zinc-400/20 text-zinc-400",
                                                                row.rank === 3 && "bg-amber-700/20 text-amber-700",
                                                                row.rank > 3 && "bg-muted text-muted-foreground"
                                                            )}
                                                        >
                                                            {row.rank}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {row.accountName || "Unknown Whale"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {row.walletAddress.slice(0, 6)}...
                                                            {row.walletAddress.slice(-4)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className={cn("text-right font-mono", row.totalPnl >= 0 ? "text-green-500" : "text-red-500")}>
                                                    {row.totalPnl >= 0 ? "+" : ""}
                                                    ${row.totalPnl.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    ${row.totalVolume.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {expandedRows.has(row.id) ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {expandedRows.has(row.id) && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={5} className="p-4">
                                                        <div className="rounded-md border bg-background p-4">
                                                            <h4 className="mb-4 text-sm font-semibold text-muted-foreground">
                                                                Top Positions
                                                            </h4>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Market</TableHead>
                                                                        <TableHead>Outcome</TableHead>
                                                                        <TableHead className="text-right">Size</TableHead>
                                                                        <TableHead className="text-right">Entry</TableHead>
                                                                        <TableHead className="text-right">Current</TableHead>
                                                                        <TableHead className="text-right">PnL</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {row.positions.length === 0 ? (
                                                                        <TableRow>
                                                                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                                                No active positions found.
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ) : (
                                                                        row.positions.map((pos) => (
                                                                            <TableRow key={pos.id}>
                                                                                <TableCell className="max-w-[200px]">
                                                                                    <a
                                                                                        href={`https://polymarket.com/event/${pos.marketSlug}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="flex items-center gap-1 truncate hover:underline"
                                                                                    >
                                                                                        {pos.marketTitle || "Unknown Market"}
                                                                                        <ExternalLink className="h-3 w-3 opacity-50" />
                                                                                    </a>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Badge variant="outline" className="font-mono">
                                                                                        {pos.outcome}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-mono">
                                                                                    {pos.size.toLocaleString()}
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-mono">
                                                                                    {pos.avgPrice.toFixed(2)}¢
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-mono">
                                                                                    {pos.curPrice.toFixed(2)}¢
                                                                                </TableCell>
                                                                                <TableCell className={cn("text-right font-mono", pos.percentPnl >= 0 ? "text-green-500" : "text-red-500")}>
                                                                                    {pos.percentPnl >= 0 ? "+" : ""}
                                                                                    {pos.percentPnl.toFixed(1)}%
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
