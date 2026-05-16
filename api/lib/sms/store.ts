/**
 * SMS escrow store.
 *
 * In production (Vercel) we use Supabase tables `sms_escrows` for durable
 * storage that survives function cold starts. Locally — when no Supabase
 * env vars are set — we fall back to a JSON file at
 * <project>/data/sms-escrow.json so the dev workflow needs no external
 * service. Both backends expose the same public surface.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { EscrowRecord, EscrowStatus } from "./types.js";
import { getSupabase, hasSupabase } from "./supabase.js";

const FILE_DATA_FILE = process.env.VERCEL
  ? "/tmp/sms-escrow.json"
  : join(process.cwd(), "data", "sms-escrow.json");
const EXPIRY_HOURS = 24;

const TABLE = "sms_escrows";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function generateClaimToken(): string {
  return randomBytes(16).toString("hex");
}

export function isExpired(record: EscrowRecord, now = Date.now()): boolean {
  return now > new Date(record.expiresAt).getTime();
}

export function publicProjection(record: EscrowRecord) {
  return {
    claimToken: record.claimToken,
    status: record.status as EscrowStatus,
    amount: record.amount,
    sender: record.sender,
    recipient: record.recipient,
    note: record.note,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    settledAt: record.settledAt,
  };
}

export interface CreateEscrowInput {
  claimToken: string;
  phoneHash: `0x${string}`;
  amount: string;
  sender: `0x${string}`;
  senderSig: `0x${string}`;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Supabase backend (production)
// ---------------------------------------------------------------------------

interface DbRow {
  claim_token: string;
  phone_hash: string;
  amount: string;
  sender: string;
  recipient: string | null;
  sender_sig: string;
  note: string | null;
  status: EscrowStatus;
  created_at: string;
  expires_at: string;
  settled_at: string | null;
}

function rowToRecord(row: DbRow): EscrowRecord {
  return {
    claimToken: row.claim_token,
    phoneHash: row.phone_hash as `0x${string}`,
    amount: row.amount,
    sender: row.sender as `0x${string}`,
    recipient: (row.recipient as `0x${string}` | null) ?? null,
    senderSig: row.sender_sig as `0x${string}`,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    settledAt: row.settled_at,
  };
}

async function dbCreate(input: CreateEscrowInput): Promise<EscrowRecord> {
  const supa = getSupabase()!;
  const now = new Date();
  const expires = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
  const row: DbRow = {
    claim_token: input.claimToken,
    phone_hash: input.phoneHash.toLowerCase(),
    amount: input.amount,
    sender: input.sender.toLowerCase(),
    recipient: null,
    sender_sig: input.senderSig,
    note: input.note,
    status: "pending",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    settled_at: null,
  };
  const { data, error } = await supa
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) {
    if ((error as any).code === "23505") throw new Error("claimToken already in use");
    throw new Error(`supabase insert failed: ${error.message}`);
  }
  return rowToRecord(data as DbRow);
}

async function dbGet(claimToken: string): Promise<EscrowRecord | null> {
  const supa = getSupabase()!;
  const { data, error } = await supa
    .from(TABLE)
    .select("*")
    .eq("claim_token", claimToken)
    .maybeSingle();
  if (error) throw new Error(`supabase read failed: ${error.message}`);
  return data ? rowToRecord(data as DbRow) : null;
}

async function dbListBySender(sender: `0x${string}`): Promise<EscrowRecord[]> {
  const supa = getSupabase()!;
  const { data, error } = await supa
    .from(TABLE)
    .select("*")
    .eq("sender", sender.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error(`supabase list failed: ${error.message}`);
  return (data ?? []).map((r) => rowToRecord(r as DbRow));
}

async function dbMarkClaimed(
  claimToken: string,
  recipient: `0x${string}`
): Promise<EscrowRecord> {
  const supa = getSupabase()!;
  const existing = await dbGet(claimToken);
  if (!existing) throw new Error("escrow not found");
  if (existing.status !== "pending") {
    throw new Error(`escrow is ${existing.status}, not pending`);
  }
  if (isExpired(existing)) {
    throw new Error("escrow has expired — call refund() instead");
  }
  const settledAt = new Date().toISOString();
  const { data, error } = await supa
    .from(TABLE)
    .update({
      recipient: recipient.toLowerCase(),
      status: "claimed",
      settled_at: settledAt,
    })
    .eq("claim_token", claimToken)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw new Error(`supabase update failed: ${error.message}`);
  return rowToRecord(data as DbRow);
}

async function dbMarkRefunded(claimToken: string): Promise<EscrowRecord> {
  const supa = getSupabase()!;
  const existing = await dbGet(claimToken);
  if (!existing) throw new Error("escrow not found");
  if (existing.status !== "pending") {
    throw new Error(`escrow is ${existing.status}, not pending`);
  }
  if (!isExpired(existing)) {
    throw new Error("escrow has not yet expired");
  }
  const settledAt = new Date().toISOString();
  const { data, error } = await supa
    .from(TABLE)
    .update({ status: "refunded", settled_at: settledAt })
    .eq("claim_token", claimToken)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw new Error(`supabase update failed: ${error.message}`);
  return rowToRecord(data as DbRow);
}

// ---------------------------------------------------------------------------
// File backend (local dev)
// ---------------------------------------------------------------------------

interface FileShape {
  escrows: Record<string, EscrowRecord>;
}

let writeChain: Promise<unknown> = Promise.resolve();

async function ensureFile(): Promise<void> {
  try {
    await fs.access(FILE_DATA_FILE);
  } catch {
    await fs.mkdir(dirname(FILE_DATA_FILE), { recursive: true });
    await fs.writeFile(FILE_DATA_FILE, JSON.stringify({ escrows: {} }, null, 2));
  }
}

async function readAll(): Promise<FileShape> {
  await ensureFile();
  const raw = await fs.readFile(FILE_DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as FileShape;
    if (!parsed.escrows) return { escrows: {} };
    return parsed;
  } catch {
    return { escrows: {} };
  }
}

async function writeAll(state: FileShape): Promise<void> {
  await fs.writeFile(FILE_DATA_FILE, JSON.stringify(state, null, 2));
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

async function fileCreate(input: CreateEscrowInput): Promise<EscrowRecord> {
  return serialize(async () => {
    const state = await readAll();
    if (state.escrows[input.claimToken]) {
      throw new Error("claimToken already in use");
    }
    const now = new Date();
    const expires = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
    const record: EscrowRecord = {
      claimToken: input.claimToken,
      phoneHash: input.phoneHash.toLowerCase() as `0x${string}`,
      amount: input.amount,
      sender: input.sender.toLowerCase() as `0x${string}`,
      recipient: null,
      senderSig: input.senderSig,
      note: input.note,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      settledAt: null,
    };
    state.escrows[input.claimToken] = record;
    await writeAll(state);
    return record;
  });
}

async function fileGet(claimToken: string): Promise<EscrowRecord | null> {
  const state = await readAll();
  return state.escrows[claimToken] ?? null;
}

async function fileListBySender(
  sender: `0x${string}`
): Promise<EscrowRecord[]> {
  const state = await readAll();
  const lower = sender.toLowerCase();
  return Object.values(state.escrows)
    .filter((r) => r.sender.toLowerCase() === lower)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function fileMarkClaimed(
  claimToken: string,
  recipient: `0x${string}`
): Promise<EscrowRecord> {
  return serialize(async () => {
    const state = await readAll();
    const record = state.escrows[claimToken];
    if (!record) throw new Error("escrow not found");
    if (record.status !== "pending") {
      throw new Error(`escrow is ${record.status}, not pending`);
    }
    if (isExpired(record)) {
      throw new Error("escrow has expired — call refund() instead");
    }
    record.recipient = recipient.toLowerCase() as `0x${string}`;
    record.status = "claimed";
    record.settledAt = new Date().toISOString();
    state.escrows[claimToken] = record;
    await writeAll(state);
    return record;
  });
}

async function fileMarkRefunded(claimToken: string): Promise<EscrowRecord> {
  return serialize(async () => {
    const state = await readAll();
    const record = state.escrows[claimToken];
    if (!record) throw new Error("escrow not found");
    if (record.status !== "pending") {
      throw new Error(`escrow is ${record.status}, not pending`);
    }
    if (!isExpired(record)) {
      throw new Error("escrow has not yet expired");
    }
    record.status = "refunded";
    record.settledAt = new Date().toISOString();
    state.escrows[claimToken] = record;
    await writeAll(state);
    return record;
  });
}

// ---------------------------------------------------------------------------
// Public API — picks the right backend per call
// ---------------------------------------------------------------------------

export async function createEscrow(input: CreateEscrowInput): Promise<EscrowRecord> {
  return hasSupabase() ? dbCreate(input) : fileCreate(input);
}

export async function getEscrow(claimToken: string): Promise<EscrowRecord | null> {
  return hasSupabase() ? dbGet(claimToken) : fileGet(claimToken);
}

export async function listEscrowsBySender(
  sender: `0x${string}`
): Promise<EscrowRecord[]> {
  return hasSupabase() ? dbListBySender(sender) : fileListBySender(sender);
}

export async function markClaimed(
  claimToken: string,
  recipient: `0x${string}`
): Promise<EscrowRecord> {
  return hasSupabase()
    ? dbMarkClaimed(claimToken, recipient)
    : fileMarkClaimed(claimToken, recipient);
}

export async function markRefunded(claimToken: string): Promise<EscrowRecord> {
  return hasSupabase() ? dbMarkRefunded(claimToken) : fileMarkRefunded(claimToken);
}
