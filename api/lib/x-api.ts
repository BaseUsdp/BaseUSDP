/**
 * X/Twitter API v2 Client
 * Handles mention fetching (Bearer token), tweet posting (OAuth 1.0a), and user lookup.
 */

import { createHmac, randomBytes } from "crypto";

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || "";
const X_API_KEY = process.env.X_API_KEY || "";
const X_API_SECRET = process.env.X_API_SECRET || "";
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || "";
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET || "";
const ORB402_X_USER_ID = process.env.ORB402_X_USER_ID || "";

const X_API_BASE = "https://api.x.com";

// ---------------------------------------------------------------------------
// OAuth 1.0a HMAC-SHA1 signing (inline, no external dependency)
// ---------------------------------------------------------------------------

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(X_API_SECRET)}&${percentEncode(X_ACCESS_TOKEN_SECRET)}`;

  return createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildOAuthHeader(method: string, url: string, bodyParams: Record<string, string> = {}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...bodyParams };
  const signature = generateOAuthSignature(method, url, allParams);
  oauthParams["oauth_signature"] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

export interface XMention {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
}

export interface XUser {
  id: string;
  username: string;
  name: string;
}

/**
 * Fetch recent mentions of the @baseusdp bot account.
 * Uses Bearer token auth (app-level read access).
 */
export async function fetchMentions(sinceId?: string): Promise<{
  mentions: XMention[];
  users: Record<string, XUser>;
  newestId?: string;
}> {
  if (!X_BEARER_TOKEN || !ORB402_X_USER_ID) {
    throw new Error("X API credentials not configured");
  }

  const params = new URLSearchParams({
    "tweet.fields": "created_at,author_id",
    expansions: "author_id",
    "user.fields": "username",
    max_results: "100",
  });
  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const url = `${X_API_BASE}/2/users/${ORB402_X_USER_ID}/mentions?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X API mentions error ${response.status}: ${body}`);
  }

  const json = await response.json();

  // No data means no new mentions
  if (!json.data) {
    return { mentions: [], users: {}, newestId: undefined };
  }

  const mentions: XMention[] = json.data;
  const users: Record<string, XUser> = {};

  if (json.includes?.users) {
    for (const u of json.includes.users) {
      users[u.id] = { id: u.id, username: u.username, name: u.name };
    }
  }

  const newestId = json.meta?.newest_id || mentions[0]?.id;

  return { mentions, users, newestId };
}

/**
 * Post a reply tweet from the @baseusdp bot account.
 * Uses OAuth 1.0a user-context auth.
 */
export async function replyTweet(
  tweetId: string,
  text: string
): Promise<string | null> {
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    console.warn("[X-API] OAuth credentials not configured, skipping reply");
    return null;
  }

  const url = `${X_API_BASE}/2/tweets`;
  const body = {
    text,
    reply: { in_reply_to_tweet_id: tweetId },
  };

  const authHeader = buildOAuthHeader("POST", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[X-API] Reply tweet failed ${response.status}: ${errBody}`);
    return null;
  }

  const json = await response.json();
  return json.data?.id || null;
}

/**
 * Look up an X user by username.
 * Uses Bearer token auth.
 */
export async function lookupXUser(
  username: string
): Promise<XUser | null> {
  if (!X_BEARER_TOKEN) {
    throw new Error("X Bearer token not configured");
  }

  const cleanUsername = username.replace(/^@/, "");
  const url = `${X_API_BASE}/2/users/by/username/${cleanUsername}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const body = await response.text();
    throw new Error(`X API user lookup error ${response.status}: ${body}`);
  }

  const json = await response.json();
  if (!json.data) return null;

  return {
    id: json.data.id,
    username: json.data.username,
    name: json.data.name,
  };
}
