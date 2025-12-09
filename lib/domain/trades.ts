import { CONFIG } from '../config';
import { Anomaly, AnomalyType, EnrichedTrade } from '../types';

export const TRADE_THRESHOLDS = CONFIG.THRESHOLDS;

export type TradeClassification = {
  value: number;
  type: AnomalyType;
  whaleTags: string[];
  isWhale: boolean;
  isMegaWhale: boolean;
  isSuperWhale: boolean;
  isGodWhale: boolean;
};

export function deriveAnomalyType(value: number): AnomalyType {
  if (value >= CONFIG.THRESHOLDS.GOD_WHALE) return 'GOD_WHALE';
  if (value >= CONFIG.THRESHOLDS.SUPER_WHALE) return 'SUPER_WHALE';
  if (value >= CONFIG.THRESHOLDS.MEGA_WHALE) return 'MEGA_WHALE';
  if (value >= CONFIG.THRESHOLDS.WHALE) return 'WHALE';
  return 'STANDARD';
}

export function deriveWhaleTags(value: number): string[] {
  const tags: string[] = [];
  if (value >= CONFIG.THRESHOLDS.GOD_WHALE) tags.push('GOD_WHALE');
  if (value >= CONFIG.THRESHOLDS.SUPER_WHALE) tags.push('SUPER_WHALE');
  if (value >= CONFIG.THRESHOLDS.MEGA_WHALE) tags.push('MEGA_WHALE');
  if (value >= CONFIG.THRESHOLDS.WHALE) tags.push('WHALE');
  return tags;
}

export function classifyTradeValue(value: number): TradeClassification {
  const whaleTags = deriveWhaleTags(value);
  return {
    value,
    type: deriveAnomalyType(value),
    whaleTags,
    isWhale: whaleTags.includes('WHALE'),
    isMegaWhale: whaleTags.includes('MEGA_WHALE'),
    isSuperWhale: whaleTags.includes('SUPER_WHALE'),
    isGodWhale: whaleTags.includes('GOD_WHALE'),
  };
}

type AnalysisTagOptions = {
  value: number;
  isSmartMoney?: boolean;
  isFresh?: boolean;
  isSweeper?: boolean;
  isInsider?: boolean;
  additionalTags?: string[];
};

export function buildAnalysisTags(options: AnalysisTagOptions): string[] {
  const {
    value,
    isSmartMoney = false,
    isFresh = false,
    isSweeper = false,
    isInsider = false,
    additionalTags = [],
  } = options;

  const tags = [
    ...deriveWhaleTags(value),
    isSmartMoney && 'SMART_MONEY',
    isFresh && 'FRESH_WALLET',
    isSweeper && 'SWEEPER',
    isInsider && 'INSIDER',
    ...additionalTags,
  ].filter(Boolean) as string[];

  return Array.from(new Set(tags));
}

export function computeLiquidityBucket(liquidity?: number | null): string | null {
  if (liquidity === null || liquidity === undefined || Number.isNaN(liquidity)) return null;
  if (liquidity >= 50000) return '50k+';
  if (liquidity >= 25000) return '25k-50k';
  if (liquidity >= 10000) return '10k-25k';
  if (liquidity >= 5000) return '5k-10k';
  return '<5k';
}

const TIME_TO_CLOSE_GRACE_MS = 5 * 60 * 1000; // grace to avoid early expiration

export function computeTimeToCloseBucket(closeTimeIso?: string | null): string | null {
  if (!closeTimeIso) return null;
  const closeDate = new Date(closeTimeIso);
  if (Number.isNaN(closeDate.getTime())) return null;
  const diffMs = closeDate.getTime() - Date.now() + TIME_TO_CLOSE_GRACE_MS;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'closed';
  if (diffDays <= 1) return '<24h';
  if (diffDays <= 7) return '1-7d';
  if (diffDays <= 30) return '7-30d';
  return '>30d';
}

function anomalyTypeFromTags(tags?: string[]): AnomalyType | null {
  if (!tags) return null;
  if (tags.includes('GOD_WHALE')) return 'GOD_WHALE';
  if (tags.includes('SUPER_WHALE')) return 'SUPER_WHALE';
  if (tags.includes('MEGA_WHALE')) return 'MEGA_WHALE';
  if (tags.includes('WHALE')) return 'WHALE';
  return null;
}

function normalizeTimestamp(raw: EnrichedTrade['trade']['timestamp']): number | null {
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string' || typeof raw === 'number') {
    const date = new Date(raw);
    const ts = date.getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

export function enrichedTradeToAnomaly(enrichedTrade: EnrichedTrade): Anomaly | null {
  const walletContext = enrichedTrade.analysis?.wallet_context;
  if (!walletContext?.address) return null;

  const timestamp = normalizeTimestamp(enrichedTrade.trade.timestamp);
  if (!timestamp) return null;

  const marketContext = enrichedTrade.analysis?.market_context;
  const eventContext = enrichedTrade.analysis?.event;
  const crowding = enrichedTrade.analysis?.crowding;
  const tags = enrichedTrade.analysis?.tags ?? [];

  const typeFromTags = anomalyTypeFromTags(tags);
  const value = enrichedTrade.trade.tradeValue;
  const classification = classifyTradeValue(value);

  return {
    id: `${enrichedTrade.trade.assetId}_${timestamp}`,
    type: typeFromTags || classification.type,
    event: enrichedTrade.market.question,
    outcome: enrichedTrade.market.outcome,
    odds: enrichedTrade.market.odds,
    value,
    timestamp,
    side: enrichedTrade.trade.side as 'BUY' | 'SELL',
    image: enrichedTrade.market.image,
    category: marketContext?.category ?? null,
    sport: marketContext?.sport ?? null,
    league: marketContext?.league ?? null,
    feeBps: marketContext?.feeBps ?? null,
    liquidity: marketContext?.liquidity ?? null,
    volume24h: marketContext?.volume24h ?? null,
    closeTime: marketContext?.closeTime || null,
    openTime: marketContext?.openTime || null,
    resolutionTime: marketContext?.resolutionTime || null,
    resolutionSource: marketContext?.resolutionSource || null,
    denominationToken: marketContext?.denominationToken || null,
    liquidity_bucket: marketContext?.liquidity_bucket || null,
    time_to_close_bucket: marketContext?.time_to_close_bucket || null,
    eventId: eventContext?.id || null,
    eventTitle: eventContext?.title || null,
    tags,
    crowding,
    wallet_context: {
      address: walletContext.address,
      label: walletContext.label || `${walletContext.address.slice(0, 6)}...${walletContext.address.slice(-4)}`,
      pnl_all_time: walletContext.pnl_all_time || '...',
      win_rate: walletContext.win_rate || '...',
      is_fresh_wallet: walletContext.is_fresh_wallet || false,
    },
    trader_context: enrichedTrade.analysis.trader_context,
    market_impact: enrichedTrade.analysis.market_impact,
    analysis: {
      tags,
      event: eventContext,
      market_context: marketContext,
      crowding,
    },
  };
}
