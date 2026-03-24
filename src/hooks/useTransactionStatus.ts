import { useEffect, useState, useCallback, useRef } from "react";
import {
  getTransactionWebSocket,
  type TransactionUpdate,
  type TransactionStatus,
} from "@/services/websocketService";

interface UseTransactionStatusOptions {
  /** Automatically connect the WebSocket when a txHash is provided. Default: true */
  autoConnect?: boolean;
}

interface UseTransactionStatusReturn {
  /** Current transaction status */
  status: TransactionStatus | null;
  /** Number of on-chain confirmations */
  confirmations: number;
  /** Error message if the transaction failed */
  error: string | null;
  /** Timestamp of the last status update */
  lastUpdated: number | null;
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** Whether the transaction has reached a terminal state */
  isTerminal: boolean;
  /** Full history of status updates for this transaction */
  history: TransactionUpdate[];
}

const TERMINAL_STATUSES: TransactionStatus[] = ["confirmed", "failed"];

/**
 * React hook for subscribing to real-time transaction status updates
 * via the BASEUSDP WebSocket service.
 *
 * @param txHash - The transaction hash to monitor. Pass null to skip.
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * const { status, confirmations, isTerminal } = useTransactionStatus(txHash);
 *
 * if (isTerminal && status === "confirmed") {
 *   showSuccessToast();
 * }
 * ```
 */
export function useTransactionStatus(
  txHash: string | null,
  options: UseTransactionStatusOptions = {}
): UseTransactionStatusReturn {
  const { autoConnect = true } = options;

  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [confirmations, setConfirmations] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<TransactionUpdate[]>([]);

  const wsRef = useRef(getTransactionWebSocket());

  const handleUpdate = useCallback((update: TransactionUpdate) => {
    setStatus(update.status);
    setConfirmations(update.confirmations);
    setError(update.error ?? null);
    setLastUpdated(update.timestamp);
    setHistory((prev) => [...prev, update]);
  }, []);

  // Monitor connection state
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setIsConnected(wsRef.current.isConnected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  // Subscribe to transaction updates
  useEffect(() => {
    if (!txHash) return;

    const ws = wsRef.current;

    if (autoConnect && !ws.isConnected) {
      ws.connect();
    }

    const unsubscribe = ws.subscribe(txHash, handleUpdate);

    return () => {
      unsubscribe();
    };
  }, [txHash, autoConnect, handleUpdate]);

  const isTerminal = status !== null && TERMINAL_STATUSES.includes(status);

  return {
    status,
    confirmations,
    error,
    lastUpdated,
    isConnected,
    isTerminal,
    history,
  };
}

/**
 * React hook for subscribing to ALL transaction updates.
 * Useful for dashboard-level monitoring.
 *
 * @example
 * ```tsx
 * const { updates } = useAllTransactionUpdates();
 *
 * return (
 *   <ul>
 *     {updates.map(u => (
 *       <li key={u.txHash}>{u.txHash}: {u.status}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useAllTransactionUpdates() {
  const [updates, setUpdates] = useState<TransactionUpdate[]>([]);
  const wsRef = useRef(getTransactionWebSocket());

  useEffect(() => {
    const ws = wsRef.current;

    if (!ws.isConnected) {
      ws.connect();
    }

    const unsubscribe = ws.subscribeAll((update) => {
      setUpdates((prev) => {
        // Replace existing entry for the same txHash or append
        const idx = prev.findIndex((u) => u.txHash === update.txHash);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = update;
          return next;
        }
        return [...prev, update];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { updates };
}
