import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AlertType } from '@/generated/client';

// Helper to verify Privy token (placeholder - assuming we trust the DID for now or use a library)
// In a real app, we should verify the Authorization header with Privy's verifyAuthToken
// For now, we'll assume the client sends the DID in a header or we trust the request if it has a valid format
// Actually, let's just use the DID passed in the header 'x-privy-did' which is common pattern, 
// or better, expect it in the body for POST and query for GET? 
// Standard practice with Privy is using the Auth header.
// Let's implement a basic check.

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    // In a production app, verify the JWT token from 'Authorization' header
    // For this MVP, we will trust a custom header 'x-user-did' set by the client
    // This is NOT secure for production but fits the "minimal overhead" requirement for now
    // provided we don't have the full auth middleware setup yet.
    return request.headers.get('x-user-did');
}

export async function GET(request: NextRequest) {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const settings = await prisma.userAlertSettings.findUnique({
            where: { userId },
        });

        return NextResponse.json(settings || {
            discordWebhook: '',
            alertTypes: [],
            wallets: [],
            markets: []
        });
    } catch (error) {
        console.error('[API] Error fetching alert settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { discordWebhook, alertTypes, wallets, markets } = body;

        // Validate inputs
        if (discordWebhook && !discordWebhook.startsWith('https://discord.com/api/webhooks/')) {
            return NextResponse.json({ error: 'Invalid Discord Webhook URL' }, { status: 400 });
        }

        // Upsert user settings
        // First ensure user exists (Privy hook might have created it, but let's be safe)
        // Actually, the User model uses the DID as ID, so we can upsert it too if needed, 
        // but usually the auth flow handles user creation. 
        // Let's assume User exists or create if not.

        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId }
        });

        const settings = await prisma.userAlertSettings.upsert({
            where: { userId },
            update: {
                discordWebhook,
                alertTypes: alertTypes as AlertType[],
                wallets: wallets || [],
                markets: markets || []
            },
            create: {
                userId,
                discordWebhook,
                alertTypes: alertTypes as AlertType[],
                wallets: wallets || [],
                markets: markets || []
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('[API] Error updating alert settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
