import { NotificationTransport, AlertEvent, UserWithSettings } from "../types";

export class DiscordTransport implements NotificationTransport {
    name = "discord";

    async send(user: UserWithSettings, event: AlertEvent): Promise<void> {
        const webhookUrl = user.alertSettings?.discordWebhook;

        if (!webhookUrl) {
            return;
        }

        try {
            const payload = this.formatPayload(event);

            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error(`[DiscordTransport] Failed to send alert to user ${user.id}: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`[DiscordTransport] Error sending alert to user ${user.id}:`, error);
        }
    }

    private formatPayload(event: AlertEvent) {
        // Basic Discord webhook payload
        // Can be enhanced with embeds later
        return {
            content: null,
            embeds: [
                {
                    title: event.title,
                    description: event.description,
                    color: this.getColorForEventType(event.type),
                    timestamp: event.timestamp.toISOString(),
                    fields: Object.entries(event.data).map(([key, value]) => ({
                        name: key,
                        value: String(value),
                        inline: true,
                    })).slice(0, 25), // Discord limit
                    footer: {
                        text: "OddsGods Alert System",
                    },
                },
            ],
        };
    }

    private getColorForEventType(type: string): number {
        switch (type) {
            case "WHALE_MOVEMENT":
                return 0x3498db; // Blue
            case "MARKET_SPIKE":
                return 0xe74c3c; // Red
            case "SMART_MONEY_ENTRY":
                return 0x2ecc71; // Green
            default:
                return 0x95a5a6; // Gray
        }
    }
}
