/**
 * Intermediate Wallet Pool for ZK Proof Privacy
 * 
 * Manages a pool of intermediate wallets that break the direct link
 * between user deposits and recipient transfers.
 */

interface IntermediateWallet {
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
      
      this.wallets = walletsData.map((w: any) => ({
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
  getWalletByPublicKey(publicKey: string): IntermediateWallet | null {
    if (!this.initialized) {
      // Synchronous check - will need to be initialized first
      return null;
    }

    return this.wallets.find(w => w.publicKey === publicKey) || null;
  }

  getAllWallets(): IntermediateWallet[] {
    return [...this.wallets];
  }
}

// Singleton instance
let intermediateWalletPoolInstance: IntermediateWalletPool | null = null;

/**
 * Get intermediate wallet pool
 */
export function getIntermediateWalletPool(): IntermediateWalletPool {
  if (!intermediateWalletPoolInstance) {
    intermediateWalletPoolInstance = new IntermediateWalletPool('INTERMEDIATE_WALLETS');
  }
  return intermediateWalletPoolInstance;
}

export type { IntermediateWallet };
