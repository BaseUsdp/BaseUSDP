/**
 * Farcaster SIWF (Sign In With Farcaster) Verification
 * Verifies message + signature from sdk.actions.signIn()
 */

import { createAppClient, viemConnector } from "@farcaster/auth-client";

let appClient: ReturnType<typeof createAppClient> | null = null;

function getAppClient() {
  if (!appClient) {
    appClient = createAppClient({
      ethereum: viemConnector(),
    });
  }
  return appClient;
}

/**
 * Verify a SIWF message+signature and extract the FID
 */
export async function verifySIWFCredential(params: {
  message: string;
  signature: string;
  nonce: string;
  domain: string;
  acceptAuthAddress?: boolean;
}): Promise<{ fid: number }> {
  const client = getAppClient();

  const result = await client.verifySignInMessage({
    message: params.message,
    signature: params.signature as `0x${string}`,
    nonce: params.nonce,
    domain: params.domain,
    acceptAuthAddress: params.acceptAuthAddress ?? true,
  });

  if (!result.success || result.isError) {
    throw new Error(
      result.error?.message || "SIWF verification failed"
    );
  }

  if (!result.fid) {
    throw new Error("SIWF verification succeeded but no FID found");
  }

  return { fid: Number(result.fid) };
}
