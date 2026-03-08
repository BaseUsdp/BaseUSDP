/**
 * Twitter/X API Service
 * Frontend helpers for tweet payment settings and mentions history.
 */

import { authService } from "./authService";
import { getApiUrl } from "@/utils/apiConfig";

const API_BASE_URL = getApiUrl();

async function request(path: string, options?: RequestInit) {
  const token = authService.getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TweetPaymentSettings {
  success: boolean;
  linked: boolean;
  x_username: string | null;
  enabled: boolean;
  daily_limit: number;
}

export interface TweetMention {
  id: string;
  tweetId: string;
  senderUsername: string;
  recipientUsername: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TweetMentionsStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  volume: number;
}

export interface TweetMentionsResponse {
  success: boolean;
  mentions: TweetMention[];
  stats: TweetMentionsStats;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function startXOAuth(): Promise<{ authorize_url: string }> {
  return request("/api/twitter/oauth-start", { method: "POST" });
}

export async function getTweetPaymentSettings(): Promise<TweetPaymentSettings> {
  return request("/api/twitter/tweet-payment-settings");
}

export async function updateTweetPaymentSettings(params: {
  wallet: string;
  x_username?: string;
  enabled?: boolean;
  daily_limit?: number;
}): Promise<{ success: boolean }> {
  return request("/api/twitter/tweet-payment-settings", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function unlinkTweetPaymentAccount(params: {
  wallet: string;
}): Promise<{ success: boolean }> {
  return request("/api/twitter/tweet-payment-settings", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

export async function getTweetMentions(
  limit: number = 20
): Promise<TweetMentionsResponse> {
  return request(`/api/twitter/tweet-mentions?limit=${limit}`);
}
