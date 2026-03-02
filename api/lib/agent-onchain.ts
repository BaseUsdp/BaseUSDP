/**
 * Agent On-Chain Integration for ERC-8004 Identity & Reputation
 * Handles contract interactions for agent passport registration,
 * reputation tracking, and trust score management.
 * Mirrors void402-base.ts patterns for Base L2.
 */

import { ethers } from 'ethers';
import { getBaseProvider, getBaseSigner } from './void402-base.js';

// --- ABIs ---

export const AGENT_IDENTITY_REGISTRY_ABI = [
  'function registerAgent(string metadataURI) external returns (uint256)',
  'function registerAgentFor(address operator, string metadataURI) external returns (uint256)',
  'function verifyAgent(uint256 tokenId) external',
  'function revokeAgent(uint256 tokenId) external',
  'function isAgentVerified(uint256 tokenId) view returns (bool)',
  'function isAgentRevoked(uint256 tokenId) view returns (bool)',
  'function getPassportId(address operator) view returns (uint256)',
  'function updateMetadata(uint256 tokenId, string metadataURI) external',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event AgentRegistered(uint256 indexed tokenId, address indexed operator, string metadataURI)',
  'event AgentVerified(uint256 indexed tokenId)',
  'event AgentRevoked(uint256 indexed tokenId)',
  'event MetadataUpdated(uint256 indexed tokenId, string metadataURI)',
];

export const AGENT_REPUTATION_REGISTRY_ABI = [
  'function postSignal(uint256 tokenId, bool positive, string reason) external',
  'function recordTransaction(uint256 tokenId, uint256 amountUSDC6Dec) external',
  'function getReputation(uint256 tokenId) view returns (uint256 positiveSignals, uint256 negativeSignals, uint256 txCount, uint256 totalVolume, uint256 trustScore)',
  'function getTrustScore(uint256 tokenId) view returns (uint256)',
  'function addReporter(address reporter) external',
  'function removeReporter(address reporter) external',
  'function authorizedReporters(address) view returns (bool)',
  'event SignalPosted(uint256 indexed tokenId, bool positive, string reason, address indexed reporter)',
  'event TransactionRecorded(uint256 indexed tokenId, uint256 amountUSDC6Dec, address indexed reporter)',
];

// --- Contract Address Getters ---

export function getIdentityRegistryAddress(): string {
  const address = process.env.AGENT_IDENTITY_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error('AGENT_IDENTITY_REGISTRY_ADDRESS not configured');
  }
  return address;
}

export function getReputationRegistryAddress(): string {
  const address = process.env.AGENT_REPUTATION_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error('AGENT_REPUTATION_REGISTRY_ADDRESS not configured');
  }
  return address;
}

// --- Contract Instance Factories ---

export function getIdentityRegistryContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const address = getIdentityRegistryAddress();
  const providerOrSigner = signerOrProvider || getBaseProvider();
  return new ethers.Contract(address, AGENT_IDENTITY_REGISTRY_ABI, providerOrSigner);
}

export function getReputationRegistryContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const address = getReputationRegistryAddress();
  const providerOrSigner = signerOrProvider || getBaseProvider();
  return new ethers.Contract(address, AGENT_REPUTATION_REGISTRY_ABI, providerOrSigner);
}

// --- On-Chain Functions ---

/**
 * Register an agent on-chain by minting a passport NFT.
 * Uses the relayer wallet (contract owner) to call registerAgentFor(),
 * minting a passport to a deterministic address derived from the agent ID.
 * This allows multiple agents to each have their own passport.
 */
export async function registerAgentOnChain(metadataURI: string, agentId?: string): Promise<{
  tokenId: number;
  txHash: string;
  agentAddress: string;
}> {
  const signer = getBaseSigner();
  const identity = getIdentityRegistryContract(signer);

  // Generate a deterministic address for this agent so each gets a unique passport
  const agentAddress = agentId
    ? ethers.computeAddress(ethers.keccak256(ethers.toUtf8Bytes(`agent-passport-${agentId}`)))
    : signer.address;

  const tx = await identity.registerAgentFor(agentAddress, metadataURI);
  const receipt = await tx.wait();

  // Parse AgentRegistered event to get tokenId
  const event = receipt.logs
    .map((log: any) => {
      try { return identity.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === 'AgentRegistered');

  const tokenId = event ? Number(event.args.tokenId) : 0;

  return { tokenId, txHash: receipt.hash, agentAddress };
}

/**
 * Record a transaction on-chain for reputation tracking.
 */
export async function recordTransactionOnChain(
  tokenId: number,
  amountUSDC6Dec: bigint
): Promise<string> {
  const signer = getBaseSigner();
  const reputation = getReputationRegistryContract(signer);

  const tx = await reputation.recordTransaction(tokenId, amountUSDC6Dec);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Post a reputation signal on-chain.
 */
export async function postSignalOnChain(
  tokenId: number,
  positive: boolean,
  reason: string
): Promise<string> {
  const signer = getBaseSigner();
  const reputation = getReputationRegistryContract(signer);

  const tx = await reputation.postSignal(tokenId, positive, reason);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Get the computed trust score for an agent (0-100).
 */
export async function getAgentTrustScore(tokenId: number): Promise<number> {
  const reputation = getReputationRegistryContract();
  const score = await reputation.getTrustScore(tokenId);
  return Number(score);
}

/**
 * Get full reputation data for an agent.
 */
export async function getAgentReputation(tokenId: number): Promise<{
  positiveSignals: number;
  negativeSignals: number;
  txCount: number;
  totalVolume: string;
  trustScore: number;
}> {
  const reputation = getReputationRegistryContract();
  const rep = await reputation.getReputation(tokenId);
  return {
    positiveSignals: Number(rep.positiveSignals),
    negativeSignals: Number(rep.negativeSignals),
    txCount: Number(rep.txCount),
    totalVolume: ethers.formatUnits(rep.totalVolume, 6),
    trustScore: Number(rep.trustScore),
  };
}

/**
 * Check if an agent's passport is verified on-chain.
 */
export async function isAgentVerified(tokenId: number): Promise<boolean> {
  const identity = getIdentityRegistryContract();
  return await identity.isAgentVerified(tokenId);
}

/**
 * Check if an agent's passport is revoked on-chain.
 */
export async function isAgentRevoked(tokenId: number): Promise<boolean> {
  const identity = getIdentityRegistryContract();
  return await identity.isAgentRevoked(tokenId);
}

/**
 * Sync the on-chain trust score to the database.
 */
export async function syncTrustScoreToDb(
  supabase: any,
  agentId: string,
  tokenId: number
): Promise<void> {
  const score = await getAgentTrustScore(tokenId);
  await supabase
    .from('agent_profiles')
    .update({
      trust_score: score,
      trust_score_updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
}
