/**
 * Farcaster Push Notification Utilities
 * Sends privacy-safe notifications via Farcaster's notification API
 *
 * PRIVACY: Notification content is always generic — no financial details ever.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

type NotificationEventType =
  | "payment_received"
  | "payment_settled"
  | "payment_sent"
  | "deposit_complete";

const NOTIFICATION_TEMPLATES: Record<
  NotificationEventType,
  { title: string; body: string }
> = {
  payment_received: {
    title: "BASEUSDP",
    body: "You received a private payment",
  },
  payment_settled: {
    title: "BASEUSDP",
    body: "Your payment request was settled",
  },
  payment_sent: {
    title: "BASEUSDP",
    body: "Your cast payment was sent successfully",
  },
  deposit_complete: {
    title: "BASEUSDP",
    body: "Your deposit is ready",
  },
};

/**
 * Send a push notification to a Farcaster user
 * Looks up the user's notification token from farcaster_users table
 */
export async function sendFarcasterNotification(
  fid: number,
  eventType: NotificationEventType
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data: user } = await supabase
      .from("farcaster_users")
      .select("notification_token, notification_url")
      .eq("fid", fid)
      .single();

    if (!user?.notification_token || !user?.notification_url) {
      console.log(
        `[Farcaster] No notification token for FID ${fid}, skipping`
      );
      return false;
    }

    const template = NOTIFICATION_TEMPLATES[eventType];

    const response = await fetch(user.notification_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: `baseusdp_${eventType}_${Date.now()}`,
        title: template.title,
        body: template.body,
        targetUrl: "https://www.baseusdp.com/miniapp",
        tokens: [user.notification_token],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Farcaster] Notification send failed for FID ${fid}:`,
        errorText
      );

      // If token is invalid (410 Gone), clear it
      if (response.status === 410) {
        await supabase
          .from("farcaster_users")
          .update({ notification_token: null, notification_url: null })
          .eq("fid", fid);
      }

      return false;
    }

    console.log(
      `[Farcaster] Notification sent to FID ${fid}: ${eventType}`
    );
    return true;
  } catch (error: any) {
    console.error(
      `[Farcaster] Notification error for FID ${fid}:`,
      error.message
    );
    return false;
  }
}

/**
 * Look up a FID by wallet address for notification routing
 */
export async function getFidByWallet(
  walletAddress: string
): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("farcaster_users")
    .select("fid")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single();

  return data?.fid || null;
}
