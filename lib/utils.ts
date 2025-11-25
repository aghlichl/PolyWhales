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
    // Profit when price goes up
    return tradeValue * (currentPriceDecimal - betPrice) / betPrice;
  } else {
    // Profit when price goes down (SELL position)
    return tradeValue * (betPrice - currentPriceDecimal) / betPrice;
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
