/**
 * Farcaster Mini App Webhook Handler
 * POST /api/farcaster/webhook
 *
 * Handles lifecycle events from Farcaster:
 * - miniapp_added: User installed the Mini App
 * - miniapp_removed: User uninstalled
 * - notifications_enabled: User enabled push notifications
 * - notifications_disabled: User disabled push notifications
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const FARCASTER_WEBHOOK_SECRET = process.env.FARCASTER_WEBHOOK_SECRET || "";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = req.body;

    if (!body?.event || !body?.data) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const { event, data } = body;
    const fid = data.fid as number;

    if (!fid) {
      return res.status(400).json({ error: "Missing FID in webhook data" });
    }

    console.log(`[Farcaster Webhook] Event: ${event}, FID: ${fid}`);

    switch (event) {
      case "miniapp_added": {
        // User installed the Mini App — store notification credentials
        const updates: Record<string, any> = {
          added_to_client: true,
          updated_at: new Date().toISOString(),
        };

        if (data.notificationDetails) {
          updates.notification_token = data.notificationDetails.token;
          updates.notification_url = data.notificationDetails.url;
        }

        await supabase
          .from("farcaster_users")
          .update(updates)
          .eq("fid", fid);

        break;
      }

      case "miniapp_removed": {
        // User uninstalled — clear notification token
        await supabase
          .from("farcaster_users")
          .update({
            added_to_client: false,
            notification_token: null,
            notification_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("fid", fid);

        break;
      }

      case "notifications_enabled": {
        // User enabled notifications — update token
        if (data.notificationDetails) {
          await supabase
            .from("farcaster_users")
            .update({
              notification_token: data.notificationDetails.token,
              notification_url: data.notificationDetails.url,
              updated_at: new Date().toISOString(),
            })
            .eq("fid", fid);
        }

        break;
      }

      case "notifications_disabled": {
        // User disabled notifications — clear token
        await supabase
          .from("farcaster_users")
          .update({
            notification_token: null,
            notification_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("fid", fid);

        break;
      }

      default:
        console.log(`[Farcaster Webhook] Unknown event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[Farcaster Webhook] Error:", error.message);
    return res.status(500).json({ error: error.message || "Webhook error" });
  }
}
