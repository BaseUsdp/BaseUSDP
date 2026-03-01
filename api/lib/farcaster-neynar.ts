/**
 * Farcaster Neynar API Utilities
 * Resolves Farcaster FIDs to wallet addresses and usernames
 */

import { createClient } from "@supabase/supabase-js";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "";
const NEYNAR_BASE_URL = "https://api.neynar.com/v2";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
}

/**
 * Resolve a Farcaster FID to a verified ETH wallet address
 * Checks cache first, falls back to Neynar API
 */
export async function resolveFidToWallet(
  fid: number
): Promise<{ walletAddress: string; username: string }> {
  const supabase = getSupabase();

  // Check cache first
  if (supabase) {
    const { data: cached } = await supabase
      .from("farcaster_users")
      .select("wallet_address, farcaster_username")
      .eq("fid", fid)
      .single();

    if (cached?.wallet_address) {
      return {
        walletAddress: cached.wallet_address,
        username: cached.farcaster_username || "",
      };
    }
  }

  // Fetch from Neynar
  const response = await fetch(
    `${NEYNAR_BASE_URL}/farcaster/user/bulk?fids=${fid}`,
    {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Neynar API error: ${response.status}`);
  }

  const data = await response.json();
  const user: NeynarUser | undefined = data.users?.[0];

  if (!user) {
    throw new Error(`FID ${fid} not found on Neynar`);
  }

  const ethAddress = user.verified_addresses?.eth_addresses?.[0];
  if (!ethAddress) {
    throw new Error(`FID ${fid} has no verified ETH address`);
  }

  // Cache the result
  if (supabase) {
    await supabase.from("farcaster_users").upsert(
      {
        fid,
        farcaster_username: user.username,
        wallet_address: ethAddress.toLowerCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fid" }
    );
  }

  return { walletAddress: ethAddress.toLowerCase(), username: user.username };
}

/**
 * Resolve a Farcaster username to FID and wallet
 */
export async function resolveFarcasterUsername(
  username: string
): Promise<{ fid: number; walletAddress: string; username: string }> {
  const supabase = getSupabase();

  // Check cache first
  if (supabase) {
    const { data: cached } = await supabase
      .from("farcaster_users")
      .select("fid, wallet_address, farcaster_username")
      .eq("farcaster_username", username.toLowerCase())
      .single();

    if (cached?.wallet_address) {
      return {
        fid: cached.fid,
        walletAddress: cached.wallet_address,
        username: cached.farcaster_username || username,
      };
    }
  }

  // Fetch from Neynar by username
  const response = await fetch(
    `${NEYNAR_BASE_URL}/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
    {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Farcaster username "${username}" not found`);
  }

  const data = await response.json();
  const user: NeynarUser | undefined = data.user;

  if (!user) {
    throw new Error(`Farcaster username "${username}" not found`);
  }

  const ethAddress = user.verified_addresses?.eth_addresses?.[0];
  if (!ethAddress) {
    throw new Error(`User @${username} has no verified ETH address`);
  }

  // Cache the result
  if (supabase) {
    await supabase.from("farcaster_users").upsert(
      {
        fid: user.fid,
        farcaster_username: user.username,
        wallet_address: ethAddress.toLowerCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fid" }
    );
  }

  return {
    fid: user.fid,
    walletAddress: ethAddress.toLowerCase(),
    username: user.username,
  };
}
