/**
 * WebSocket Message Type Definitions
 *
 * Types for real-time communication between the frontend
 * and the BASEUSDP backend via WebSocket.
 */

/** All possible WebSocket message types */
export type WSMessageType =
  | "subscribe"
  | "unsubscribe"
  | "tx_update"
  | "balance_update"
  | "price_update"
  | "notification"
  | "ping"
  | "pong"
  | "error"
  | "auth";

/** Base WebSocket message structure */
export interface WSMessage {
  type: WSMessageType;
  timestamp: number;
  id?: string;
}

/** Client → Server: Subscribe to transaction updates */
export interface WSSubscribeMessage extends WSMessage {
  type: "subscribe";
  channel: "transactions" | "balances" | "prices";
  params: {
    walletAddress?: string;
    txHash?: string;
    tokens?: string[];
  };
}

/** Client → Server: Unsubscribe from a channel */
export interface WSUnsubscribeMessage extends WSMessage {
  type: "unsubscribe";
  channel: "transactions" | "balances" | "prices";
}

/** Client → Server: Authentication */
export interface WSAuthMessage extends WSMessage {
  type: "auth";
  token: string;
}

/** Server → Client: Transaction status update */
export interface WSTxUpdateMessage extends WSMessage {
  type: "tx_update";
  data: {
    txHash: string;
    status: "pending" | "submitted" | "confirming" | "confirmed" | "failed";
    confirmations: number;
    blockNumber?: number;
    error?: string;
  };
}

/** Server → Client: Balance change notification */
export interface WSBalanceUpdateMessage extends WSMessage {
  type: "balance_update";
  data: {
    walletAddress: string;
    token: string;
    previousBalance: string;
    newBalance: string;
    change: string;
    txHash?: string;
  };
}

/** Server → Client: Token price update */
export interface WSPriceUpdateMessage extends WSMessage {
  type: "price_update";
  data: {
    token: string;
    price: number;
    change24h: number;
    volume24h: number;
  };
}

/** Server → Client: Generic notification */
export interface WSNotificationMessage extends WSMessage {
  type: "notification";
  data: {
    title: string;
    body: string;
    severity: "info" | "warning" | "error" | "success";
    action?: {
      label: string;
      url: string;
    };
  };
}

/** Server → Client: Error message */
export interface WSErrorMessage extends WSMessage {
  type: "error";
  data: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/** Heartbeat messages */
export interface WSPingMessage extends WSMessage {
  type: "ping";
}

export interface WSPongMessage extends WSMessage {
  type: "pong";
}

/** Union type for all server-to-client messages */
export type ServerMessage =
  | WSTxUpdateMessage
  | WSBalanceUpdateMessage
  | WSPriceUpdateMessage
  | WSNotificationMessage
  | WSErrorMessage
  | WSPongMessage;

/** Union type for all client-to-server messages */
export type ClientMessage =
  | WSSubscribeMessage
  | WSUnsubscribeMessage
  | WSAuthMessage
  | WSPingMessage;

/** WebSocket connection configuration */
export interface WSConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  authToken?: string;
}

/** Default WebSocket configuration */
export const DEFAULT_WS_CONFIG: WSConfig = {
  url: import.meta.env.VITE_WS_URL ?? "wss://api.baseusdp.com/ws",
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
};
