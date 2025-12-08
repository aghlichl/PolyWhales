const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class AdaptiveRateLimiter {
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
