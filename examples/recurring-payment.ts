/**
 * Recurring Payment Example
 *
 * Demonstrates setting up subscription-style recurring payments.
 * Uses a simple scheduler pattern that can be adapted to cron jobs or task queues.
 */

import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

interface Subscription {
  id: string;
  recipientAddress: string;
  amount: string;
  intervalMs: number;
  description: string;
  active: boolean;
  lastPaymentAt?: Date;
  nextPaymentAt: Date;
}

class RecurringPaymentManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private timer: NodeJS.Timeout | null = null;

  addSubscription(sub: Omit<Subscription, 'active' | 'nextPaymentAt'>) {
    const subscription: Subscription = {
      ...sub,
      active: true,
      nextPaymentAt: new Date(Date.now() + sub.intervalMs),
    };
    this.subscriptions.set(sub.id, subscription);
    console.log(`Subscription ${sub.id} added: ${sub.amount} USDC every ${sub.intervalMs / 1000}s`);
  }

  cancelSubscription(id: string) {
    const sub = this.subscriptions.get(id);
    if (sub) {
      sub.active = false;
      console.log(`Subscription ${id} cancelled`);
    }
  }

  async processPayments() {
    const now = new Date();

    for (const [id, sub] of this.subscriptions) {
      if (!sub.active || sub.nextPaymentAt > now) continue;

      try {
        const payment = await client.payments.create({
          amount: sub.amount,
          currency: 'USDC',
          description: `Recurring: ${sub.description}`,
          metadata: { subscriptionId: id },
        });

        console.log(`Processed subscription ${id}: ${payment.id}`);
        sub.lastPaymentAt = now;
        sub.nextPaymentAt = new Date(now.getTime() + sub.intervalMs);
      } catch (error) {
        console.error(`Failed to process subscription ${id}:`, error);
      }
    }
  }

  start(checkIntervalMs = 60000) {
    this.timer = setInterval(() => this.processPayments(), checkIntervalMs);
    console.log('Recurring payment manager started');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Recurring payment manager stopped');
    }
  }
}

// Usage
const manager = new RecurringPaymentManager();

manager.addSubscription({
  id: 'sub-001',
  recipientAddress: '0xServiceProvider...',
  amount: '9.99',
  intervalMs: 30 * 24 * 60 * 60 * 1000, // Monthly
  description: 'Premium subscription',
});

manager.start();
