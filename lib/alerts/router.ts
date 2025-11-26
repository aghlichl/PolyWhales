import { prisma } from "../prisma";
import { AlertEvent, NotificationTransport, UserWithSettings } from "./types";
import { DiscordTransport } from "./transports/discord";

export class NotificationRouter {
    private transports: NotificationTransport[] = [];

    constructor() {
        // Register transports
        this.transports.push(new DiscordTransport());
        // Future: Add SMS, Telegram, etc.
    }

    async route(event: AlertEvent): Promise<void> {
        console.log(`[NotificationRouter] Routing event: ${event.type} - ${event.title}`);

        try {
            // Find users who should receive this alert
            const users = await this.findRecipients(event);

            console.log(`[NotificationRouter] Found ${users.length} recipients`);

            // Send to each user via appropriate transports
            await Promise.all(users.map(user => this.sendToUser(user, event)));
        } catch (error) {
            console.error("[NotificationRouter] Error routing alert:", error);
        }
    }

    private async findRecipients(event: AlertEvent): Promise<UserWithSettings[]> {
        // 1. Base query: Users who have alert settings
        // 2. Filter by AlertType matches
        // 3. Filter by specific subscriptions (Wallet, Market) if applicable

        // Note: In a high-scale system, we would cache these subscriptions or use a more optimized query/index.
        // For now, we query Prisma.

        const whereClause: any = {
            alertSettings: {
                isNot: null,
                // Check if user has enabled this alert type
                alertTypes: {
                    has: event.type
                }
            }
        };

        // If event is specific to a wallet, check if user is subscribed to it
        if (event.walletAddress) {
            // We want users who subscribe to this wallet OR have global alerts (if we had a global flag, but here we assume explicit subscription for now)
            // Actually, let's refine: 
            // If it's a WHALE_MOVEMENT, maybe they want ALL whales? 
            // For now, let's assume strict subscription matching if walletAddress is present in the event AND the user has a non-empty wallet list.
            // But to keep it simple: We find users where 'wallets' array contains the address OR 'wallets' is empty (implying all? No, usually explicit).

            // Let's go with: Users must have the wallet in their list OR the list is empty (maybe meaning "all" is too dangerous).
            // Let's stick to explicit subscriptions for now as per requirements "subscriptions {wallets[], markets[]}"

            whereClause.alertSettings.wallets = {
                has: event.walletAddress
            };
        }

        // Similar logic for markets
        if (event.marketId) {
            whereClause.alertSettings.markets = {
                has: event.marketId
            };
        }

        // However, Prisma doesn't easily support "OR" inside the related record filter combined with arrays in this specific way without complex raw queries or multiple queries.
        // Let's simplify: Fetch all users with the AlertType, then filter in memory for the MVP.
        // This is safer and easier to implement correctly for "User alert settings match the event".

        const users = await prisma.user.findMany({
            where: {
                alertSettings: {
                    is: {
                        alertTypes: {
                            has: event.type
                        }
                    }
                }
            },
            include: {
                alertSettings: true
            }
        });

        // In-memory filter for specific subscriptions
        return users.filter(user => {
            const settings = user.alertSettings!;

            // If event has a wallet, user must be watching it
            if (event.walletAddress && settings.wallets.length > 0) {
                if (!settings.wallets.includes(event.walletAddress)) {
                    return false;
                }
            }

            // If event has a market, user must be watching it
            if (event.marketId && settings.markets.length > 0) {
                if (!settings.markets.includes(event.marketId)) {
                    return false;
                }
            }

            return true;
        });
    }

    private async sendToUser(user: UserWithSettings, event: AlertEvent): Promise<void> {
        // Try all transports
        // In reality, we might check user preferences for WHICH transport to use for WHICH alert.
        // For now, we just try to send to all configured channels.

        const promises = this.transports.map(transport => transport.send(user, event));
        await Promise.all(promises);
    }
}
