/**
 * Intermediate Wallet Pool for ZK Proof Privacy
 * 1:1 with Nolvipay's intermediate-wallet-pool.ts
 * 
 * Manages a pool of intermediate wallets that break the direct link
 * between user deposits and recipient transfers.
 */

export interface IntermediateWallet {
  index: number;
  publicKey: string;
  privateKey: number[];
  lastUsed?: Date;
  totalUses: number;
}

class IntermediateWalletPool {
  private wallets: IntermediateWallet[] = [];
  private initialized = false;
  private envVarName: string;

  constructor(envVarName: string = 'INTERMEDIATE_WALLETS') {
    this.envVarName = envVarName;
  }

  /**
   * Initialize the pool from environment variable
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const walletsEnv = process.env[this.envVarName];
      if (!walletsEnv) {
        throw new Error(`${this.envVarName} environment variable not set`);
      }

      const walletsData = JSON.parse(walletsEnv);
      
      this.wallets = walletsData.map((w: any, index: number) => ({
        index,
        publicKey: w.publicKey,
        privateKey: Array.isArray(w.privateKey) ? w.privateKey : JSON.parse(w.privateKey),
        lastUsed: undefined,
        totalUses: 0,
      }));

      if (this.wallets.length === 0) {
        throw new Error(`No intermediate wallets found in ${this.envVarName}`);
      }

      this.initialized = true;
      console.log(`✅ INTERMEDIATE WALLET POOL (${this.envVarName}): Initialized with ${this.wallets.length} wallets`);
    } catch (error) {
      console.error(`❌ INTERMEDIATE WALLET POOL (${this.envVarName}): Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Get an available intermediate wallet
   */
  async getAvailableWallet(): Promise<IntermediateWallet> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.wallets.length === 0) {
      throw new Error('No intermediate wallets available');
    }

    // Sort by lastUsed (oldest first), then by totalUses (least used first)
    const sorted = [...this.wallets].sort((a, b) => {
      if (!a.lastUsed && !b.lastUsed) {
        return a.totalUses - b.totalUses;
      }
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return a.lastUsed.getTime() - b.lastUsed.getTime();
    });

    // Randomly select from top 5 candidates
    const candidateCount = Math.min(5, sorted.length);
    const candidates = sorted.slice(0, candidateCount);
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates[randomIndex];
    
    // Update usage stats
    selected.lastUsed = new Date();
    selected.totalUses++;

    return selected;
  }

  /**
   * Get a wallet by public key
   */
  async getWalletByPublicKey(publicKey: string): Promise<IntermediateWallet | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.wallets.find(w => w.publicKey === publicKey) || null;
  }

  getAllWallets(): IntermediateWallet[] {
    return [...this.wallets];
  }
}

// Singleton instances for different pools
let blindfoldPoolInstance: IntermediateWalletPool | null = null;
let privacyUsdPoolInstance: IntermediateWalletPool | null = null;

/**
 * Get Blindfold intermediate wallet pool (uses INTERMEDIATE_WALLETS)
 */
export function getIntermediateWalletPool(): IntermediateWalletPool {
  if (!blindfoldPoolInstance) {
    blindfoldPoolInstance = new IntermediateWalletPool('INTERMEDIATE_WALLETS');
  }
  return blindfoldPoolInstance;
}

/**
 * Get PrivacyUSD intermediate wallet pool (uses PRIVACY_USD_INTERMEDIATE_WALLETS)
 * For Void402, we can also use ZK_INTERMEDIATE_WALLETS
 */
export function getPrivacyUsdWalletPool(): IntermediateWalletPool {
  if (!privacyUsdPoolInstance) {
    // Try Void402-specific env var first, then fall back to Nolvipay's
    const envVarName = process.env.ZK_INTERMEDIATE_WALLETS 
      ? 'ZK_INTERMEDIATE_WALLETS' 
      : 'PRIVACY_USD_INTERMEDIATE_WALLETS';
    privacyUsdPoolInstance = new IntermediateWalletPool(envVarName);
  }
  return privacyUsdPoolInstance;
}

export type { IntermediateWallet };
