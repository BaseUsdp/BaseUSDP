/**
 * Lazy Coinbase Wallet SDK singleton.
 *
 * One CoinbaseWalletSDK instance per session — the SDK manages its own
 * EIP-1193 provider that supports:
 *   - Coinbase Wallet browser extension
 *   - Coinbase Wallet mobile app (QR code flow)
 *   - Coinbase Smart Wallet (passkey-based, no extension required)
 *
 * The provider is cached so reconnects within the same session reuse the
 * established channel. Imports of `@coinbase/wallet-sdk` are deferred
 * until first use to keep the cost out of the entry bundle.
 */

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isCoinbaseWallet?: boolean;
};

const APP_NAME = "BASEUSDP";
const APP_LOGO_URL = "https://baseusdp.com/favicon.ico";

let cachedProvider: EvmProvider | null = null;
let initPromise: Promise<EvmProvider> | null = null;

async function initProvider(): Promise<EvmProvider> {
  const mod = await import("@coinbase/wallet-sdk");
  const SDKCtor: any =
    (mod as any).CoinbaseWalletSDK ?? (mod as any).default;
  if (!SDKCtor) {
    throw new Error("Failed to load Coinbase Wallet SDK");
  }
  const sdk = new SDKCtor({
    appName: APP_NAME,
    appLogoUrl: APP_LOGO_URL,
    appChainIds: [8453], // Base mainnet
  });
  // makeWeb3Provider returns the EIP-1193 provider.
  const provider = sdk.makeWeb3Provider() as EvmProvider;
  return provider;
}

export async function getCoinbaseProvider(): Promise<EvmProvider> {
  if (cachedProvider) return cachedProvider;
  if (!initPromise) {
    initPromise = initProvider().then((p) => {
      cachedProvider = p;
      return p;
    });
  }
  return initPromise;
}

/** True if the SDK provider has already been initialized this session. */
export function hasCoinbaseProvider(): boolean {
  return cachedProvider !== null;
}

/**
 * Sync access to the already-initialized provider. Returns null if the SDK
 * hasn't been loaded yet — only call this *after* a successful connect.
 */
export function getCachedCoinbaseProvider(): EvmProvider | null {
  return cachedProvider;
}
