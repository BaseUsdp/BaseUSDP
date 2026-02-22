/**
 * Agent Spending Policy Enforcement
 * Checks per-tx limits, daily rolling window, allowed tokens,
 * recipient allowlist/blocklist, and time windows.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if an agent's intended transaction is allowed by its spending policy
 */
export async function checkSpendingPolicy(
  agentId: string,
  amount: number,
  token: string,
  recipient?: string
): Promise<PolicyCheckResult> {
  if (!supabase) {
    return { allowed: false, reason: 'Database not configured' };
  }

  // Fetch the agent's policy
  const { data: policy, error } = await supabase
    .from('agent_spending_policies')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error || !policy) {
    // No policy means default — allow with sensible defaults
    // But we still check a default per-tx max of $1000
    if (amount > 1000) {
      return { allowed: false, reason: 'No policy configured and amount exceeds default $1,000 per-tx limit' };
    }
    return { allowed: true };
  }

  // 1. Per-transaction limit
  if (policy.max_per_tx && amount > parseFloat(policy.max_per_tx)) {
    return {
      allowed: false,
      reason: `Amount $${amount} exceeds per-transaction limit of $${policy.max_per_tx}`,
    };
  }

  // 2. Token allowlist
  if (policy.allowed_tokens && policy.allowed_tokens.length > 0) {
    if (!policy.allowed_tokens.includes(token)) {
      return {
        allowed: false,
        reason: `Token ${token} is not in allowed tokens: ${policy.allowed_tokens.join(', ')}`,
      };
    }
  }

  // 3. Recipient allowlist (if set, recipient must be in the list)
  if (recipient && policy.allowed_recipients && policy.allowed_recipients.length > 0) {
    const normalizedRecipient = recipient.toLowerCase();
    const allowed = policy.allowed_recipients.some(
      (r: string) => r.toLowerCase() === normalizedRecipient
    );
    if (!allowed) {
      return {
        allowed: false,
        reason: 'Recipient is not in the allowed recipients list',
      };
    }
  }

  // 4. Recipient blocklist
  if (recipient && policy.blocked_recipients && policy.blocked_recipients.length > 0) {
    const normalizedRecipient = recipient.toLowerCase();
    const blocked = policy.blocked_recipients.some(
      (r: string) => r.toLowerCase() === normalizedRecipient
    );
    if (blocked) {
      return {
        allowed: false,
        reason: 'Recipient is in the blocked recipients list',
      };
    }
  }

  // 5. Time window check
  if (policy.time_window_start && policy.time_window_end) {
    const now = new Date();
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:00`;
    if (currentTime < policy.time_window_start || currentTime > policy.time_window_end) {
      return {
        allowed: false,
        reason: `Current time ${currentTime} UTC is outside allowed window ${policy.time_window_start}-${policy.time_window_end}`,
      };
    }
  }

  // 6. Daily rolling window (SUM from agent_spending_log for last 24 hours)
  if (policy.daily_limit) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error: logError } = await supabase
      .from('agent_spending_log')
      .select('amount')
      .eq('agent_id', agentId)
      .in('status', ['allowed', 'completed'])
      .gte('created_at', twentyFourHoursAgo);

    if (!logError && logs) {
      const dailyTotal = logs.reduce((sum, log) => sum + parseFloat(log.amount), 0);
      if (dailyTotal + amount > parseFloat(policy.daily_limit)) {
        return {
          allowed: false,
          reason: `Daily limit exceeded: $${dailyTotal.toFixed(2)} spent + $${amount} would exceed $${policy.daily_limit} daily limit`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Log a spending attempt to the audit trail
 */
export async function logSpendingAttempt(
  agentId: string,
  action: 'transfer' | 'withdraw',
  amount: number,
  token: string,
  status: 'allowed' | 'blocked' | 'completed' | 'failed',
  recipient?: string,
  reason?: string,
  txHash?: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('agent_spending_log').insert({
      agent_id: agentId,
      action,
      amount,
      token,
      recipient,
      status,
      reason,
      tx_hash: txHash,
    });
  } catch (err: any) {
    console.warn(`[Agent Policy] Failed to log spending attempt: ${err.message}`);
  }
}
