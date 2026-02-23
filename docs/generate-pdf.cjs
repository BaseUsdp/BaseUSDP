const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 70, left: 55, right: 55 },
  autoFirstPage: false,
  bufferPages: true,
  info: {
    Title: 'ORB402 Documentation',
    Author: 'ORB402',
    Subject: 'The Confidential Payment Layer for the Web 4.0 Economy',
  },
});

const outPath = path.join(__dirname, 'ORB402-Documentation.pdf');
doc.pipe(fs.createWriteStream(outPath));

const COLORS = {
  primary: '#7c3aed',
  dark: '#1a1a2e',
  text: '#2d2d3f',
  muted: '#6b7280',
  white: '#ffffff',
  lightBg: '#f3f0ff',
  tableBorder: '#e5e7eb',
  tableHeader: '#ede9fe',
  link: '#5b21b6',
};

let pageNum = 0;

function addHeader() {
  doc.save();
  doc.rect(0, 0, doc.page.width, 40).fill(COLORS.dark);
  doc.fontSize(9).fill(COLORS.white).font('Helvetica-Bold')
    .text('ORB402 Documentation', 55, 14, { width: 300 });
  doc.fontSize(8).fill('#a78bfa').font('Helvetica')
    .text('The Confidential Payment Layer for the Web 4.0 Economy', 55, 26, { width: 400 });
  doc.restore();
}

function addFooter() {
  pageNum++;
  doc.save();
  const y = doc.page.height - 40;
  doc.rect(0, y, doc.page.width, 40).fill(COLORS.dark);
  doc.fontSize(8).fill('#a78bfa').font('Helvetica')
    .text(`Page ${pageNum}`, 0, y + 15, { align: 'center', width: doc.page.width });
  doc.fontSize(7).fill('#6b7280')
    .text('orb402.com', 55, y + 15);
  doc.fontSize(7).fill('#6b7280')
    .text('February 2026', doc.page.width - 130, y + 15);
  doc.restore();
}

// With bufferPages, we add headers/footers after all content is generated

// Only start a new page if we've used a meaningful portion of the current one
function newSectionPage() {
  // If we're still near the top (less than 25% used), don't add a page
  const usableHeight = doc.page.height - 130; // minus margins/header/footer
  const used = doc.y - 60;
  if (used > usableHeight * 0.25) {
    doc.addPage();
    doc.y = 60;
  }
}

// ===== COVER PAGE =====
doc.addPage();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.dark);

// Title block
doc.fontSize(42).fill(COLORS.white).font('Helvetica-Bold')
  .text('ORB402', 55, 200, { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(14).fill('#a78bfa').font('Helvetica')
  .text('DOCUMENTATION', { align: 'center', characterSpacing: 8 });
doc.moveDown(2);
doc.fontSize(16).fill('#d4d4d8').font('Helvetica')
  .text('The Confidential Payment Layer', { align: 'center' });
doc.fontSize(16).fill('#a78bfa')
  .text('for the Web 4.0 Economy', { align: 'center' });

doc.moveDown(4);
doc.fontSize(10).fill('#6b7280')
  .text('Version 1.0  |  February 2026', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(9).fill('#6b7280')
  .text('x402 Protocol  |  Zero-Knowledge Proofs  |  Base L2', { align: 'center' });

// Decorative line
doc.moveDown(3);
doc.save();
doc.moveTo(doc.page.width / 2 - 100, doc.y).lineTo(doc.page.width / 2 + 100, doc.y)
  .strokeColor('#7c3aed').lineWidth(2).stroke();
doc.restore();

doc.moveDown(2);
doc.fontSize(9).fill('#4b5563')
  .text('Built for autonomous agents, institutions, and developers.', { align: 'center' });

// ===== TABLE OF CONTENTS =====
doc.addPage();
doc.y = 60;

doc.fontSize(24).fill(COLORS.primary).font('Helvetica-Bold').text('Table of Contents');
doc.moveDown(1);

const toc = [
  ['1', 'Introduction', 3],
  ['2', 'What is Web 4.0?', 4],
  ['3', 'Platform Overview', 5],
  ['4', 'Getting Started', 6],
  ['5', 'Dashboard Guide', 7],
  ['6', 'Payments & Transfers', 8],
  ['7', 'x402 Protocol', 9],
  ['8', 'Privacy & Zero-Knowledge Proofs', 10],
  ['9', 'Autonomous Agents', 12],
  ['10', 'Smart Contracts', 13],
  ['11', 'FAQ', 14],
  ['12', 'Legal & Support', 15],
];

toc.forEach(([num, title]) => {
  doc.fontSize(11).fill(COLORS.text).font('Helvetica');
  const prefix = `${num}.  `;
  doc.font('Helvetica-Bold').text(prefix, { continued: true });
  doc.font('Helvetica').text(title);
  doc.moveDown(0.3);
});

// ===== HELPERS =====

function sectionTitle(text) {
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.moveDown(1);
  doc.fontSize(22).fill(COLORS.primary).font('Helvetica-Bold').text(text);
  doc.save();
  doc.moveTo(55, doc.y + 2).lineTo(250, doc.y + 2).strokeColor(COLORS.primary).lineWidth(2).stroke();
  doc.restore();
  doc.moveDown(0.8);
}

function subTitle(text) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.5);
  doc.fontSize(15).fill(COLORS.dark).font('Helvetica-Bold').text(text);
  doc.moveDown(0.4);
}

function subSubTitle(text) {
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc.moveDown(0.3);
  doc.fontSize(12).fill(COLORS.primary).font('Helvetica-Bold').text(text);
  doc.moveDown(0.3);
}

function para(text) {
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc.fontSize(10).fill(COLORS.text).font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.4);
}

function bullet(text) {
  if (doc.y > doc.page.height - 80) doc.addPage();
  doc.fontSize(10).fill(COLORS.primary).font('Helvetica-Bold').text('  \u2022  ', { continued: true });
  doc.fill(COLORS.text).font('Helvetica').text(text, { lineGap: 2 });
  doc.moveDown(0.15);
}

function numberedItem(num, text) {
  if (doc.y > doc.page.height - 80) doc.addPage();
  doc.fontSize(10).fill(COLORS.primary).font('Helvetica-Bold').text(`  ${num}.  `, { continued: true });
  doc.fill(COLORS.text).font('Helvetica').text(text, { lineGap: 2 });
  doc.moveDown(0.15);
}

function table(headers, rows) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  const startX = 55;
  const colWidth = (doc.page.width - 110) / headers.length;
  const rowHeight = 22;
  let y = doc.y;

  // Header
  doc.rect(startX, y, doc.page.width - 110, rowHeight).fill(COLORS.tableHeader);
  headers.forEach((h, i) => {
    doc.fontSize(9).fill(COLORS.dark).font('Helvetica-Bold')
      .text(h, startX + i * colWidth + 6, y + 6, { width: colWidth - 12 });
  });
  y += rowHeight;

  // Rows
  rows.forEach((row, ri) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = doc.y;
    }
    const bg = ri % 2 === 0 ? '#ffffff' : '#faf9ff';
    doc.rect(startX, y, doc.page.width - 110, rowHeight).fill(bg);
    doc.rect(startX, y, doc.page.width - 110, rowHeight).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();
    row.forEach((cell, i) => {
      doc.fontSize(9).fill(COLORS.text).font('Helvetica')
        .text(cell, startX + i * colWidth + 6, y + 6, { width: colWidth - 12 });
    });
    y += rowHeight;
  });

  doc.y = y + 8;
  doc.moveDown(0.3);
}

function infoBox(title, text) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  const boxY = doc.y;
  doc.rect(55, boxY, doc.page.width - 110, 4).fill(COLORS.primary);
  doc.rect(55, boxY + 4, doc.page.width - 110, 50).fill(COLORS.lightBg);
  doc.fontSize(10).fill(COLORS.primary).font('Helvetica-Bold')
    .text(title, 65, boxY + 12);
  doc.fontSize(9).fill(COLORS.text).font('Helvetica')
    .text(text, 65, boxY + 26, { width: doc.page.width - 140 });
  doc.y = boxY + 62;
  doc.moveDown(0.5);
}

// ===== SECTION 1: INTRODUCTION =====
doc.addPage();
sectionTitle('1. Introduction');

subTitle('What is ORB402?');
para('ORB402 is a privacy-first payment infrastructure platform built for the Web 4.0 economy. By combining Zero-Knowledge Proofs (ZK Proofs) with the internet-native x402 payment standard, ORB402 delivers the world\'s first confidential payment layer for on-chain commerce.');
para('ORB402 enables individuals, institutions, and autonomous AI agents to transact on-chain with complete privacy \u2014 ensuring that transaction amounts, balances, and financial activity remain confidential while still being cryptographically verifiable on the blockchain.');

subTitle('Why ORB402?');
para('Public blockchains promised a revolution in peer-to-peer finance, but their inherent transparency created a critical barrier to mainstream adoption. For institutions, enterprises, and any entity that values financial privacy, broadcasting every transaction to the world is not just a risk \u2014 it is a non-starter.');
para('ORB402 was created to solve this fundamental problem \u2014 and to power the Web 4.0 economy.');

subTitle('Key Value Propositions');
bullet('256-bit ZK Encryption: Military-grade encryption for all transactions');
bullet('< 2s Settlement: Near-instant transaction finality on Base L2');
bullet('100% Privacy Guarantee: Zero data leaks by design');
bullet('x402 Protocol: Internet-native payment standard for machine-to-machine commerce');
bullet('Agent Compatible: Built for autonomous AI agents and Web 4.0 participants');

// ===== SECTION 2: WEB 4.0 =====
newSectionPage();
sectionTitle('2. What is Web 4.0?');

para('Web 4.0 represents the next evolution of the internet \u2014 an autonomous, agent-driven economy where AI agents, machines, and humans transact value seamlessly.');

subTitle('The Evolution of the Web');
table(
  ['Era', 'Focus', 'Key Innovation'],
  [
    ['Web 1.0', 'Read-Only', 'Static web pages'],
    ['Web 2.0', 'Read-Write', 'Social platforms, user-generated content'],
    ['Web 3.0', 'Read-Write-Own', 'Decentralization, blockchain, tokens'],
    ['Web 4.0', 'Read-Write-Own-Transact', 'Autonomous agents, machine commerce, privacy-first'],
  ]
);

subTitle('How Web 4.0 Differs from Web3');
para('Unlike Web3, which focused primarily on decentralization, Web 4.0 adds intelligence and autonomy. AI agents independently negotiate, pay, and settle transactions without human intervention. ORB402 provides the confidential payment infrastructure that makes this possible, ensuring privacy for both human and machine participants.');

// ===== SECTION 3: PLATFORM OVERVIEW =====
newSectionPage();
sectionTitle('3. Platform Overview');

subTitle('Technology Stack');
table(
  ['Layer', 'Technology'],
  [
    ['Blockchain', 'Base (Ethereum L2)'],
    ['Privacy', 'Zero-Knowledge Proofs, FHE'],
    ['Payment Standard', 'x402 (HTTP 402)'],
    ['Smart Contracts', 'Solidity'],
    ['Frontend', 'React 18, TypeScript, Vite'],
    ['Styling', 'Tailwind CSS, Shadcn/ui'],
    ['Backend', 'Vercel Functions (Node.js)'],
    ['Database', 'Supabase (PostgreSQL)'],
  ]
);

subTitle('Supported Wallets');
table(['Wallet', 'Chain Support'], [
  ['Phantom', 'EVM (Base)'],
  ['MetaMask', 'EVM (Base)'],
]);

subTitle('Supported Tokens');
table(['Token', 'Network'], [
  ['USDC', 'Base'],
  ['USDT', 'Base'],
]);

// ===== SECTION 4: GETTING STARTED =====
newSectionPage();
sectionTitle('4. Getting Started');

subTitle('Step 1: Connect Your Wallet');
numberedItem(1, 'Navigate to orb402.com');
numberedItem(2, 'Click the "Dashboard" button on the homepage or "Connect Wallet" in the navigation bar');
numberedItem(3, 'Select your preferred wallet provider (Phantom or MetaMask)');
numberedItem(4, 'Approve the connection request in your wallet');
numberedItem(5, 'Sign the authentication message when prompted \u2014 this proves wallet ownership without spending gas');

subTitle('Step 2: Authenticate');
para('Once your wallet is connected:');
numberedItem(1, 'The platform requests a one-time nonce from the backend');
numberedItem(2, 'You sign this nonce with your wallet (no gas fee required)');
numberedItem(3, 'The backend verifies your signature and issues a session token');
numberedItem(4, 'Your session remains active for 24 hours');

subTitle('Step 3: Set Up Your Profile');
para('After authentication, navigate to the Settings tab in the dashboard:');
numberedItem(1, 'Create a Username: Choose a unique username (e.g., @alice) so others can send you payments by name');
numberedItem(2, 'Set Privacy Level: Choose your default privacy preference (Public, Partial, or Full)');
numberedItem(3, 'Review Wallet Info: Confirm your connected wallet address and network');

subTitle('Step 4: Make Your First Deposit');
numberedItem(1, 'Click the "Deposit" button from the dashboard overview');
numberedItem(2, 'Choose your deposit method: Direct Deposit or Privacy Deposit (routed through the privacy mixer)');
numberedItem(3, 'Enter the amount you wish to deposit');
numberedItem(4, 'Approve the deposit amount from your wallet when prompted');
numberedItem(5, 'Your balance updates once the transaction is confirmed on-chain');

// ===== SECTION 5: DASHBOARD GUIDE =====
newSectionPage();
sectionTitle('5. Dashboard Guide');

para('The ORB402 dashboard is your central hub for managing all aspects of your confidential finances.');

subTitle('Overview Tab');
bullet('Encrypted Balance: Your total holdings displayed in encrypted format. Toggle "Show Balance" to reveal.');
bullet('Quick Actions: One-click buttons for Deposit, Send, Withdraw, and Pay x402');
bullet('Recent Transactions: Your last 10 transactions at a glance');
bullet('Portfolio Card: Visual summary of your total holdings');

subTitle('Navigation Tabs');
table(['Tab', 'Description'], [
  ['Overview', 'Balance, quick actions, recent activity'],
  ['Payments', 'Send, receive, and manage x402 payment requests'],
  ['Withdraw', 'Withdraw funds to external wallets'],
  ['History', 'Full transaction history with filters'],
  ['Settings', 'Username, privacy preferences, wallet management'],
  ['Messages', 'Peer-to-peer encrypted messaging'],
  ['AI Terminal', 'Chat-based AI agent interface'],
  ['Agents', 'Autonomous agent management'],
]);

// ===== SECTION 6: PAYMENTS =====
newSectionPage();
sectionTitle('6. Payments & Transfers');

subTitle('Sending Payments');
numberedItem(1, 'Navigate to Payments > Send');
numberedItem(2, 'Enter the recipient\'s wallet address or @username');
numberedItem(3, 'Select your token (USDC or USDT)');
numberedItem(4, 'Enter the amount');
numberedItem(5, 'Choose your privacy level: Public, Partial, or Full');
numberedItem(6, 'Review the transaction details');
numberedItem(7, 'Confirm and sign the transaction in your wallet');

subTitle('Receiving Payments');
numberedItem(1, 'Navigate to Payments > Receive');
numberedItem(2, 'A QR code is generated with your wallet address');
numberedItem(3, 'Copy your address or use the Share button to send it to the payer');
numberedItem(4, 'For maximum privacy, use an x402 Request instead \u2014 direct transfers to your address bypass the privacy system');
numberedItem(5, 'If someone sends to your address via ORB402 "Send", funds are routed to your intermediate wallet (private)');
numberedItem(6, 'Incoming payments appear in your transaction history');

subTitle('Withdrawing Funds');
numberedItem(1, 'Navigate to Withdraw');
numberedItem(2, 'Enter the destination wallet address');
numberedItem(3, 'Select token and amount');
numberedItem(4, 'A 1% withdrawal fee is deducted automatically');
numberedItem(5, 'Confirm and sign the transaction');

// ===== SECTION 7: x402 PROTOCOL =====
newSectionPage();
sectionTitle('7. x402 Protocol');

subTitle('What is x402?');
para('x402 is an internet-native payment standard that implements HTTP 402 (Payment Required). It enables seamless machine-to-machine payments, micropayments, and API monetization. Any website, application, or AI agent can request and process payments instantly using this open standard.');

subTitle('How x402 Works');
numberedItem(1, 'A service provider creates an x402 payment request specifying amount, recipient, and service details');
numberedItem(2, 'The request generates a unique payment ID and shareable link (e.g., orb402.com/pay/{id})');
numberedItem(3, 'The payer opens the link and reviews the payment request');
numberedItem(4, 'The payer settles the payment with an encrypted zero-knowledge proof');
numberedItem(5, 'The smart contract verifies the proof and executes the transfer');
numberedItem(6, 'Both parties receive confirmation \u2014 amounts remain encrypted on-chain');

subTitle('Creating x402 Payment Requests');
numberedItem(1, 'Navigate to Payments > x402 Requests');
numberedItem(2, 'Click "Create New Request"');
numberedItem(3, 'Specify amount, description or service ID, and optional expiration');
numberedItem(4, 'Share the generated payment link with the payer');
numberedItem(5, 'Monitor the request status (Pending, Settled, or Cancelled)');

subTitle('Agent-Compatible Payments');
bullet('AI agents can autonomously create and settle x402 payment requests');
bullet('No human intervention required for machine-to-machine transactions');
bullet('Agents authenticate via API keys within configurable spending policies');
bullet('Enables API monetization, subscription payments, and usage-based billing');

// ===== SECTION 8: PRIVACY =====
newSectionPage();
sectionTitle('8. Privacy & Zero-Knowledge Proofs');

subTitle('What Are Zero-Knowledge Proofs?');
para('Zero-Knowledge Proofs (ZK Proofs) are cryptographic methods that allow one party to prove to another that a statement is true without revealing any additional information. In the context of ORB402, this means your transaction amounts, balances, and financial data remain private while still being verifiable on the blockchain.');

subTitle('Privacy Levels');

subSubTitle('Public Mode');
bullet('Transactions are fully visible on-chain');
bullet('Amounts and wallet addresses are public');
bullet('Equivalent to standard blockchain transparency');

subSubTitle('Partial Mode');
bullet('Transaction amounts are hidden via ZK proof');
bullet('Sender and recipient addresses are visible');
bullet('Useful when relationships are public but financial details should remain private');

subSubTitle('Full Mode');
bullet('Both amounts AND parties are hidden');
bullet('Complete transaction privacy');
bullet('The strongest privacy setting available');

subTitle('How Privacy Works');
numberedItem(1, 'User initiates a transfer and selects a privacy level');
numberedItem(2, 'Amount is encrypted using the recipient\'s public key');
numberedItem(3, 'A ZK proof is generated proving the transfer is valid without revealing the amount');
numberedItem(4, 'The proof is submitted to the X402PrivacyPool smart contract');
numberedItem(5, 'The contract verifies the proof mathematically \u2014 no decryption needed');
numberedItem(6, 'The transfer executes without exposing the amount on-chain');
numberedItem(7, 'The recipient decrypts the amount using their private key');

subTitle('Data Protection Guarantees');
bullet('No transaction data leaks to third parties');
bullet('Validators cannot view transfer amounts');
bullet('Block explorers display only encrypted values');
bullet('100% privacy guarantee by design');
bullet('256-bit AES-grade encryption strength');

// ===== SECTION 9: AGENTS =====
newSectionPage();
sectionTitle('9. Autonomous Agents');

para('ORB402\'s Agent system enables autonomous AI agents to transact on the platform independently. This is a core component of the Web 4.0 vision \u2014 where machines and AI systems participate in commerce without requiring human intervention.');

subTitle('Registering an Agent');
numberedItem(1, 'Navigate to the Agents tab in the dashboard');
numberedItem(2, 'Click "Register New Agent"');
numberedItem(3, 'Provide an Agent Name and Description');
numberedItem(4, 'The agent receives a unique ID and associated wallet address');

subTitle('API Key Management');
para('Each agent requires an API key to authenticate with the ORB402 backend:');
numberedItem(1, 'Select your agent from the Agents list');
numberedItem(2, 'Click "Generate API Key"');
numberedItem(3, 'Store the key securely \u2014 it is shown only once');
numberedItem(4, 'You can regenerate the key at any time (invalidates the previous key)');

subTitle('Spending Policies');
table(['Policy', 'Description', 'Example'], [
  ['Max Per Transaction', 'Maximum amount for a single transaction', '$1,000'],
  ['Daily Limit', 'Aggregate spending cap per 24-hour period', '$5,000'],
]);
para('Spending policies are enforced server-side. If an agent attempts to exceed its limits, the transaction is rejected.');

subTitle('Agent Logs & Audit Trail');
bullet('Transaction timestamp, amount, token, and recipient');
bullet('Transaction status (success, failed, pending)');
bullet('Full audit history for compliance and review');

subTitle('Use Cases');
bullet('API Monetization: Agents pay per API call automatically');
bullet('Supply Chain Payments: Machines settle invoices autonomously');
bullet('AI Service Commerce: AI agents negotiate and pay for compute, data, or services');
bullet('Subscription Management: Automated recurring payments within spending limits');

// ===== SECTION 10: SMART CONTRACTS =====
newSectionPage();
sectionTitle('10. Smart Contracts');

para('ORB402\'s on-chain infrastructure consists of four core smart contracts deployed on Base (Ethereum L2).');

subTitle('X402PrivacyPool');
para('The main privacy pool contract for confidential transactions.');
bullet('Deposit USDC into the privacy pool');
bullet('Withdraw with a 1% fee');
bullet('Upload and verify Zero-Knowledge proofs');
bullet('Internal transfers (user-to-user via authorized relayer)');
bullet('External transfers (pool-to-external-address via relayer)');

infoBox('Parameters', 'Withdrawal Fee: 1% (100 basis points)  |  Pool Maintenance Fee: 0.5%');

subTitle('FHERC20 Token');
para('An ERC20 token with Fully Homomorphic Encryption (FHE) for confidential balances and transfers.');
bullet('Encrypted balance storage using FHE');
bullet('Confidential transfers without revealing amounts');
bullet('Privacy level settings (Public, Partial, Full)');
bullet('Sealed output for balance queries (only the owner can decrypt)');

subTitle('ORB402 Facilitator');
para('The on-chain facilitator for x402 payment verification and settlement.');
bullet('Create x402 payment requests on-chain');
bullet('Verify and settle encrypted payments');
bullet('Automated transfer execution upon proof verification');

subTitle('Deposit Router');
para('Routes ERC20 deposits with gas funding in a single transaction.');
bullet('Pull tokens from user to holding wallet');
bullet('Forward ETH for backend gas funding');
bullet('Admin recovery functions for accidentally sent tokens or ETH');

// ===== SECTION 11: FAQ =====
newSectionPage();
sectionTitle('11. FAQ');

const faqs = [
  ['What is Web 4.0?', 'Web 4.0 represents the next evolution of the internet \u2014 an autonomous, agent-driven economy where AI agents, machines, and humans transact value seamlessly. Unlike Web3 which focused on decentralization, Web 4.0 adds intelligence and autonomy.'],
  ['What are Zero-Knowledge Proofs?', 'ZK Proofs are cryptographic methods that allow one party to prove to another that a statement is true without revealing any additional information. Your transaction amounts, balances, and financial data remain private while still being verifiable on the blockchain.'],
  ['What is the x402 protocol?', 'x402 is an internet-native payment standard that implements HTTP 402 (Payment Required). It enables seamless machine-to-machine payments, micropayments, and API monetization.'],
  ['How does ORB402 protect my privacy?', 'ORB402 encrypts your transaction amounts and balances using ZK Proof technology. Only you can see your true balances. Third parties, including validators and observers, cannot view your financial activity.'],
  ['Can AI agents use ORB402?', 'Yes. ORB402 is built for the Web 4.0 agentic economy. AI agents can autonomously make and receive payments using the x402 protocol without exposing sensitive financial data.'],
  ['Which blockchain does ORB402 operate on?', 'ORB402 operates on Base (Ethereum L2) with ZK Proof capabilities for privacy. Transactions benefit from low fees and fast finality.'],
  ['What wallets are supported?', 'ORB402 supports Phantom (EVM) and MetaMask for connecting to the Base network.'],
  ['What tokens are supported?', 'Currently, ORB402 supports USDC and USDT on the Base network.'],
];

faqs.forEach(([q, a]) => {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.fontSize(11).fill(COLORS.dark).font('Helvetica-Bold').text(q);
  doc.moveDown(0.2);
  doc.fontSize(10).fill(COLORS.text).font('Helvetica').text(a, { lineGap: 2 });
  doc.moveDown(0.7);
});

// ===== SECTION 14: LEGAL =====
sectionTitle('12. Legal & Support');

subTitle('Legal');
bullet('Privacy Policy: Available at orb402.com/privacy-policy');
bullet('Terms and Conditions: Available at orb402.com/terms-and-conditions');

subTitle('Support & Community');
bullet('Telegram: Join the ORB402 community on Telegram for support and updates');
bullet('Documentation: This document serves as the primary reference for platform usage');

subTitle('Contact');
para('For questions, issues, or partnership inquiries, reach out through the community Telegram channel or the contact options available on the ORB402 website.');

// Final closing - only add decorative ending if there's room on current page
if (doc.y > doc.page.height - 150) doc.addPage();
doc.moveDown(1.5);
doc.save();
doc.moveTo(doc.page.width / 2 - 100, doc.y).lineTo(doc.page.width / 2 + 100, doc.y)
  .strokeColor(COLORS.primary).lineWidth(2).stroke();
doc.restore();
doc.moveDown(1.5);
doc.fontSize(12).fill(COLORS.primary).font('Helvetica-Bold')
  .text('ORB402', { align: 'center' });
doc.fontSize(10).fill(COLORS.muted).font('Helvetica')
  .text('The Confidential Payment Layer for the Web 4.0 Economy', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(9).fill(COLORS.muted)
  .text('Document Version 1.0  |  February 2026', { align: 'center' });

// Record which page has content, remove empty trailing pages
const lastContentPage = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;

// Add headers and footers to all content pages (except cover page 0)
const totalPages = lastContentPage + 1;
const contentPages = totalPages - 1; // exclude cover
for (let i = 1; i < totalPages; i++) {
  doc.switchToPage(i);
  // Header
  doc.save();
  doc.rect(0, 0, doc.page.width, 40).fill(COLORS.dark);
  doc.fontSize(9).fill(COLORS.white).font('Helvetica-Bold')
    .text('ORB402 Documentation', 55, 14, { width: 300, lineBreak: false });
  doc.fontSize(8).fill('#a78bfa').font('Helvetica')
    .text('The Confidential Payment Layer for the Web 4.0 Economy', 55, 26, { width: 400, lineBreak: false });
  doc.restore();
  // Footer
  doc.save();
  const fy = doc.page.height - 35;
  doc.rect(0, fy - 5, doc.page.width, 40).fill(COLORS.dark);
  doc.fontSize(8).fill('#a78bfa').font('Helvetica')
    .text(`Page ${i} of ${contentPages}`, 0, fy + 5, { align: 'center', width: doc.page.width, lineBreak: false });
  doc.fontSize(7).fill('#6b7280')
    .text('orb402.com', 55, fy + 5, { lineBreak: false });
  doc.fontSize(7).fill('#6b7280')
    .text('February 2026', doc.page.width - 130, fy + 5, { lineBreak: false });
  doc.restore();
}

doc.end();
console.log('PDF generated:', outPath);
