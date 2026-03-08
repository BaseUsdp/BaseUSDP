/**
 * X OAuth 2.0 Callback
 * GET /api/twitter/oauth-callback
 *
 * Handles the redirect from X after user authorization.
 * Exchanges code for token, fetches user identity, links to wallet.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const X_OAUTH_CLIENT_ID = process.env.X_OAUTH_CLIENT_ID || "";
const X_OAUTH_CLIENT_SECRET = process.env.X_OAUTH_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.X_OAUTH_REDIRECT_URI ||
  "https://baseusdp.com/api/twitter/oauth-callback";
const DASHBOARD_URL =
  process.env.DASHBOARD_URL || "https://baseusdp.com/dashboard";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.redirect(`${DASHBOARD_URL}?x_error=Database+not+configured`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  // User denied access
  if (error) {
    console.log(`[OAuthCallback] User denied access: ${error}`);
    return res.redirect(`${DASHBOARD_URL}?x_error=Authorization+denied`);
  }

  if (!code || !state) {
    return res.redirect(`${DASHBOARD_URL}?x_error=Missing+authorization+code`);
  }

  // Look up OAuth state
  const { data: oauthState } = await supabase
    .from("x_oauth_state")
    .select("*")
    .eq("state", state)
    .single();

  if (!oauthState) {
    return res.redirect(`${DASHBOARD_URL}?x_error=Invalid+or+expired+state`);
  }

  // Check expiry
  if (new Date(oauthState.expires_at) < new Date()) {
    await supabase.from("x_oauth_state").delete().eq("state", state);
    return res.redirect(`${DASHBOARD_URL}?x_error=Authorization+expired`);
  }

  try {
    // Exchange code for access token (confidential client — Basic auth)
    const basicAuth = Buffer.from(
      `${X_OAUTH_CLIENT_ID}:${X_OAUTH_CLIENT_SECRET}`
    ).toString("base64");

    console.log(`[OAuthCallback] Using client_id length=${X_OAUTH_CLIENT_ID.length}, secret length=${X_OAUTH_CLIENT_SECRET.length}`);

    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code_verifier: oauthState.code_verifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error(`[OAuthCallback] Token exchange failed ${tokenResponse.status}: ${body}`);
      await supabase.from("x_oauth_state").delete().eq("state", state);
      return res.redirect(`${DASHBOARD_URL}?x_error=Token+exchange+failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch user identity
    const userResponse = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      const body = await userResponse.text();
      console.error(`[OAuthCallback] User lookup failed ${userResponse.status}: ${body}`);
      await supabase.from("x_oauth_state").delete().eq("state", state);
      return res.redirect(`${DASHBOARD_URL}?x_error=Failed+to+fetch+user+info`);
    }

    const userData = await userResponse.json();
    const xUser = userData.data;

    if (!xUser?.id || !xUser?.username) {
      await supabase.from("x_oauth_state").delete().eq("state", state);
      return res.redirect(`${DASHBOARD_URL}?x_error=Invalid+user+data`);
    }

    // Check if this X account is already linked to a different wallet
    const { data: existingLink } = await supabase
      .from("x_users")
      .select("wallet_address")
      .eq("x_user_id", xUser.id)
      .single();

    if (
      existingLink &&
      existingLink.wallet_address !== oauthState.wallet_address
    ) {
      await supabase.from("x_oauth_state").delete().eq("state", state);
      return res.redirect(
        `${DASHBOARD_URL}?x_error=X+account+already+linked+to+another+wallet`
      );
    }

    // Upsert into x_users
    const { error: upsertError } = await supabase.from("x_users").upsert(
      {
        x_user_id: xUser.id,
        x_username: xUser.username,
        wallet_address: oauthState.wallet_address,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "x_user_id" }
    );

    if (upsertError) {
      console.error("[OAuthCallback] Upsert error:", upsertError.message);
      await supabase.from("x_oauth_state").delete().eq("state", state);
      return res.redirect(`${DASHBOARD_URL}?x_error=Failed+to+link+account`);
    }

    // Clean up OAuth state
    await supabase.from("x_oauth_state").delete().eq("state", state);

    console.log(
      `[OAuthCallback] Linked @${xUser.username} (${xUser.id}) to ${oauthState.wallet_address.slice(0, 8)}...`
    );

    return res.redirect(`${DASHBOARD_URL}?x_linked=true`);
  } catch (err: any) {
    console.error("[OAuthCallback] Unexpected error:", err.message);
    await supabase.from("x_oauth_state").delete().eq("state", state);
    return res.redirect(`${DASHBOARD_URL}?x_error=Unexpected+error`);
  }
}
