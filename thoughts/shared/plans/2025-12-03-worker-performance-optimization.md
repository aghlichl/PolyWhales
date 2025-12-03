# Worker Performance Optimization Plan

## Overview

This plan outlines performance optimizations for the Polymarket Intelligence Worker (`server/worker.ts`) to improve throughput, reduce latency, and eliminate legacy code while maintaining real-time user experience. Based on analysis of the current implementation, we've identified several optimization opportunities that can reduce resource usage and improve reliability without degrading the user experience.

## Current State Analysis

The worker processes ~10-20 trades per second during peak market activity, with multiple database round trips and fixed-rate limiting that creates unnecessary bottlenecks. Redis is initialized but unused, and error handling silently masks some recoverable failures.

### Key Performance Issues Identified:

- **Unused Redis infrastructure**: Initialized but never used, wasting memory and connections
- **Fixed-rate limiting**: 200ms delays regardless of API load, creating artificial bottlenecks
- **Multiple DB round trips**: 2-3 separate database calls per trade enrichment
- **Memory accumulation**: No cleanup of Maps or connection pools
- **Silent error handling**: Some failures don't trigger proper recovery logic
- **Fixed batch processing**: 50-trade batches regardless of system capacity

## Desired End State

A lean, high-performance worker that:
- Processes trades with minimal latency while maintaining real-time UX
- Uses intelligent rate limiting instead of fixed delays
- Minimizes database round trips through batching
- Maintains stable memory usage
- Provides better observability for failures
- Adapts batch sizes based on system load

### Success Metrics:
- 30% reduction in average trade processing latency
- 50% reduction in database round trips per trade
- Stable memory usage under sustained load
- Zero functional regressions in real-time UI updates

## What We're NOT Doing

- Changing the real-time architecture (immediate UI updates + background enrichment)
- Modifying trade filtering logic or thresholds
- Removing any user-facing features or alert types
- Changing database schema or external API contracts

## Implementation Approach

We'll implement optimizations in phases, starting with low-risk legacy code removal and moving to more complex optimizations. Each phase includes automated testing to ensure no functional degradation.

## Phase 1: Legacy Code Removal

### Overview

Remove unused infrastructure and simplify the codebase for better maintainability.

### Changes Required:

#### 1. Remove Unused Redis Infrastructure

**File**: `server/worker.ts`

**Changes**: Remove Redis import, initialization, and cleanup code

```typescript
// REMOVE these lines:
import Redis from "ioredis";
// ...
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
// ...
await redis.quit();
```

**Impact**: Reduces memory usage by ~10MB and eliminates unnecessary connection overhead.

### Success Criteria:

#### Automated Verification:
- [ ] Worker starts without Redis dependency: `npm run dev:worker`
- [ ] No runtime errors during startup/shutdown
- [ ] Memory usage reduced by at least 5%

#### Manual Verification:
- [ ] All trade processing functionality works normally
- [ ] WebSocket connections remain stable
- [ ] No impact on real-time UI updates

---

## Phase 2: Rate Limiting Optimization

### Overview

Replace fixed delays with intelligent rate limiting that adapts to API response times and error rates.

### Changes Required:

#### 1. Implement Adaptive Rate Limiter

**File**: `server/worker.ts`

**Changes**: Replace fixed `delay()` calls with adaptive rate limiting

```typescript
// ADD: Smart rate limiter class
class AdaptiveRateLimiter {
  private lastRequestTime = 0;
  private errorCount = 0;
  private baseDelay = 200;

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const adaptiveDelay = Math.max(
      this.baseDelay,
      this.errorCount * 100,  // Increase delay on errors
      this.baseDelay - timeSinceLastRequest  // Don't wait if enough time passed
    );

    if (adaptiveDelay > 0) {
      await delay(adaptiveDelay);
    }

    this.lastRequestTime = Date.now();
  }

  recordError(): void {
    this.errorCount = Math.min(this.errorCount + 1, 5); // Cap at 5
  }

  recordSuccess(): void {
    this.errorCount = Math.max(this.errorCount - 1, 0); // Decay on success
  }
}

// REPLACE fixed delays:
const rateLimiter = new AdaptiveRateLimiter();
// Replace: await delay(CONFIG.ENRICHMENT.RATE_LIMIT_DELAY_MS);
// With: await rateLimiter.wait();
```

**File**: `server/worker.ts` (leaderboard scraping)

**Changes**: Apply adaptive rate limiting to leaderboard position fetching

```typescript
// In scrapeLeaderboard function, replace:
await delay(200);
// With:
await rateLimiter.wait();
```

### Success Criteria:

#### Automated Verification:
- [ ] Rate limiting still respects API limits (no 429 errors)
- [ ] Batch enrichment completes within expected timeframes
- [ ] Leaderboard scraping performance maintained

#### Manual Verification:
- [ ] No degradation in enrichment success rates
- [ ] API error rates remain stable or improve
- [ ] Real-time trade processing unaffected

---

## Phase 3: Database Operation Batching

### Overview

Combine multiple database operations per trade into fewer round trips to reduce latency.

### Changes Required:

#### 1. Batch Trade and Profile Updates

**File**: `server/worker.ts`

**Changes**: Combine wallet profile upsert and trade update into a single transaction

```typescript
// REPLACE separate DB calls in processTrade:
// Instead of separate:
// await prisma.walletProfile.upsert({...})
// await prisma.trade.update({...})

// USE batched transaction:
await prisma.$transaction(async (tx) => {
  await tx.walletProfile.upsert({
    where: { id: walletAddress.toLowerCase() },
    update: { /* ... profile updates ... */ },
    create: { /* ... profile creation ... */ }
  });

  await tx.trade.update({
    where: { id: dbTrade.id },
    data: { /* ... trade updates ... */ }
  });
});
```

#### 2. Optimize Alert User Queries

**File**: `server/worker.ts`

**Changes**: Cache user alert preferences to avoid repeated database queries

```typescript
// ADD: User preferences cache with TTL
const userAlertCache = new Map<string, { prefs: any; expires: number }>();

async function getUserAlertPreferences(alertType: string) {
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
  });

  userAlertCache.set(cacheKey, {
    prefs: users,
    expires: Date.now() + 5 * 60 * 1000  // 5 minute TTL
  });

  return users;
}

// REPLACE: const users = await prisma.user.findMany({...})
// WITH: const users = await getUserAlertPreferences(alertType);
```

### Success Criteria:

#### Automated Verification:
- [ ] Database connection pool usage reduced by 30%
- [ ] Average trade processing latency decreased by 20%
- [ ] Alert delivery remains reliable

#### Manual Verification:
- [ ] All trade enrichment data persists correctly
- [ ] Alert preferences update properly when changed
- [ ] No data consistency issues

---

## Phase 4: WebSocket and Message Processing Optimization

### Overview

Optimize WebSocket message parsing and reduce redundant operations.

### Changes Required:

#### 1. Streamline Message Processing

**File**: `server/worker.ts`

**Changes**: Pre-filter messages and reduce parsing overhead

```typescript
// OPTIMIZE WebSocket message handler:
ws.on("message", (data: WebSocket.Data) => {
  try {
    const parsed = JSON.parse(data.toString());

    // Early return for non-trade messages
    if (!parsed.event_type || !['last_trade_price', 'trade'].includes(parsed.event_type)) {
      return;
    }

    const trades = Array.isArray(parsed) ? parsed : [parsed];

    // Process only valid trades
    const validTrades = trades.filter((trade: any) =>
      trade.price && trade.size && trade.asset_id &&
      Number(trade.price) * Number(trade.size) >= CONFIG.THRESHOLDS.MIN_VALUE
    );

    validTrades.forEach((trade: PolymarketTrade) => {
      processTrade(trade).catch(console.error);
    });

  } catch (error) {
    // Only log actual parsing errors, not filtered messages
    console.warn("[Worker] Message parse error:", error);
  }
});
```

#### 2. Connection Resilience Improvements

**File**: `server/worker.ts`

**Changes**: Implement exponential backoff for reconnections

```typescript
// ADD: Exponential backoff for reconnections
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

function getReconnectDelay(): number {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  return delay;
}

function resetReconnectAttempts(): void {
  reconnectAttempts = 0;
}

// UPDATE connection error handler:
ws.on("close", () => {
  console.log('[Worker] WebSocket closed, reconnecting...');
  clearInterval(heartbeatInterval);
  setTimeout(connect, getReconnectDelay());
});

ws.on("open", () => {
  console.log("[Worker] Connected to Polymarket WebSocket");
  resetReconnectAttempts(); // Reset on successful connection
  // ... rest of open handler
});
```

### Success Criteria:

#### Automated Verification:
- [ ] WebSocket reconnection attempts use exponential backoff
- [ ] Message processing overhead reduced by 15%
- [ ] No increase in WebSocket error rates

#### Manual Verification:
- [ ] Real-time trade updates remain instantaneous
- [ ] Connection stability improved during network issues
- [ ] No missed trades during reconnections

---

## Phase 5: Memory and Resource Management

### Overview

Implement proper cleanup and prevent memory accumulation.

### Changes Required:

#### 1. Cache Size Management

**File**: `server/worker.ts`

**Changes**: Add bounds to caches and implement cleanup

```typescript
// ADD: Bounded cache with cleanup
class BoundedMap<K, V> extends Map<K, V> {
  private readonly maxSize: number;

  constructor(maxSize: number = 10000) {
    super();
    this.maxSize = maxSize;
  }

  set(key: K, value: V): this {
    if (this.size >= this.maxSize) {
      // Remove oldest 10% of entries
      const keysToDelete = Array.from(this.keys()).slice(0, Math.floor(this.maxSize * 0.1));
      keysToDelete.forEach(k => this.delete(k));
    }
    return super.set(key, value);
  }
}

// REPLACE unbounded Maps:
let marketsByCondition = new BoundedMap<string, MarketMeta>(5000);
let assetIdToOutcome = new BoundedMap<string, AssetOutcome>(10000);
```

#### 2. Periodic Cache Cleanup

**File**: `server/worker.ts`

**Changes**: Add periodic cleanup of expired cache entries

```typescript
// ADD: Cache cleanup interval
setInterval(() => {
  const now = Date.now();

  // Clean user alert cache
  for (const [key, value] of userAlertCache.entries()) {
    if (value.expires < now) {
      userAlertCache.delete(key);
    }
  }

  console.log(`[Worker] Cache cleanup: ${userAlertCache.size} alert prefs cached`);
}, 10 * 60 * 1000); // Every 10 minutes
```

### Success Criteria:

#### Automated Verification:
- [ ] Memory usage remains stable under 24-hour load testing
- [ ] Cache sizes don't exceed configured bounds
- [ ] No memory leaks in heap snapshots

#### Manual Verification:
- [ ] System remains responsive during extended operation
- [ ] No degradation in performance over time
- [ ] Cache hit rates remain above 80%

---

## Phase 6: Error Handling and Observability

### Overview

Improve error handling to provide better observability while maintaining system stability.

### Changes Required:

#### 1. Structured Error Logging

**File**: `server/worker.ts`

**Changes**: Add error categorization and metrics

```typescript
// ADD: Error tracking and metrics
const errorMetrics = {
  websocketErrors: 0,
  apiErrors: 0,
  dbErrors: 0,
  enrichmentFailures: 0,
  lastReset: Date.now()
};

function logError(category: keyof typeof errorMetrics, error: Error, context?: any): void {
  errorMetrics[category]++;

  console.error(`[${category.toUpperCase()}]`, {
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    count: errorMetrics[category]
  });
}

// REPLACE silent error handling:
// console.log(`[WORKER] Alert failed silently: ${(err as Error).message}`);
// WITH:
logError('apiErrors', err as Error, { alertType, userEmail: user.email });
```

#### 2. Health Check Endpoint

**File**: `server/worker.ts`

**Changes**: Add health check for monitoring

```typescript
// ADD: Health check endpoint
io.on("connection", (socket) => {
  socket.on("health", (callback) => {
    callback({
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      errorMetrics,
      activeConnections: io.engine.clientsCount,
      lastMetadataRefresh: marketsByCondition.size > 0 ? "recent" : "unknown"
    });
  });

  // ... existing connection handling
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Error metrics are collected and exposed
- [ ] Health check endpoint responds correctly
- [ ] No increase in error rates from improved logging

#### Manual Verification:
- [ ] Error patterns are identifiable in logs
- [ ] System remains stable during error conditions
- [ ] Monitoring can detect issues early

---

## Testing Strategy

### Unit Tests:
- Rate limiting behavior under various conditions
- Cache size management and cleanup
- Error categorization and metrics

### Integration Tests:
- End-to-end trade processing with optimizations
- WebSocket reconnection scenarios
- Database batching efficiency

### Performance Tests:
- Memory usage stability over 24 hours
- Trade processing throughput comparison
- Database connection pool utilization

### Manual Testing Steps:
1. Verify real-time UI updates remain instantaneous
2. Test system behavior during network interruptions
3. Confirm alert delivery during high-load periods
4. Validate data consistency after optimizations

## Performance Considerations

- **Memory**: Bounded caches prevent unbounded growth
- **CPU**: Reduced parsing overhead and smarter rate limiting
- **Network**: Fewer database round trips and optimized API calls
- **Reliability**: Better error handling and connection resilience

## Migration Notes

All optimizations are backward-compatible. The system will continue to function normally during the rollout, with improvements taking effect immediately upon deployment.

## References

- Original worker analysis: `thoughts/shared/research/2025-12-03-worker-analysis.md`
- Configuration file: `lib/config.ts`
- Related ticket: Performance optimization initiative
