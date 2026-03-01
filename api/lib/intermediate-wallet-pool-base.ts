/**
 * Intermediate Wallet Pool for Base (EVM) Chain
 * Mirrors intermediate-wallet-pool.ts but for EVM wallets (0x addresses, hex private keys).
 *
 * Manages a pool of intermediate wallets that break the direct link
 * between user deposits and the privacy pool contract on Base.
 */

export interface IntermediateWalletBase {
  index: number;
  address: string;       // 0x checksummed
  privateKey: string;    // 0x hex
  lastUsed?: Date;
  totalUses: number;
}

class IntermediateWalletPoolBase {
  private wallets: IntermediateWalletBase[] = [];
  private initialized = false;
  private envVarName: string;

  constructor(envVarName: string = 'ZK_INTERMEDIATE_WALLETS_BASE') {
    this.envVarName = envVarName;
  }

  /**
   * Initialize the pool from environment variable
   * Expected format: JSON array of [{address: "0x...", privateKey: "0x..."}]
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
        address: w.address.trim(),
        privateKey: w.privateKey.trim().replace(/\s/g, ''),
        lastUsed: undefined,
        totalUses: 0,
      }));

      if (this.wallets.length === 0) {
        throw new Error(`No intermediate wallets found in ${this.envVarName}`);
      }

      this.initialized = true;
      console.log(`✅ BASE INTERMEDIATE WALLET POOL (${this.envVarName}): Initialized with ${this.wallets.length} wallets`);
    } catch (error) {
      console.error(`❌ BASE INTERMEDIATE WALLET POOL (${this.envVarName}): Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Get an available intermediate wallet (least-recently-used with randomization)
   */
  async getAvailableWallet(): Promise<IntermediateWalletBase> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.wallets.length === 0) {
      throw new Error('No Base intermediate wallets available');
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
   * Get a wallet by address (case-insensitive)
   */
  async getWalletByAddress(address: string): Promise<IntermediateWalletBase | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const lowerAddress = address.toLowerCase();
    return this.wallets.find(w => w.address.toLowerCase() === lowerAddress) || null;
  }

  getAllWallets(): IntermediateWalletBase[] {
    return [...this.wallets];
  }
}

// Singleton instance
let basePoolInstance: IntermediateWalletPoolBase | null = null;

/**
 * Get Base intermediate wallet pool singleton
 */
export function getBaseIntermediateWalletPool(): IntermediateWalletPoolBase {
  if (!basePoolInstance) {
    basePoolInstance = new IntermediateWalletPoolBase('ZK_INTERMEDIATE_WALLETS_BASE');
  }
  return basePoolInstance;
}
