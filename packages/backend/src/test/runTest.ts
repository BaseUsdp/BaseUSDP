/**
 * Simple Test Runner for Token-2022 Integration
 * Run with: npm run test:integration
 */

import { runTests } from './integration.test.js';

runTests().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

