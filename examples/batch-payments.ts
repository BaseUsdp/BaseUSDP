/**
 * Batch Payments Example
 *
 * Demonstrates how to process multiple payments efficiently.
 * Useful for payroll, rewards distribution, or bulk refunds.
 */

import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

interface PaymentRecipient {
  address: string;
  amount: string;
  reference: string;
}

async function processBatchPayments(recipients: PaymentRecipient[]) {
  console.log(`Processing batch of ${recipients.length} payments...`);

  const results = [];

  for (const recipient of recipients) {
    try {
      const transfer = await client.transfers.create({
        recipient: recipient.address,
        amount: recipient.amount,
        metadata: { reference: recipient.reference },
      });

      results.push({
        reference: recipient.reference,
        status: 'submitted',
        transferId: transfer.id,
      });

      console.log(`Submitted: ${recipient.reference} -> ${recipient.amount} USDC`);

      // Small delay between submissions to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        reference: recipient.reference,
        status: 'failed',
        error: (error as Error).message,
      });
      console.error(`Failed: ${recipient.reference} - ${(error as Error).message}`);
    }
  }

  // Wait for all confirmations
  const confirmed = await Promise.allSettled(
    results
      .filter((r) => r.status === 'submitted')
      .map((r) => client.transfers.waitForConfirmation(r.transferId!))
  );

  console.log('\nBatch Summary:');
  console.log(`Total: ${recipients.length}`);
  console.log(`Submitted: ${results.filter((r) => r.status === 'submitted').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`);

  return results;
}

// Example usage
const recipients: PaymentRecipient[] = [
  { address: '0xAlice...', amount: '100.00', reference: 'PAY-001' },
  { address: '0xBob...', amount: '150.00', reference: 'PAY-002' },
  { address: '0xCharlie...', amount: '75.50', reference: 'PAY-003' },
];

processBatchPayments(recipients).catch(console.error);
