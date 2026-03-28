/**
 * Wallet Type Definitions
 *
 * Types for wallet connections, providers, and chain configuration.
 */

/** Supported wallet providers */
export type WalletProvider =
  | "metamask"
  | "coinbase"
  | "phantom"
  | "walletconnect"
  | "rabby"
  | "injected";

/** Active blockchain */
export type Chain = "base" | "solana";

/** Network environment */
export type NetworkEnvironment = "mainnet" | "testnet";

/** Wallet connection state */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong_network"
  | "error";

/** Chain configuration */
export interface ChainConfig {
  id: number;
  hexId: string;
  name: string;
  network: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

/** Base Mainnet configuration */
export const BASE_MAINNET: ChainConfig = {
  id: 8453,
  hexId: "0x2105",
  name: "Base",
  network: "base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

/** Base Sepolia (testnet) configuration */
export const BASE_SEPOLIA: ChainConfig = {
  id: 84532,
  hexId: "0x14a34",
  name: "Base Sepolia",
  network: "base-sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

/** Wallet metadata for UI display */
export interface WalletInfo {
  provider: WalletProvider;
  name: string;
  icon: string;
  downloadUrl: string;
  deepLink?: string;
  isInstalled: () => boolean;
}

/** Connected wallet state */
export interface ConnectedWallet {
  address: string;
  provider: WalletProvider;
  chain: Chain;
  chainId: number;
  connectionState: ConnectionState;
  /** ENS or Base Name, if resolved */
  displayName?: string;
}

/** EVM provider interface (MetaMask, Coinbase Wallet, etc.) */
export interface EVMProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  selectedAddress?: string | null;
  chainId?: string;
}

/** Wallet signing request */
export interface SignMessageRequest {
  message: string;
  address: string;
}

/** Wallet signing response */
export interface SignMessageResponse {
  signature: string;
  address: string;
}
