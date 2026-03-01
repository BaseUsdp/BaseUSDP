/**
 * Farcaster Quick Auth JWT Verification
 * Verifies JWTs issued by Farcaster's Quick Auth flow
 */

import { createQuickAuthClient } from "@farcaster/quick-auth";

let quickAuthClient: Awaited<ReturnType<typeof createQuickAuthClient>> | null = null;

async function getQuickAuthClient() {
  if (!quickAuthClient) {
    quickAuthClient = await createQuickAuthClient();
  }
  return quickAuthClient;
}

/**
 * Verify a Farcaster Quick Auth JWT and extract the FID
 */
export async function verifyFarcasterJwt(
  token: string,
  domain: string
): Promise<{ fid: number }> {
  const client = await getQuickAuthClient();

  const result = await client.verifyToken({
    token,
    domain,
  });

  if (!result.fid) {
    throw new Error("JWT verification succeeded but no FID found");
  }

  return { fid: Number(result.fid) };
}
