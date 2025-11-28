import { formatDiscordAlert } from "../lib/alerts/formatters";
import { EnrichedTrade } from "../lib/types";

const mockTrades: EnrichedTrade[] = [
    {
        type: "UNUSUAL_ACTIVITY",
        market: {
            question: "Kansas City Chiefs vs San Francisco 49ers?",
            outcome: "Kansas City Chiefs",
            conditionId: "0x123",
            odds: 54,
            image: "https://polymarket-upload.s3.us-east-2.amazonaws.com/nfl-shield.png"
        },
        trade: {
            assetId: "0xabc",
            size: 100000,
            side: "BUY",
            price: 0.54,
            tradeValue: 54000,
            timestamp: new Date()
        },
        analysis: {
            tags: ["GOD_WHALE", "SMART_MONEY"],
            wallet_context: {
                address: "0x7a23...4f91",
                label: "Smart Whale",
                pnl_all_time: "+$1,240,500",
                win_rate: "82%",
                is_fresh_wallet: false
            },
            market_impact: {
                swept_levels: 3,
                slippage_induced: "1.2%"
            },
            trader_context: {
                tx_count: 150,
                max_trade_value: 500000,
                activity_level: "HIGH"
            }
        }
    },
    {
        type: "UNUSUAL_ACTIVITY",
        market: {
            question: "Will Donald Trump win the 2024 Election?",
            outcome: "No",
            conditionId: "0x456",
            odds: 48,
            image: "https://polymarket-upload.s3.us-east-2.amazonaws.com/election.png"
        },
        trade: {
            assetId: "0xdef",
            size: 5000,
            side: "SELL",
            price: 0.48,
            tradeValue: 2400,
            timestamp: new Date()
        },
        analysis: {
            tags: ["WHALE"],
            wallet_context: {
                address: "0x1234...5678",
                label: "Degen",
                pnl_all_time: "-$5,000",
                win_rate: "45%",
                is_fresh_wallet: false
            },
            market_impact: {
                swept_levels: 0,
                slippage_induced: "0.1%"
            },
            trader_context: {
                tx_count: 10,
                max_trade_value: 5000,
                activity_level: "LOW"
            }
        }
    }
];

console.log("=== Testing Discord Alert Styles ===");

mockTrades.forEach((trade, i) => {
    console.log(`\n--- Trade ${i + 1} (${trade.analysis.tags.join(", ")}) ---`);
    const embed = formatDiscordAlert(trade);
    console.log(JSON.stringify(embed, null, 2));
});
