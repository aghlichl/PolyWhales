import { GammaPortfolio, GammaPosition } from './types';
import { CONFIG } from './config';

/**
 * Fetches portfolio positions from Gamma API
 * GET https://gamma-api.polymarket.com/portfolio?address={walletAddress}
 */
export async function fetchPortfolio(walletAddress: string): Promise<GammaPortfolio | null> {
    try {
        const url = `${CONFIG.URLS.GAMMA_API_PORTFOLIO}?address=${walletAddress}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OddsGods/1.0',
            }
        });

        if (!response.ok) {
            console.warn(`[Gamma] Failed to fetch portfolio for ${walletAddress}: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        // Normalize data to match our interface
        // Note: We need to verify the actual shape of Gamma response. 
        // Assuming it returns a list of positions or an object with positions.
        // Based on common patterns, let's assume it returns { positions: [], ... } or just []

        // For now, let's map what we expect. If the API shape is different, we'll adjust.
        // If data is array, it's likely positions.

        const rawPositions = Array.isArray(data) ? data : (data.positions || []);

        let totalValue = 0;
        let totalPnl = 0;

        const positions: GammaPosition[] = rawPositions.map((pos: any) => {
            const size = Number(pos.size || 0);
            const price = Number(pos.price || 0);
            const value = size * price;
            const avgPrice = Number(pos.avgPrice || pos.avg_price || 0);
            const pnl = (price - avgPrice) * size;

            totalValue += value;
            totalPnl += pnl;

            return {
                asset_id: pos.asset_id || '',
                condition_id: pos.condition_id || '',
                question: pos.question || '',
                outcome: pos.outcome || '',
                outcomeLabel: pos.outcomeLabel || pos.outcome_label || '',
                market: pos.market || '',
                size,
                price,
                value,
                avgPrice,
                pnl,
                pnlPercent: avgPrice > 0 ? (pnl / (avgPrice * size)) * 100 : 0,
                image: pos.image || ''
            };
        });

        return {
            address: walletAddress,
            totalValue,
            totalPnl,
            totalPnlPercent: totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0,
            positions
        };

    } catch (error) {
        console.error(`[Gamma] Error fetching portfolio for ${walletAddress}:`, error);
        return null;
    }
}
