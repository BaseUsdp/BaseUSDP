/**
 * Private Transfer Example
 *
 * Demonstrates how to perform a private USDC transfer using BaseUSDP.
 * The transfer is shielded using zero-knowledge proofs so the connection
 * between sender and recipient is not visible on-chain.
 */

import { BaseUSDP, ProofGenerator } from '@baseusdp/sdk';

async function privateTransfer() {
  const client = new BaseUSDP({
    network: 'base-mainnet',
  });

  // Connect wallet (in a real app, this uses the browser wallet)
  await client.connect();

  // Step 1: Check available balance in privacy pool
  const balance = await client.pool.getBalance();
  console.log('Pool balance:', balance.total, 'USDC');

  // Step 2: Select a deposit note to spend
  const notes = await client.pool.getNotes();
  const note = notes.find((n) => n.tier === 2 && !n.spent);

  if (!note) {
    console.error('No available deposit notes found');
    return;
  }

  // Step 3: Generate zero-knowledge proof
  console.log('Generating ZK proof (this may take 5-15 seconds)...');
  const proofGenerator = new ProofGenerator();
  const proof = await proofGenerator.generateTransferProof({
    note: note,
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    amount: '10.00',
  });

  console.log('Proof generated successfully');

  // Step 4: Submit the transfer
  const transfer = await client.transfers.submit({
    proof: proof.proof,
    publicInputs: proof.publicInputs,
  });

  console.log('Transfer submitted:', transfer.id);
  console.log('Transaction hash:', transfer.transactionHash);

  // Step 5: Wait for confirmation
  const result = await client.transfers.waitForConfirmation(transfer.id);
  console.log('Transfer confirmed at block:', result.blockNumber);
}

privateTransfer().catch(console.error);
