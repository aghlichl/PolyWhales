import { NextResponse } from 'next/server';
import { fetchMarketsFromGamma } from '@/lib/polymarket';

export async function GET() {
    try {
        // Fetch markets from Gamma API via shared helper
        // Helper handles normalization and headers
        const markets = await fetchMarketsFromGamma({
            next: { revalidate: 60 } // Cache for 60 seconds
        });

        return NextResponse.json(markets);
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

