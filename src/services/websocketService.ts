/**
 * WebSocket service for real-time transaction status updates.
 *
 * Establishes a persistent connection to the BASEUSDP backend and
 * dispatches transaction lifecycle events to subscribed listeners.
 */

export type TransactionStatus =
  | "pending"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

export interface TransactionUpdate {
  txHash: string;
  status: TransactionStatus;
  confirmations: number;
  timestamp: number;
  error?: string;
}

type StatusCallback = (update: TransactionUpdate) => void;

interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  url: "",
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
};

class TransactionWebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private subscribers: Map<string, Set<StatusCallback>> = new Map();
  private globalSubscribers: Set<StatusCallback> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private pendingSubscriptions: Set<string> = new Set();

  constructor(config: WebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Open the WebSocket connection. Safe to call multiple times —
   * subsequent calls are no-ops while a connection is active.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.config.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Gracefully close the connection and clean up all timers.
   */
  disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  /**
   * Subscribe to status updates for a specific transaction hash.
   * Returns an unsubscribe function.
   */
  subscribe(txHash: string, callback: StatusCallback): () => void {
    if (!this.subscribers.has(txHash)) {
      this.subscribers.set(txHash, new Set());
    }
    this.subscribers.get(txHash)!.add(callback);

    // Tell the server to watch this transaction
    this.sendSubscription(txHash);

    return () => {
      const subs = this.subscribers.get(txHash);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(txHash);
          this.sendUnsubscription(txHash);
        }
      }
    };
  }

  /**
   * Subscribe to all transaction updates (useful for dashboards).
   * Returns an unsubscribe function.
   */
  subscribeAll(callback: StatusCallback): () => void {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  /**
   * Check whether the WebSocket connection is currently open.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Internal handlers ───────────────────────────────────────────

  private handleOpen(): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // Re-subscribe any transactions that were registered before the
    // connection was ready (or after a reconnect).
    for (const txHash of this.subscribers.keys()) {
      this.sendSubscription(txHash);
    }

    for (const txHash of this.pendingSubscriptions) {
      this.sendSubscription(txHash);
    }
    this.pendingSubscriptions.clear();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "pong") return; // heartbeat response

      if (data.type === "tx_update") {
        const update: TransactionUpdate = {
          txHash: data.txHash,
          status: data.status,
          confirmations: data.confirmations ?? 0,
          timestamp: data.timestamp ?? Date.now(),
          error: data.error,
        };

        this.notifySubscribers(update);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private handleClose(event: CloseEvent): void {
    this.isConnecting = false;
    this.clearTimers();

    // Only reconnect on abnormal closure
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(): void {
    // The close handler will fire next and handle reconnection
  }

  // ── Reconnection ───────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      return;
    }

    const backoff = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, backoff);
  }

  // ── Heartbeat ──────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.config.heartbeatInterval);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private sendSubscription(txHash: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", txHash }));
    } else {
      this.pendingSubscriptions.add(txHash);
    }
  }

  private sendUnsubscription(txHash: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "unsubscribe", txHash }));
    }
    this.pendingSubscriptions.delete(txHash);
  }

  private notifySubscribers(update: TransactionUpdate): void {
    const subs = this.subscribers.get(update.txHash);
    if (subs) {
      for (const cb of subs) cb(update);
    }
    for (const cb of this.globalSubscribers) cb(update);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ── Singleton instance ──────────────────────────────────────────

let instance: TransactionWebSocketService | null = null;

export function getTransactionWebSocket(): TransactionWebSocketService {
  if (!instance) {
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/transactions`;

    instance = new TransactionWebSocketService({ url: wsUrl });
  }
  return instance;
}

export default TransactionWebSocketService;
