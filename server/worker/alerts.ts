import fetch from "node-fetch";
import { prisma } from "../../lib/prisma";
import { formatDiscordAlert } from "../../lib/alerts/formatters";
import { EnrichedTrade } from "../../lib/types";

export type AlertType = "WHALE_MOVEMENT" | "SMART_MONEY_ENTRY";

type CachedAlertPrefs = {
  prefs: Awaited<ReturnType<typeof prisma.user.findMany>>;
  expires: number;
};

const userAlertCache = new Map<string, CachedAlertPrefs>();

export function clearExpiredAlertCache(now = Date.now()): void {
  for (const [key, value] of userAlertCache.entries()) {
    if (value.expires < now) {
      userAlertCache.delete(key);
    }
  }
}

export function getAlertCacheSize(): number {
  return userAlertCache.size;
}

export async function getUserAlertPreferences(alertType: AlertType) {
  const cacheKey = `alert_${alertType}`;
  const cached = userAlertCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.prefs;
  }

  const users = await prisma.user.findMany({
    where: {
      alertSettings: {
        is: { alertTypes: { has: alertType } }
      }
    },
    include: { alertSettings: true }
  }) as any[];

  userAlertCache.set(cacheKey, {
    prefs: users,
    expires: Date.now() + 5 * 60 * 1000  // 5 minute TTL
  });

  return users;
}

export async function sendDiscordAlert(trade: EnrichedTrade, alertType: AlertType) {
  const users = await getUserAlertPreferences(alertType);
  const embed = formatDiscordAlert(trade);
  const payload = {
    content: null,
    embeds: [embed]
  };

  await Promise.all(users.map(async (user) => {
    const webhookUrl = user.alertSettings?.discordWebhook;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.log(`[WORKER] Failed to send ${alertType} alert to user ${user.email}: ${(error as Error).message}`);
    }
  }));
}
