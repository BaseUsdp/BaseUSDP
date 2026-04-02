/**
 * Privacy-related type definitions for BaseUSDP
 */

export interface DepositNote {
  version: string;
  secret: string;
  nullifier: string;
  commitment: string;
  amount: string;
  tier: number;
  leafIndex: number;
  timestamp: number;
  chainId: number;
  transactionHash: string;
}

export interface ZKProof {
  proof: { pi_a: [string, string]; pi_b: [[string, string], [string, string]]; pi_c: [string, string]; protocol: string };
  publicInputs: { root: string; nullifierHash: string; recipient: string; amount: string; fee: string };
}

export interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
  leaf: string;
}

export interface PoolStats {
  totalDeposits: number;
  totalValue: string;
  anonymitySet: Record<number, number>;
  lastDepositTimestamp: number;
}

export type ProofGenerationStatus =
  | { stage: 'idle' }
  | { stage: 'downloading'; progress: number }
  | { stage: 'generating'; progress: number }
  | { stage: 'complete'; proof: ZKProof }
  | { stage: 'error'; error: string };
