/**
 * Neynar Cast Publishing Utility
 * Publishes reply casts from the @orb402 bot account via Neynar managed signer.
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "";
const NEYNAR_BOT_SIGNER_UUID = process.env.NEYNAR_BOT_SIGNER_UUID || "";

/**
 * Reply to a cast with text from the @orb402 bot account.
 * Returns the published cast hash on success, or null on failure.
 */
export async function replyCast(
  parentCastHash: string,
  text: string
): Promise<string | null> {
  if (!NEYNAR_API_KEY || !NEYNAR_BOT_SIGNER_UUID) {
    console.error("[NeynarCast] Missing NEYNAR_API_KEY or NEYNAR_BOT_SIGNER_UUID");
    return null;
  }

  try {
    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_BOT_SIGNER_UUID,
        text,
        parent: parentCastHash,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NeynarCast] Failed to reply (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const castHash = data.cast?.hash || null;
    console.log(`[NeynarCast] Reply published: ${castHash}`);
    return castHash;
  } catch (error: any) {
    console.error("[NeynarCast] Error publishing reply:", error.message);
    return null;
  }
}

/**
 * Publish a top-level cast (not a reply) from the @orb402 bot account.
 * Returns the published cast hash on success, or null on failure.
 */
export async function publishCast(text: string): Promise<string | null> {
  if (!NEYNAR_API_KEY || !NEYNAR_BOT_SIGNER_UUID) {
    console.error("[NeynarCast] Missing NEYNAR_API_KEY or NEYNAR_BOT_SIGNER_UUID");
    return null;
  }

  try {
    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_BOT_SIGNER_UUID,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NeynarCast] Failed to publish (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const castHash = data.cast?.hash || null;
    console.log(`[NeynarCast] Cast published: ${castHash}`);
    return castHash;
  } catch (error: any) {
    console.error("[NeynarCast] Error publishing cast:", error.message);
    return null;
  }
}
