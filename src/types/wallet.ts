/**
 * Wallet-related type definitions for BaseUSDP
 */

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: { eth: string; usdc: string };
  isCorrectNetwork: boolean;
}

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  downloadUrl: string;
}

export const WALLET_PROVIDERS: WalletProvider[] = [
  { id: 'metamask', name: 'MetaMask', icon: '/assets/icons/metamask.svg', description: 'Popular browser extension wallet', downloadUrl: 'https://metamask.io/download/' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '/assets/icons/coinbase.svg', description: 'Wallet by Coinbase with native Base support', downloadUrl: 'https://www.coinbase.com/wallet' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '/assets/icons/walletconnect.svg', description: 'Connect any mobile wallet via QR code', downloadUrl: 'https://walletconnect.com/' },
];
