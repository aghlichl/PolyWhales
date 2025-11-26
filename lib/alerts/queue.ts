import Redis from "ioredis";
import { AlertEvent } from "./types";

export class AlertQueue {
    private redis: Redis;
    private queueKey = "alerts:queue";

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || "redis://localhost:6379", {
            db: 0, // Force DB 0 for compatibility
            maxRetriesPerRequest: 3
        });
    }

    async enqueueAlert(event: AlertEvent): Promise<void> {
        try {
            await this.redis.lpush(this.queueKey, JSON.stringify(event));
        } catch (error) {
            console.error("[AlertQueue] Error enqueueing alert:", error);
        }
    }

    async processQueue(handler: (event: AlertEvent) => Promise<void>): Promise<void> {
        console.log("[AlertQueue] Starting processor...");

        while (true) {
            try {
                // Blocking pop, waits indefinitely for an item
                const result = await this.redis.brpop(this.queueKey, 0);

                if (result && result.length === 2) {
                    const [, data] = result;
                    const event = JSON.parse(data) as AlertEvent;

                    // Restore timestamp as Date object
                    event.timestamp = new Date(event.timestamp);

                    await handler(event);
                }
            } catch (error) {
                console.error("[AlertQueue] Error processing alert:", error);
                // Wait a bit before retrying to avoid tight loop on error
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}
