/**
 * Client-side EVM provider helpers used by the Veil + SMS flows.
 *
 * Lives outside WalletContext on purpose — these flows must not import from
 * or modify the BASEUSDP pool's wallet context.
 *
 * Despite the directory name (`veil/`), the helpers are wallet-agnostic and
 * shared by the SMS Pay layer too.
 */

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
};

export type VeilWalletType =
  | "metamask"
  | "phantom"
  | "coinbase"
  | null;

export function getMetaMaskProvider(): EvmProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as any).ethereum as EvmProvider | undefined;
  if (provider?.isMetaMask && !provider?.isPhantom && !provider?.isCoinbaseWallet)
    return provider;
  return null;
}

export function getPhantomEVMProvider(): EvmProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as any).phantom?.ethereum as EvmProvider | undefined;
  if (provider?.isPhantom) return provider;
  return null;
}

export async function getEvmProvider(
  walletType: VeilWalletType
): Promise<EvmProvider | null> {
  if (walletType === "metamask") return getMetaMaskProvider();
  if (walletType === "phantom") return getPhantomEVMProvider();
  if (walletType === "coinbase") {
    const { getCoinbaseProvider } = await import("@/lib/wallets/coinbase");
    return (await getCoinbaseProvider()) as EvmProvider;
  }
  // Fall back to any injected provider.
  return getMetaMaskProvider() ?? getPhantomEVMProvider();
}

export async function personalSign(
  walletType: VeilWalletType,
  address: string,
  message: string
): Promise<string> {
  const provider = await getEvmProvider(walletType);
  if (!provider) throw new Error("No EVM wallet provider found");
  const sig = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });
  return sig as string;
}

export interface SendTxParams {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint | string;
  from: `0x${string}`;
}

export async function sendTransaction(
  walletType: VeilWalletType,
  params: SendTxParams
): Promise<`0x${string}`> {
  const provider = await getEvmProvider(walletType);
  if (!provider) throw new Error("No EVM wallet provider found");

  const value =
    params.value === undefined
      ? undefined
      : typeof params.value === "bigint"
      ? `0x${params.value.toString(16)}`
      : params.value;

  const tx: Record<string, string> = {
    from: params.from,
    to: params.to,
    data: params.data,
  };
  if (value) tx.value = value;

  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [tx],
  });
  return hash as `0x${string}`;
}

/** Read USDC allowance for an arbitrary spender. */
export async function readUsdcAllowance(
  walletType: VeilWalletType,
  owner: `0x${string}`,
  spender: `0x${string}`,
  usdcToken: `0x${string}`
): Promise<bigint> {
  const provider = await getEvmProvider(walletType);
  if (!provider) throw new Error("No EVM wallet provider found");
  const data =
    "0xdd62ed3e" +
    owner.slice(2).padStart(64, "0") +
    spender.slice(2).padStart(64, "0");
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: usdcToken, data }, "latest"],
  })) as string;
  return BigInt(result || "0x0");
}
