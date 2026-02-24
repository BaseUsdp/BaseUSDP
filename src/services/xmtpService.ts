/**
 * XMTP Browser SDK Service
 * Singleton wrapper for decentralized, E2E-encrypted messaging via XMTP.
 */

import { Client, ConsentState, type Conversation, type DecodedMessage, type Signer, IdentifierKind, type Identifier } from "@xmtp/browser-sdk";
import { toBytes, type Hex } from "viem";

let xmtpClient: Client | null = null;
let activeStream: AsyncIterable<DecodedMessage> | null = null;
let streamAbortController: AbortController | null = null;

/**
 * Build an Identifier for an Ethereum address.
 */
function ethIdentifier(address: string): Identifier {
  return {
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
}

/**
 * Adapts an EVM personal_sign function to XMTP's Signer interface.
 */
export function buildSigner(
  address: string,
  signFn: (message: string, address: string) => Promise<string>
): Signer {
  return {
    type: "EOA",
    getIdentifier: () => ethIdentifier(address),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const hexSig = await signFn(message, address);
      return toBytes(hexSig as Hex);
    },
  };
}

/**
 * Initialize the XMTP client with the given signer.
 * Caches the client for reuse.
 */
export async function initialize(signer: Signer): Promise<Client> {
  if (xmtpClient) return xmtpClient;

  const client = await Client.create(signer, {
    env: "production",
  });

  xmtpClient = client;
  return client;
}

/**
 * Get the cached XMTP client (or null if not initialized).
 */
export function getClient(): Client | null {
  return xmtpClient;
}

/**
 * Send a text message to a peer address.
 */
export async function sendMessage(peerAddress: string, text: string): Promise<void> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  const conversation = await xmtpClient.conversations.createDmWithIdentifier(ethIdentifier(peerAddress));
  await conversation.sendText(text);
}

/**
 * Get message history for a conversation with a peer.
 */
export async function getConversationMessages(
  peerAddress: string
): Promise<DecodedMessage[]> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  const conversations = await xmtpClient.conversations.list();
  const dm = conversations.find((c) => {
    // DM conversations have the peer address in their members
    return c.id.toLowerCase().includes(peerAddress.toLowerCase());
  });

  if (!dm) return [];

  const messages = await dm.messages();
  return messages;
}

/**
 * List all conversations.
 */
export async function listConversations(): Promise<Conversation[]> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  await xmtpClient.conversations.sync();
  return xmtpClient.conversations.list();
}

/**
 * Stream all incoming messages in real-time.
 */
export async function streamAllMessages(
  onMessage: (message: DecodedMessage) => void
): Promise<void> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  streamAbortController = new AbortController();

  const stream = await xmtpClient.conversations.streamAllMessages();
  activeStream = stream;

  try {
    for await (const message of stream) {
      if (streamAbortController?.signal.aborted) break;
      onMessage(message);
    }
  } catch (err) {
    // Stream was likely closed intentionally
    if (!streamAbortController?.signal.aborted) {
      console.error("[XMTP] Stream error:", err);
    }
  }
}

/**
 * Stop the active message stream.
 */
export function stopStream(): void {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
  activeStream = null;
}

/**
 * Disconnect and clean up the XMTP client.
 */
export function disconnect(): void {
  stopStream();
  xmtpClient = null;
}

/**
 * Check if addresses have XMTP identities.
 */
export async function canMessage(addresses: string[]): Promise<Map<string, boolean>> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  const identifiers = addresses.map((a) => ethIdentifier(a));
  const sdkResults = await xmtpClient.canMessage(identifiers);

  // Map back from identifier string to original address
  const results = new Map<string, boolean>();
  for (const address of addresses) {
    results.set(address, sdkResults.get(address.toLowerCase()) ?? false);
  }
  return results;
}

/**
 * Find conversation by peer address (checks member identifiers).
 */
async function findConversationByPeer(address: string): Promise<Conversation | null> {
  if (!xmtpClient) return null;

  const conversations = await xmtpClient.conversations.list();
  for (const conv of conversations) {
    try {
      const members = await conv.members();
      const hasPeer = members.some((m) =>
        m.accountIdentifiers.some(
          (id) => id.identifier.toLowerCase() === address.toLowerCase()
        )
      );
      if (hasPeer) return conv;
    } catch {
      // Skip conversations we can't inspect
    }
  }
  return null;
}

/**
 * Allow a contact address (consent management).
 */
export async function allowAddress(address: string): Promise<void> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  const conv = await findConversationByPeer(address);
  if (conv) {
    await conv.updateConsentState(ConsentState.Allowed);
  }
}

/**
 * Deny a contact address (consent management).
 */
export async function denyAddress(address: string): Promise<void> {
  if (!xmtpClient) throw new Error("XMTP client not initialized");

  const conv = await findConversationByPeer(address);
  if (conv) {
    await conv.updateConsentState(ConsentState.Denied);
  }
}
