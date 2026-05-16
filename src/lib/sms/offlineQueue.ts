/**
 * Local-first offline queue for SMS sends.
 *
 * The whitepaper promises that a sender can sign a commitment with no
 * internet and have it dispatched automatically on reconnect. We persist
 * fully-signed `QueuedSend` entries to localStorage, then drain them when
 * `navigator.onLine` flips true or when an explicit drain() is requested.
 *
 * Signing happens before queuing — once a send is queued, the wallet has
 * already authorized it. The queue only handles transport.
 */

import { postSmsSend, type SmsSendPayload } from "@/services/smsService";
import type { QueuedSend, SmsSendResult } from "./types";

const STORAGE_KEY = "baseusdp:sms:queue:v1";

function readQueue(): QueuedSend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedSend[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: QueuedSend[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage might be full / disabled. Best-effort.
  }
}

export function listQueued(): QueuedSend[] {
  return readQueue();
}

export function enqueueSend(entry: Omit<QueuedSend, "queuedAt" | "attempts" | "lastError" | "id"> & {
  id?: string;
}): QueuedSend {
  const queue = readQueue();
  const record: QueuedSend = {
    ...entry,
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  queue.push(record);
  writeQueue(queue);
  notifySubscribers();
  return record;
}

export function removeQueued(id: string): void {
  const queue = readQueue().filter((e) => e.id !== id);
  writeQueue(queue);
  notifySubscribers();
}

export function updateQueued(id: string, patch: Partial<QueuedSend>): void {
  const queue = readQueue().map((e) => (e.id === id ? { ...e, ...patch } : e));
  writeQueue(queue);
  notifySubscribers();
}

export interface DrainResult {
  sent: QueuedSend[];
  failed: { entry: QueuedSend; error: string }[];
}

export async function drainQueue(): Promise<DrainResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: [], failed: [] };
  }
  const queue = readQueue();
  const sent: QueuedSend[] = [];
  const failed: { entry: QueuedSend; error: string }[] = [];

  for (const entry of queue) {
    const payload: SmsSendPayload = {
      phoneHash: entry.phoneHash,
      amount: entry.amount,
      sender: entry.sender,
      senderSig: entry.senderSig,
      phoneE164: entry.phoneE164,
      claimToken: entry.claimToken,
      note: entry.note,
    };
    try {
      const result: SmsSendResult = await postSmsSend(payload);
      void result;
      removeQueued(entry.id);
      sent.push(entry);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateQueued(entry.id, {
        attempts: entry.attempts + 1,
        lastError: msg,
      });
      failed.push({ entry, error: msg });
    }
  }

  return { sent, failed };
}

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

export function subscribeQueue(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notifySubscribers(): void {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore subscriber errors
    }
  });
}

let drainerInstalled = false;
export function installOnlineDrainer(): void {
  if (drainerInstalled || typeof window === "undefined") return;
  drainerInstalled = true;
  window.addEventListener("online", () => {
    void drainQueue();
  });
  // Also drain on visibility change — covers tabs that came back from
  // sleep on a flaky connection.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void drainQueue();
    }
  });
}
