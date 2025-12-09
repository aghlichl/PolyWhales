import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

export function calculatePositionPL(
  tradeValue: number,
  betOdds: number,
  currentPrice: number,
  side: 'BUY' | 'SELL'
): number {
  // Convert cents to decimal (45¢ = 0.45)
  const betPrice = betOdds / 100;
  const currentPriceDecimal = currentPrice / 100;

  if (side === 'BUY') {
    // Long position: Profit = (Current Price - Entry Price) / Entry Price
    if (betPrice === 0) return 0;
    return tradeValue * (currentPriceDecimal - betPrice) / betPrice;
  } else {
    // Short position (SELL): Effectively "Buying No"
    // Entry Price for "No" = 1 - Entry Price for "Yes"
    // Current Price for "No" = 1 - Current Price for "Yes"
    const entryPriceNo = 1 - betPrice;
    const currentPriceNo = 1 - currentPriceDecimal;

    if (entryPriceNo === 0) return 0;

    // Profit = (Current "No" Price - Entry "No" Price) / Entry "No" Price
    //        = ((1 - Current Yes) - (1 - Entry Yes)) / (1 - Entry Yes)
    //        = (Entry Yes - Current Yes) / (1 - Entry Yes)
    return tradeValue * (currentPriceNo - entryPriceNo) / entryPriceNo;
  }
}

export function formatCurrency(num: number): string {
  const absNum = Math.abs(num);
  let formatted: string;

  if (absNum >= 1000000) {
    formatted = `$${(absNum / 1000000).toFixed(2)}M`;
  } else if (absNum >= 1000) {
    formatted = `$${(absNum / 1000).toFixed(1)}K`;
  } else {
    formatted = `$${absNum.toFixed(0)}`;
  }

  return num < 0 ? `-${formatted}` : `+${formatted}`;
}

export const EXPIRY_GRACE_MS = 5 * 60 * 1000;

const toTimestamp = (value?: string | Date | null): number | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  const parsed = new Date(value);
  const ts = parsed.getTime();
  return Number.isNaN(ts) ? null : ts;
};

export function isMarketExpired(
  closeTime?: string | Date | null,
  resolutionTime?: string | Date | null,
  graceMs: number = EXPIRY_GRACE_MS,
  nowMs: number = Date.now()
): boolean {
  const candidateTs = toTimestamp(resolutionTime) ?? toTimestamp(closeTime);
  if (candidateTs === null) return false;
  return candidateTs < (nowMs - graceMs);
}
