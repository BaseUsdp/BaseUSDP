/**
 * Solana RPC Rate Limiter
 * 
 * Official Solana Public RPC Limits:
 * - 100 requests per 10 seconds per IP (average 10 RPS)
 * - 40 requests per 10 seconds per IP for the same RPC method (average 4 RPS per method)
 * - 40 concurrent connections per IP
 * - 100 MB per 30 seconds data transfer
 * 
 * This rate limiter ensures we stay within these limits.
 */

interface RequestRecord {
  timestamp: number;
  method?: string; // RPC method name (e.g., 'getBalance', 'sendRawTransaction')
}

class RPCRateLimiter {
  private requestHistory: RequestRecord[] = [];
  private readonly windowMs = 10000; // 10 seconds
  private readonly maxRequestsPerWindow = 100; // Total requests per 10 seconds
  private readonly maxRequestsPerMethod = 40; // Same method per 10 seconds
  private readonly minDelayBetweenRequests = 100; // 100ms minimum (10 RPS max)
  private readonly minDelayBetweenSameMethod = 250; // 250ms minimum (4 RPS max per method)
  private lastRequestTime = 0;
  private lastMethodRequestTime: Map<string, number> = new Map();

  /**
   * Wait if necessary to respect rate limits
   * @param method Optional RPC method name (e.g., 'getBalance', 'sendRawTransaction')
   */
  async waitIfNeeded(method?: string): Promise<void> {
    const now = Date.now();

    // Clean up old requests outside the 10-second window
    this.requestHistory = this.requestHistory.filter(
      record => now - record.timestamp < this.windowMs
    );

    // Count requests in current window
    const requestsInWindow = this.requestHistory.length;
    const methodRequestsInWindow = method
      ? this.requestHistory.filter(r => r.method === method).length
      : 0;

    // Check if we're at the limit
    const atTotalLimit = requestsInWindow >= this.maxRequestsPerWindow;
    const atMethodLimit = method && methodRequestsInWindow >= this.maxRequestsPerMethod;

    // Calculate delays needed
    let delayNeeded = 0;

    // 1. Ensure minimum delay between any requests (100ms = 10 RPS max)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      delayNeeded = Math.max(delayNeeded, this.minDelayBetweenRequests - timeSinceLastRequest);
    }

    // 2. If at total limit, wait until oldest request expires
    if (atTotalLimit) {
      const oldestRequest = this.requestHistory[0];
      const timeUntilOldestExpires = this.windowMs - (now - oldestRequest.timestamp);
      delayNeeded = Math.max(delayNeeded, timeUntilOldestExpires);
    }

    // 3. If at method limit, wait until oldest method request expires
    if (atMethodLimit && method) {
      const oldestMethodRequest = this.requestHistory.find(r => r.method === method);
      if (oldestMethodRequest) {
        const timeUntilMethodExpires = this.windowMs - (now - oldestMethodRequest.timestamp);
        delayNeeded = Math.max(delayNeeded, timeUntilMethodExpires);
      }
    }

    // 4. Ensure minimum delay between same method requests (250ms = 4 RPS max per method)
    if (method) {
      const lastMethodRequestTime = this.lastMethodRequestTime.get(method) || 0;
      const timeSinceLastMethodRequest = now - lastMethodRequestTime;
      if (timeSinceLastMethodRequest < this.minDelayBetweenSameMethod) {
        delayNeeded = Math.max(delayNeeded, this.minDelayBetweenSameMethod - timeSinceLastMethodRequest);
      }
    }

    // Wait if needed
    if (delayNeeded > 0) {
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    // Record this request
    const adjustedNow = Date.now();
    this.requestHistory.push({
      timestamp: adjustedNow,
      method,
    });
    this.lastRequestTime = adjustedNow;
    if (method) {
      this.lastMethodRequestTime.set(method, adjustedNow);
    }
  }

  /**
   * Get current request counts (for debugging)
   */
  getStats(): {
    totalRequestsInWindow: number;
    methodRequestsInWindow: Map<string, number>;
    oldestRequestAge: number;
  } {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(
      record => now - record.timestamp < this.windowMs
    );

    const methodCounts = new Map<string, number>();
    recentRequests.forEach(record => {
      if (record.method) {
        methodCounts.set(record.method, (methodCounts.get(record.method) || 0) + 1);
      }
    });

    const oldestRequest = this.requestHistory[0];
    const oldestRequestAge = oldestRequest ? now - oldestRequest.timestamp : 0;

    return {
      totalRequestsInWindow: recentRequests.length,
      methodRequestsInWindow: methodCounts,
      oldestRequestAge,
    };
  }
}

// Singleton instance
let rateLimiterInstance: RPCRateLimiter | null = null;

export function getRPCRateLimiter(): RPCRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RPCRateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Extract RPC method name from operation (for tracking)
 * This is a best-effort attempt to identify the method
 */
export function extractRPCMethod(operation: () => Promise<any>): string | undefined {
  // Try to extract method name from function/operation
  // This is a simplified approach - in practice, you'd need to wrap Connection methods
  const funcStr = operation.toString();
  
  // Common Solana RPC methods
  if (funcStr.includes('getBalance')) return 'getBalance';
  if (funcStr.includes('getAccount')) return 'getAccount';
  if (funcStr.includes('getLatestBlockhash')) return 'getLatestBlockhash';
  if (funcStr.includes('sendRawTransaction')) return 'sendRawTransaction';
  if (funcStr.includes('confirmTransaction')) return 'confirmTransaction';
  if (funcStr.includes('getSignatureStatus')) return 'getSignatureStatus';
  if (funcStr.includes('getSignaturesForAddress')) return 'getSignaturesForAddress';
  if (funcStr.includes('getTransaction')) return 'getTransaction';
  if (funcStr.includes('getTokenAccountBalance')) return 'getTokenAccountBalance';
  
  return undefined;
}
