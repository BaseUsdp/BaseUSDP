/**
 * Token-2022 Confidential Transfer Service
 * 
 * Handles confidential token operations using SPL Token-2022
 * Program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getMint,
  getAccount,
  createMint,
  createAccount,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Token-2022 Program ID
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

export interface ConfidentialAccountInfo {
  publicKey: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  isConfigured: boolean;
}

export class Token2022Service {
  private connection: Connection;
  private splTokenCliPath: string;

  constructor(connection: Connection, splTokenCliPath: string = 'spl-token') {
    this.connection = connection;
    this.splTokenCliPath = splTokenCliPath;
  }

  /**
   * Create a new Token-2022 mint with confidential transfers enabled
   * Uses CLI command as TypeScript library may not fully support it
   */
  async createConfidentialMint(
    payer: Keypair,
    autoApprove: boolean = true
  ): Promise<PublicKey> {
    try {
      const approvalPolicy = autoApprove ? 'auto' : 'manual';
      const command = `${this.splTokenCliPath} --program-id ${TOKEN_2022_PROGRAM_ID.toString()} create-token --enable-confidential-transfers ${approvalPolicy}`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });

      // Parse mint address from output
      // Output format: "Creating token <MINT_ADDRESS>"
      const match = stdout.match(/Creating token (\w+)/);
      if (!match) {
        throw new Error('Failed to parse mint address from CLI output');
      }

      return new PublicKey(match[1]);
    } catch (error) {
      console.error('Error creating confidential mint:', error);
      throw error;
    }
  }

  /**
   * Configure a token account for confidential transfers
   */
  async configureConfidentialAccount(
    accountPubkey: PublicKey
  ): Promise<void> {
    try {
      const command = `${this.splTokenCliPath} configure-confidential-transfer-account --address ${accountPubkey.toString()}`;

      await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });
    } catch (error) {
      console.error('Error configuring confidential account:', error);
      throw error;
    }
  }

  /**
   * Create a token account (standard SPL Token)
   */
  async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    try {
      const account = await getOrCreateAssociatedTokenAccount(
        this.connection,
        payer,
        mint,
        owner,
        false, // allowOwnerOffCurve
        undefined, // commitment
        undefined, // confirmOptions
        TOKEN_2022_PROGRAM_ID // programId
      );

      return account.address;
    } catch (error) {
      console.error('Error creating token account:', error);
      throw error;
    }
  }

  /**
   * Deposit tokens into confidential balance
   */
  async depositConfidentialTokens(
    mint: PublicKey,
    accountPubkey: PublicKey,
    amount: number
  ): Promise<void> {
    try {
      const command = `${this.splTokenCliPath} deposit-confidential-tokens ${mint.toString()} ${amount} --address ${accountPubkey.toString()}`;

      await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });
    } catch (error) {
      console.error('Error depositing confidential tokens:', error);
      throw error;
    }
  }

  /**
   * Apply pending balance (required after receiving confidential tokens)
   */
  async applyPendingBalance(accountPubkey: PublicKey): Promise<void> {
    try {
      const command = `${this.splTokenCliPath} apply-pending-balance --address ${accountPubkey.toString()}`;

      await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });
    } catch (error) {
      console.error('Error applying pending balance:', error);
      throw error;
    }
  }

  /**
   * Transfer confidential tokens
   */
  async transferConfidential(
    mint: PublicKey,
    amount: number,
    sourceAccount: PublicKey,
    destinationAccount: PublicKey
  ): Promise<void> {
    try {
      const command = `${this.splTokenCliPath} transfer ${mint.toString()} ${amount} ${destinationAccount.toString()} --confidential --from ${sourceAccount.toString()}`;

      await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });
    } catch (error) {
      console.error('Error transferring confidential tokens:', error);
      throw error;
    }
  }

  /**
   * Withdraw tokens from confidential balance
   */
  async withdrawConfidentialTokens(
    mint: PublicKey,
    accountPubkey: PublicKey,
    amount: number
  ): Promise<void> {
    try {
      const command = `${this.splTokenCliPath} withdraw-confidential-tokens ${mint.toString()} ${amount} --address ${accountPubkey.toString()}`;

      await execAsync(command, {
        env: {
          ...process.env,
          SOLANA_CLI_CONFIG_PATH: process.env.SOLANA_CLI_CONFIG_PATH || '~/.config/solana/cli/config.yml',
        },
      });
    } catch (error) {
      console.error('Error withdrawing confidential tokens:', error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(accountPubkey: PublicKey): Promise<any> {
    try {
      const accountInfo = await getAccount(
        this.connection,
        accountPubkey,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      return accountInfo;
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Get mint information
   */
  async getMintInfo(mint: PublicKey): Promise<any> {
    try {
      const mintInfo = await getMint(
        this.connection,
        mint,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      return mintInfo;
    } catch (error) {
      console.error('Error getting mint info:', error);
      throw error;
    }
  }

  /**
   * Check if account is configured for confidential transfers
   * Note: This may require parsing account data to check extension
   */
  async isConfidentialAccountConfigured(
    accountPubkey: PublicKey
  ): Promise<boolean> {
    try {
      // Try to get account info - if it has confidential extension, it's configured
      const accountInfo = await this.getAccountInfo(accountPubkey);
      
      // Check if account has confidential transfer extension
      // This is a simplified check - actual implementation may need to parse extension data
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }
}

