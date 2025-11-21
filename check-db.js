import { prisma } from './lib/prisma.js';

async function checkDatabase() {
  try {
    console.log('=== Database Contents ===\n');

    // Check trades
    const tradeCount = await prisma.trade.count();
    console.log(`Trades: ${tradeCount}`);

    if (tradeCount > 0) {
      const trades = await prisma.trade.findMany({
        take: 5,
        include: { walletProfile: true }
      });
      console.log('Sample trades:', JSON.stringify(trades, null, 2));
    }

    // Check wallet profiles
    const profileCount = await prisma.walletProfile.count();
    console.log(`\nWallet Profiles: ${profileCount}`);

    if (profileCount > 0) {
      const profiles = await prisma.walletProfile.findMany({
        take: 5,
        include: { trades: { take: 2 } }
      });
      console.log('Sample profiles:', JSON.stringify(profiles, null, 2));
    }

    console.log('\n=== Database Schema ===');
    console.log('Tables should be: trades, wallet_profiles');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
