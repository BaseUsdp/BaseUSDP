/*
 * BASEUSDP Project Whitepaper — PDF generator.
 *
 * Renders an HTML document with print-targeted CSS and uses headless
 * Chrome / Edge to print it to PDF. This gives proper typography, tables,
 * gradients, and page-break control — far better than direct PDF drawing.
 *
 * Output: docs/BASEUSDP-Whitepaper.pdf
 * Run:    node docs/generate-whitepaper-pdf.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT_PDF = path.join(__dirname, 'BASEUSDP-Whitepaper.pdf');
const HTML_PATH = path.join(__dirname, 'BASEUSDP-Whitepaper.html');

// ---------- Locate a Chromium-family browser ----------
const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome / Edge found. Install one or edit candidates list.');
  process.exit(1);
}

// ---------- Helpers ----------

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// ---------- HTML body builders ----------

function metaItem(label, value) {
  return `
    <div class="meta-item">
      <div class="meta-label">${esc(label)}</div>
      <div class="meta-value">${esc(value)}</div>
    </div>`;
}

function tocRow(num, title, kicker) {
  return `
    <div class="toc-row">
      <div class="toc-num">${esc(num)}</div>
      <div class="toc-body">
        <div class="toc-title">${esc(title)}</div>
        <div class="toc-kicker">${esc(kicker)}</div>
      </div>
    </div>`;
}

function section(opts) {
  const { number, kicker, title, lead, body } = opts;
  return `
  <section class="section">
    <div class="section-kicker">SECTION ${String(number).padStart(2, '0')} · ${esc(kicker.toUpperCase())}</div>
    <h1 class="section-title">${esc(title)}</h1>
    <div class="section-underline"></div>
    ${lead ? `<p class="lead">${lead}</p>` : ''}
    ${body}
  </section>`;
}

function table(headers, rows) {
  return `
  <table class="data-table">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${r
              .map(
                (cell, i) =>
                  `<td${i === 0 ? ' class="first-col"' : ''}>${esc(cell)}</td>`
              )
              .join('')}</tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function callout(title, body) {
  return `
  <div class="callout">
    <div class="callout-title">${esc(title)}</div>
    <div class="callout-body">${esc(body)}</div>
  </div>`;
}

function quote(text, attribution) {
  return `
  <blockquote class="pull-quote">
    <p>${esc(text)}</p>
    ${attribution ? `<cite>${esc(attribution)}</cite>` : ''}
  </blockquote>`;
}

function cards(items) {
  return `
  <div class="cards">
    ${items
      .map(
        (it, i) => `
      <div class="card ${i % 2 === 0 ? 'card-dark' : 'card-light'}">
        <div class="card-num">${esc(it.number)}</div>
        <div class="card-title">${esc(it.title)}</div>
        <div class="card-body">${esc(it.body)}</div>
      </div>`
      )
      .join('')}
  </div>`;
}

function stats(items) {
  return `
  <div class="stat-strip">
    ${items
      .map(
        (s) => `
      <div class="stat">
        <div class="stat-label">${esc(s.label)}</div>
        <div class="stat-value">${esc(s.value)}</div>
      </div>`
      )
      .join('')}
  </div>`;
}

function bullets(items) {
  return `
  <ul class="bullets">
    ${items.map((b) => `<li>${esc(b)}</li>`).join('')}
  </ul>`;
}

function steps(items) {
  return `
  <ol class="steps">
    ${items.map((b) => `<li>${esc(b)}</li>`).join('')}
  </ol>`;
}

function codeBlock(text) {
  return `<pre class="code">${esc(text)}</pre>`;
}

function h3(text) {
  return `<h3 class="h3">${esc(text)}</h3>`;
}

function para(text) {
  return `<p>${esc(text)}</p>`;
}

// ---------- Build sections ----------

const SECTIONS = [
  section({
    number: 1,
    kicker: 'Background',
    title: 'Why privacy on a public chain.',
    lead:
      'Public blockchains broadcast every transaction in plaintext. For retail users this is uncomfortable; for businesses settling payroll it is a structural disadvantage; for autonomous AI agents executing strategy it is exploitable in real time.',
    body:
      para(
        'BASEUSDP is built on the premise that privacy should be the default behaviour of an on-chain dollar, not a feature behind a toggle. We accept the constraint that the chain is transparent, and we layer cryptographic privacy — fully homomorphic encryption (FHE) and zero-knowledge proofs (ZK) — on top of it so that amounts, balances, and counterparty links can be hidden while still being verifiable.'
      ) +
      para(
        'The product around that core is deliberately broad. A privacy-preserving stablecoin is only useful if people can actually receive it, send it, request it, monetise an API with it, give it to an AI agent to spend, and reconcile it across the surfaces they already use — wallets, phone numbers, Farcaster accounts, browsers, and machine-to-machine HTTP calls.'
      ) +
      h3('Design pillars') +
      bullets([
        'Privacy by default — amounts and balances are encrypted on-chain unless the user opts out.',
        'No new wallet — works with MetaMask, Coinbase Wallet, Phantom EVM, and any WalletConnect wallet.',
        'No new token — all settlement is in native USDC issued by Circle on Base.',
        'Agent-native — every channel is callable by autonomous agents through the same primitives humans use.',
        'Honest centralization — we document exactly which components are trusted and what they can and cannot do.',
      ]) +
      quote(
        'Privacy on a public blockchain is not a feature you add. It is the only viable user experience for money — and the only honest stance towards counterparty risk.',
        'BASEUSDP — Design Principles'
      ),
  }),

  section({
    number: 2,
    kicker: 'Architecture',
    title: 'A system in three layers.',
    lead:
      'BASEUSDP is composed of a settlement layer on Base, a privacy layer wrapping that settlement, and a set of channels that route value into and out of the privacy layer from real-world surfaces.',
    body:
      cards([
        { number: 1, title: 'Settlement', body: 'Base L2 · native USDC · audited Solidity suite' },
        { number: 2, title: 'Privacy', body: 'FHE-encrypted token · ZK shielded pool · three privacy levels' },
        { number: 3, title: 'Channels', body: 'Direct · x402 · SMS · Farcaster · Twitter · AI Terminal' },
      ]) +
      h3('Settlement layer') +
      bullets([
        'Base mainnet (chain ID 8453), an Ethereum L2 with Ethereum-grade security and sub-cent fees.',
        'Native USDC (0x8335…2913) as the unit of account. No proprietary token, no rebasing wrapper.',
        'A small suite of audited Solidity contracts — privacy pool, encrypted token, x402 facilitator, deposit router, agent identity, reputation, trust-gated transfer, SMS escrow.',
      ]) +
      h3('Privacy layer') +
      bullets([
        'USDPToken — an FHE-backed ERC-20 wrapper around USDC. Balances are stored as encrypted ciphertexts; operations execute homomorphically.',
        'X402PrivacyPool — a ZK shielded pool. Users deposit USDC and receive a private credit; transfers inside the pool emit only commitments and proofs.',
        'Three privacy levels per transaction: Public, Partial (amount hidden), and Full (amount + counterparties hidden).',
      ]) +
      h3('Channels') +
      bullets([
        'Direct wallet-to-wallet transfers, by address or by @username.',
        'x402 — HTTP 402 payment requests for browsers, agents, and API monetisation.',
        'SMS — claim links to any E.164 phone number, with offline signing.',
        'Farcaster — cast-triggered payments and a dedicated Mini App at baseusdp.com/miniapp.',
        'Twitter / X — DM and tweet-triggered payments via the @baseusdp bot.',
        'AI Terminal — natural-language commands in the dashboard, dispatching to the same APIs.',
      ]) +
      callout(
        'What the user actually sees',
        'A dashboard at baseusdp.com with an encrypted balance and the tabs Overview, Deposit, Send, Payments (x402), Withdraw, Swap, History, Messages (XMTP), AI Terminal, Agents, and Settings. A Farcaster Mini App at /miniapp mirrors the core flows inside Warpcast and other Frames-compatible clients.'
      ),
  }),

  section({
    number: 3,
    kicker: 'Privacy',
    title: 'Two cryptographic primitives, one product.',
    lead:
      'FHE and ZK proofs are deployed together — each compensates for the other’s limitations.',
    body:
      stats([
        { label: 'KEY SIZE', value: '256-bit' },
        { label: 'POOL FEE', value: '1.0%' },
        { label: 'SETTLEMENT', value: '< 2s' },
        { label: 'PRIVACY LEVELS', value: '3' },
      ]) +
      h3('Fully Homomorphic Encryption') +
      para(
        'USDPToken is an ERC-20-shaped contract whose balances are stored as encrypted ciphertexts rather than plaintext integers. Addition, subtraction, and comparison operate on the ciphertexts directly, so a transfer can be executed without any node on the network — including validators — ever learning the amount. Owners decrypt their own balance using a sealed-output query.'
      ) +
      para(
        'FHE gives BASEUSDP confidential balances and confidential transfers without requiring the user to generate a proof for every interaction. It is the right primitive for the common case: holding USDC privately and moving it between two parties already inside the encrypted set.'
      ) +
      h3('Zero-Knowledge Proofs') +
      para(
        'The privacy pool is the bridge between the public USDC supply and the encrypted set. A user deposits USDC into the pool and receives a commitment. To transfer, the user generates a ZK proof that they own a commitment of sufficient value and that the new commitments correctly reflect the transfer. The proof is verified on-chain; the amount and recipient never leak.'
      ) +
      para(
        'Each proof is stored as a tuple of proofBytes, commitmentBytes, and blindingFactorBytes on the privacy pool contract. Relayers can dispatch internal transfers (within the pool) or external transfers (out of the pool to a public address) only with a valid proof — they cannot redirect funds because the recipient address is committed in the proof.'
      ) +
      h3('Privacy levels') +
      table(
        ['Level', 'Amount', 'Counterparties', 'When to use'],
        [
          ['Public', 'Visible', 'Visible', 'Default ERC-20 transfer. No privacy. Cheapest gas.'],
          ['Partial', 'Hidden', 'Visible', 'B2B settlement where relationships are known but amounts are sensitive.'],
          ['Full', 'Hidden', 'Hidden', 'Retail and agent payments where the entire transaction should be unlinkable.'],
        ]
      ),
  }),

  section({
    number: 4,
    kicker: 'Contracts',
    title: 'The smart contract suite.',
    lead:
      'All on-chain logic lives in a small set of contracts on Base. Each has a single responsibility and a documented trust boundary. Source is verified on Basescan.',
    body:
      table(
        ['Contract', 'Purpose'],
        [
          ['USDPToken', 'FHE-encrypted ERC-20 wrapper around USDC. Encrypted balances, confidential transfers, per-account privacy level. Owners read balance via sealed output.'],
          ['X402PrivacyPool', 'Zero-knowledge shielded pool. Accepts USDC deposits, holds commitments, verifies ZK proofs, executes internal and external transfers. 1% withdrawal fee, 0.5% maintenance.'],
          ['X402Facilitator', 'On-chain x402 settlement contract. Verifies encrypted payments against a server-issued payment request and settles them atomically.'],
          ['DepositRouter', 'Routes a single user transaction into a token transferFrom of USDC/USDT and an ETH gas funding to the relayer, removing the need for two-step UX.'],
          ['AgentIdentityRegistry', 'ERC-8004 soulbound agent passport (non-transferable ERC-721). On-chain identity for autonomous agents; owner-controlled revoke.'],
          ['AgentReputationRegistry', 'ERC-8004 reputation ledger. Trust score 0–100, signal ratio, and an activity-weighted history of agent transactions.'],
          ['TrustGatedTransfer', 'Optional modifier that gates outgoing transfers behind a minimum agent reputation, for counterparties that want to receive only from verified agents.'],
          ['SMSEscrow', 'Escrow holding USDC against an SMS claim token. Auto-refunds the sender after 24 h. Permissionless refund — anyone can trigger after expiry.'],
        ]
      ) +
      callout(
        'Upgradeability posture',
        'V1 contracts are non-upgradeable. Fixes ship as new deployments with a published migration path; users keep custody throughout. This trades developer ergonomics for an honest custody story — there is no admin key that can rewrite the rules of the pool, the encrypted token, or the escrow.'
      ),
  }),

  section({
    number: 5,
    kicker: 'Channels',
    title: 'Five ways to address a recipient.',
    lead:
      'BASEUSDP exposes five payment channels. They share one settlement layer and one set of privacy primitives, so a payment originated through SMS can be received by an x402 endpoint without ever being decrypted in the middle.',
    body:
      table(
        ['Channel', 'Recipient', 'Online?', 'Typical sender'],
        [
          ['Direct', 'Wallet address or @username', 'Yes', 'Human · dashboard or Mini App'],
          ['x402', 'HTTP endpoint with 402 response', 'Yes', 'Browser wallet or AI agent'],
          ['SMS', 'E.164 phone number', 'Sender may be offline', 'Human'],
          ['Farcaster', 'FID or @handle', 'Yes', 'Cast or DM via @baseusdp'],
          ['Twitter', '@handle', 'Yes', 'Tweet or DM via @baseusdp'],
        ]
      ) +
      h3('Routing rules') +
      bullets([
        'All channels deposit into or withdraw from X402PrivacyPool. There is one balance, one settlement layer.',
        'The choice of channel determines how the recipient is addressed and how the notification is delivered — never which token is moved.',
        'A payment can be initiated through one channel and claimed through another. SMS-claimed funds land in the recipient’s connected wallet; that wallet can then send out via x402.',
      ]),
  }),

  section({
    number: 6,
    kicker: 'x402',
    title: 'HTTP-native payments.',
    lead:
      'x402 revives the HTTP 402 Payment Required status code as a machine-readable payment negotiation. A server responds 402 with terms; the client signs a USDC payment on Base and retries with proof of payment in the X-PAYMENT header. The round-trip takes about two seconds.',
    body:
      h3('Where BASEUSDP fits') +
      bullets([
        'X402Facilitator is the on-chain settlement contract. It verifies the encrypted payment proof and signals the server to release the resource.',
        'The dashboard exposes /payments where users can create x402 requests (amount, description, expiry) and share the resulting link.',
        'A standalone /x402-deposit page handles first-time wallet funding for Phantom EVM and MetaMask: connect, switch to Base, approve, confirm.',
        'All x402 settlements route through the same privacy pool used by direct transfers — amounts are hidden by default.',
      ]) +
      h3('Why this matters for agents') +
      para(
        'An AI agent does not have a card, a bank account, or a payments-processor relationship. It does have an EVM wallet, an HTTP client, and a budget. x402 is the smallest possible protocol that lets that agent buy a one-off API call, a data point, or a compute slot from a service it has never met before. BASEUSDP adds privacy so the agent’s spending pattern is not a public broadcast to its competitors.'
      ) +
      callout(
        'Cross-channel composition',
        'An AI agent receives a 402 response from an API. It pays via x402. The recipient is a human consultant whose registered address is a Farcaster handle. The funds settle privately on Base, a cast notification is posted by @baseusdp, and the consultant withdraws from the Mini App. No phone number, no email, no API keys, no plaintext amount on-chain.'
      ),
  }),

  section({
    number: 7,
    kicker: 'SMS',
    title: 'Pay any phone number, even offline.',
    lead:
      'BASEUSDP can route a private USDC payment to any E.164 phone number — even when the sender has no internet at the moment of signing. The recipient does not need a wallet at the time of sending.',
    body:
      cards([
        { number: 1, title: 'Client', body: 'Signs commitment. Queues offline.' },
        { number: 2, title: 'Relay', body: 'Verifies sig. Never holds funds.' },
        { number: 3, title: 'SMS', body: 'Twilio / Vonage. A2P 10DLC.' },
        { number: 4, title: 'Escrow', body: 'SMSEscrow.sol. On-chain truth.' },
        { number: 5, title: 'Claim', body: 'Recipient connects wallet. ZK transfer.' },
      ]) +
      h3('Privacy properties') +
      bullets([
        'Raw phone numbers are keccak256-hashed client-side and never written to any BASEUSDP database, log, or contract.',
        'Amounts are hidden via the same ZK privacy pool used by direct transfers.',
        'The relay server cannot move, freeze, or confiscate funds — only the escrow contract can.',
        'If the relay infrastructure disappears, refund() is callable by anyone after expiry — funds are never trapped.',
      ]) +
      callout(
        'See the companion whitepaper',
        'BASEUSDP SMS & Offline Payment Layer — Technical Whitepaper (v1.0, May 2026). Covers commitment construction, the SMSEscrow.sol contract interface, security analysis, A2P 10DLC and GDPR compliance, and the V1–V4 progressive decentralization roadmap.'
      ),
  }),

  section({
    number: 8,
    kicker: 'Agents',
    title: 'Autonomous agents, on-chain identity.',
    lead:
      'A privacy-preserving payment system that only humans can use is half-built. BASEUSDP treats AI agents as first-class users with their own wallets, their own ERC-8004 identity, and their own enforced budgets.',
    body:
      h3('Agent passport (ERC-8004)') +
      para(
        'Every registered agent receives a soulbound ERC-721 token from AgentIdentityRegistry. This is the on-chain passport: it carries the agent’s identity, the owner’s address, and a revoke bit. The token is non-transferable — an agent cannot be sold or laundered mid-engagement — and the owner can revoke at any time, severing the agent from its history.'
      ) +
      h3('Reputation (ERC-8004)') +
      para(
        'AgentReputationRegistry maintains an activity-weighted trust score from 0–100, a signal ratio (successful settlements over total attempts), and a chronological log of the agent’s on-chain transactions. Counterparties can read this score before accepting a payment or shipping a service.'
      ) +
      h3('Spending policies') +
      table(
        ['Policy', 'Enforced where', 'Example'],
        [
          ['Max per transaction', 'Backend + on-chain modifier', '$1,000 USDC'],
          ['Daily limit', 'Backend (24-hour rolling window)', '$5,000 USDC'],
          ['Minimum counterparty reputation', 'TrustGatedTransfer modifier', '≥ 60'],
          ['Allowed channel set', 'Backend', 'x402 only, no SMS'],
        ]
      ) +
      h3('AgentKit integration') +
      bullets([
        'Each agent can be provisioned with a Coinbase AgentKit wallet via /api/agents endpoints.',
        'The wallet signs payments programmatically; spending caps are checked server-side before relay submission.',
        'A per-agent API key gates access; regeneration invalidates the previous key without affecting on-chain state.',
      ]),
  }),

  section({
    number: 9,
    kicker: 'Terminal',
    title: 'Natural-language commands.',
    lead:
      'The AI Terminal is a chat surface inside the dashboard. It is the bridge between informal user intent and the same underlying API calls that the buttoned UI invokes.',
    body:
      h3('How it works') +
      steps([
        'User input is sent to /api/ai-chat, which calls the Anthropic Claude API with a system prompt describing the available tools (deposit, send, withdraw, history, x402).',
        'Claude returns either a plain answer (informational query) or a structured tool call (action).',
        'Action tool calls open the corresponding pre-filled modal in the dashboard — the user reviews and confirms before signing.',
        'Nothing is signed on the user’s behalf without a final wallet confirmation. The Terminal is a UX accelerator, not a custodial agent.',
      ]) +
      h3('Example session') +
      codeBlock(
        '> what is my balance?\n' +
          '   $4,820.50 USDC  (encrypted)\n\n' +
          '> send 25 to @nora for coffee\n' +
          '   Drafted: 25.00 USDC → @nora · Privacy: Full\n' +
          '   Confirm in wallet ▸\n\n' +
          '> show payments from this week\n' +
          '   12 transactions · net outflow $312.40'
      ) +
      callout(
        'Separation of concerns',
        'The Terminal interprets intent. The dashboard executes. The wallet authorises. The contract settles. No single one of these can act without the others — a compromised AI Terminal cannot move funds because the wallet still has to sign.'
      ),
  }),

  section({
    number: 10,
    kicker: 'Social',
    title: 'Farcaster Mini-App and bot.',
    lead:
      'Farcaster is the social surface where BASEUSDP is most native. The protocol is open, the identifiers (FIDs) are portable, and the audience is already on-chain.',
    body:
      h3('Mini App — baseusdp.com/miniapp') +
      bullets([
        'A standalone React route configured as a Farcaster Mini App via fc:miniapp meta tags.',
        'Mirrors the dashboard core flows — home, send, deposit, history, payment detail, settings — inside a Frames-compatible client.',
        'Native Farcaster auth via FID. No separate sign-in flow.',
        'Renders cast embeds for shared payment links so a tap inside Warpcast opens the Mini App directly into the relevant flow.',
      ]) +
      h3('The @baseusdp bot') +
      bullets([
        'Driven by Neynar webhooks. Cast mentions like "@baseusdp pay @nora $10" are parsed, validated against the sender’s connected wallet, and settled privately via the pool.',
        'Replies are privacy-safe: no amounts, no wallet addresses, no transaction hashes leak in the public reply.',
        'A scheduled Vercel cron runs every four hours to post daily stats, feature notes, and tips — with dedup logic to avoid double-posts.',
        'The bot’s signer UUID and webhook secret are scoped to the @baseusdp FID; rotation does not affect on-chain balances.',
      ]) +
      h3('Twitter / X parity') +
      para(
        'A symmetric integration exists for Twitter via OAuth 2.0 sign-in and a tweet-payment cron. Recipients are identified by @handle; settlement is identical to Farcaster — same pool, same privacy.'
      ),
  }),

  section({
    number: 11,
    kicker: 'Messaging',
    title: 'Encrypted messaging via XMTP.',
    lead:
      'Payments are rarely standalone — they come with notes, invoices, dispute threads, shipping addresses. BASEUSDP integrates XMTP so users can hold those conversations end-to-end encrypted, addressed by the same wallet that holds the money.',
    body:
      bullets([
        'The Messages tab in the dashboard surfaces XMTP conversations scoped to the connected wallet.',
        'Messages are end-to-end encrypted and stored on the XMTP network, not on BASEUSDP infrastructure.',
        'A payment can be sent in-thread; the corresponding x402 link is attached as a message reference.',
        'Read receipts, unread counts, and message history are local to the user’s wallet — BASEUSDP never sees plaintext.',
      ]) +
      callout(
        'Why XMTP, not a custom protocol',
        'XMTP is open, wallet-native, and already widely deployed. Building a custom messaging layer would have required us to operate plaintext infrastructure ourselves — exactly the trust boundary we are trying to avoid everywhere else in the system.'
      ),
  }),

  section({
    number: 12,
    kicker: 'Security',
    title: 'Trust assumptions, in full.',
    lead:
      'A privacy product is only as honest as its threat model. Below is a complete map of what users trust at each layer of BASEUSDP.',
    body:
      table(
        ['Component', 'Risk', 'What you trust', 'Mitigation'],
        [
          ['Wallet (MetaMask, Coinbase, Phantom)', 'HIGH', 'Your own key custody.', 'Standard wallet hygiene. Hardware wallet recommended for large balances.'],
          ['USDPToken + X402PrivacyPool', 'HIGH', 'The contracts behave as specified.', 'Independent audit before mainnet. Non-upgradeable in V1. Source verified on Basescan.'],
          ['Base L2', 'MEDIUM', 'Base remains live and DA-anchored to Ethereum.', 'Ethereum-grade security. Withdrawals are valid against L1 state even if sequencer pauses.'],
          ['BASEUSDP relayer wallet', 'MEDIUM', 'Honest sequencing of relayed proofs.', 'Relayer cannot redirect funds — recipient is committed in the proof. Worst case: censorship.'],
          ['SMS relay server', 'LOW–MED', 'SMS delivery. Cannot touch funds.', 'Permissionless refund() after 24 h. Detailed in the SMS whitepaper.'],
          ['XMTP network', 'LOW', 'Message delivery.', 'End-to-end encrypted; XMTP nodes see ciphertext only.'],
          ['Neynar / Twilio / Twitter API', 'LOW', 'Notification delivery and own retention.', 'Used for last-mile messaging only. No custody, no plaintext financial state.'],
        ]
      ) +
      callout(
        'What an attacker still cannot do',
        'Mint USDC. Decrypt FHE ciphertexts without the owner’s viewing key. Redirect a relayed transfer to themselves. Forge a ZK proof. Override the SMS escrow’s 24-hour refund. Recover a raw phone number from a stored hash. The settlement layer is the trust anchor; every other component is a delivery mechanism around it.'
      ),
  }),

  section({
    number: 13,
    kicker: 'Compliance',
    title: 'Regulatory and compliance layer.',
    lead:
      'BASEUSDP is non-custodial in the legal sense: users can withdraw at any time without permission. All settlement is in native USDC issued by Circle on Base — we do not mint a token.',
    body:
      h3('SMS compliance') +
      bullets([
        'A2P 10DLC: Brand and campaign registered with The Campaign Registry. Financial-services classification, transactional frequency.',
        'TCPA: STOP keyword handling, one-message-per-event policy, opt-out persistence.',
        'International: Vonage routes per-country with regional sender registration where required.',
      ]) +
      h3('GDPR') +
      bullets([
        'Data minimisation throughout. The phone registry stores only keccak256 hashes and wallet addresses — no names, no message history, no amounts.',
        'Right to erasure (Article 17) is honoured at the registry level. Active escrow positions are unaffected; their refund path is permissionless.',
        'Hashing without salt is treated as pseudonymisation under Article 4(5); per-user salts are scheduled for V2 to strengthen the pseudonymisation guarantee.',
      ]) +
      h3('FATF Travel Rule') +
      para(
        'Because amounts and counterparties are encrypted by default, on-chain transfers do not carry Travel Rule fields publicly. For institutional users, we plan a selective disclosure mechanism using viewing keys and ZK-provable compliance proofs that satisfy originator/beneficiary requirements without leaking the underlying data to the public.'
      ),
  }),

  section({
    number: 14,
    kicker: 'Roadmap',
    title: 'What we ship next.',
    lead:
      'BASEUSDP ships in phases. Each phase is independently useful — none requires the next to be deployed in order to be valuable.',
    body: table(
      ['Phase', 'Status', 'What ships'],
      [
        ['V1 — May 2026', 'Live', 'Privacy pool, FHE token, x402 facilitator, dashboard, SMS layer, Farcaster Mini App + bot, Twitter bot, AI Terminal, agent passport and reputation, XMTP messaging, mainnet on Base.'],
        ['V1.1 — Q3 2026', 'In flight', 'Per-user phone hash salts. Multi-recipient batched SMS. Agent spending caps enforced on-chain via TrustGatedTransfer extensions. Viewing keys for institutional reporting.'],
        ['V2 — Q4 2026', 'Planned', 'On-chain PhoneRegistry.sol replacing the off-chain phone↔wallet table. ZK proof of phone ownership at registration. Removes relay control over the registry.'],
        ['V3 — 2027', 'Planned', 'Open SMS relay network. Anyone can run a relay; payment is conditional on a ZK-verified Twilio delivery receipt posted on-chain. Removes single-relay monopoly.'],
        ['V4 — 2027+', 'Research', 'Decentralised phone oracle. Phone ownership proven without revealing the number to any relay. Composes with the agent passport for end-to-end identity portability.'],
      ]
    ),
  }),

  section({
    number: 15,
    kicker: 'Conclusion',
    title: 'Closing the loop.',
    lead:
      'BASEUSDP is a bet that privacy can be the default behaviour of a stablecoin without sacrificing the surfaces that make payments useful.',
    body:
      para(
        'Native USDC on Base, wrapped by FHE and a ZK pool, addressed by wallets, phone numbers, Farcaster handles, Twitter accounts, HTTP endpoints, and natural-language commands — all settling against the same contracts, all with the same privacy guarantees, all with the same auditable trust assumptions.'
      ) +
      para(
        'The hard problems are not where the system is decentralised. They are at the seams — the SMS gateway, the social platform APIs, the off-chain registries — and we have documented each one honestly. Every seam has a refund path, an expiry, or a permissionless escape hatch. No component on the critical path of fund recovery is controlled by BASEUSDP alone.'
      ) +
      para(
        'What we ship next reduces these seams. An on-chain phone registry. An open relay network. Selective-disclosure compliance proofs that satisfy regulators without leaking to the public. Until then, the worst-case behaviour of every centralized component is bounded: it can delay, it can refuse, but it cannot move user funds.'
      ) +
      h3('Further reading') +
      bullets([
        'BASEUSDP SMS & Offline Payment Layer — Technical Whitepaper (v1.0, May 2026)',
        'x402 Protocol Whitepaper — x402.org/x402-whitepaper.pdf',
        'Coinbase x402 Developer Documentation — docs.cdp.coinbase.com/x402',
        'ERC-8004: Soulbound Agent Identity and Reputation',
        'XMTP Protocol Documentation — xmtp.org/docs',
        'Circle USDC on Base — circle.com/usdc',
        'Privacy Policy and Terms — baseusdp.com/privacy-policy, baseusdp.com/terms-and-conditions',
      ]),
  }),
];

// ---------- Table of Contents ----------

const TOC_HTML = `
<section class="page toc">
  <div class="kicker">CONTENTS</div>
  <h1 class="display">Inside this paper</h1>
  <div class="underline"></div>
  ${tocRow('01', 'Background and Motivation', 'Why a privacy layer for USDC')}
  ${tocRow('02', 'System Overview', 'Three layers and how they fit')}
  ${tocRow('03', 'Privacy Primitives', 'FHE, ZK proofs, privacy levels')}
  ${tocRow('04', 'The Smart Contract Suite', 'Eight contracts, one responsibility each')}
  ${tocRow('05', 'Payment Channels', 'Five ways to address a recipient')}
  ${tocRow('06', 'x402 — HTTP-Native Payments', 'HTTP 402 for browsers and agents')}
  ${tocRow('07', 'SMS & Offline Payment Layer', 'Pay any phone number, even offline')}
  ${tocRow('08', 'Autonomous Agents & ERC-8004', 'Soulbound identity, reputation, limits')}
  ${tocRow('09', 'AI Terminal', 'Natural-language commands in the dashboard')}
  ${tocRow('10', 'Farcaster Mini-App and Bot', 'Native Frames and @baseusdp')}
  ${tocRow('11', 'Encrypted Messaging', 'XMTP scoped to the wallet')}
  ${tocRow('12', 'Security Model and Trust', 'What every component can and cannot do')}
  ${tocRow('13', 'Regulatory and Compliance', 'A2P 10DLC, GDPR, Travel Rule')}
  ${tocRow('14', 'Roadmap', 'V1.1 through V4')}
  ${tocRow('15', 'Conclusion', 'And further reading')}
</section>`;

// ---------- Cover page ----------

const COVER_HTML = `
<section class="cover">
  <div class="cover-top">
    <div class="cover-brand">
      <div class="cover-brand-name">BASEUSDP</div>
      <div class="cover-brand-url">baseusdp.com</div>
    </div>
    <div class="cover-tag">CONFIDENTIAL</div>
  </div>
  <div class="cover-body">
    <div class="cover-kicker">PROJECT WHITEPAPER · v2.0</div>
    <h1 class="cover-title">Confidential USDC<br/>for the AI Economy.</h1>
    <p class="cover-sub">
      How BASEUSDP turns Base into a private settlement layer<br/>
      for humans, AI agents, and the open web.
    </p>
  </div>
  <div class="cover-meta">
    <div class="meta-item"><div class="meta-label">VERSION</div><div class="meta-value">2.0</div></div>
    <div class="meta-item"><div class="meta-label">RELEASED</div><div class="meta-value">May 2026</div></div>
    <div class="meta-item"><div class="meta-label">NETWORK</div><div class="meta-value">Base · L2</div></div>
    <div class="meta-item"><div class="meta-label">TOKEN</div><div class="meta-value">USDC</div></div>
  </div>
  <div class="cover-abstract">
    <div class="abstract-label">ABSTRACT</div>
    <p>
      BASEUSDP is a privacy-first payments platform built on Base,
      Coinbase's Ethereum L2. It combines an FHE-encrypted USDC token, a
      zero-knowledge privacy pool, an x402 facilitator, an ERC-8004 agent
      identity layer, and a bounded SMS relay into one product that lets
      humans and autonomous agents move USDC privately to any wallet,
      phone number, Farcaster handle, or HTTP endpoint. This document
      describes the system in full — what is on-chain, what is off-chain,
      which components are trusted, and the roadmap that progressively
      removes the remaining trust assumptions.
    </p>
  </div>
  <div class="cover-footer">
    <span>BASEUSDP · Confidential · May 2026</span>
    <span class="cover-footer-url">baseusdp.com</span>
  </div>
</section>`;

// ---------- Full HTML ----------

const CSS = `
:root {
  --black: #0a0a0a;
  --ink: #111827;
  --text: #1f2937;
  --body: #374151;
  --muted: #6b7280;
  --faint: #9ca3af;
  --rule: #e5e7eb;
  --rule-soft: #f1f5f9;
  --zebra: #fafbfc;
  --white: #ffffff;
  --green: #00d27a;
  --green-dark: #00a861;
  --green-soft: #ecfdf5;
  --green-ink: #065f46;
  --card-dark: #0f1115;
}

* { box-sizing: border-box; }

@page {
  size: A4;
  margin: 18mm 16mm 18mm 16mm;
}

@page :first {
  margin: 0;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
  font-size: 10.5pt;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'kern' 1, 'liga' 1, 'tnum' 1;
}

/* ---------- Cover ---------- */

.cover {
  width: 210mm;
  height: 297mm;
  background: var(--white);
  position: relative;
  page-break-after: always;
  break-after: page;
  display: flex;
  flex-direction: column;
}

.cover::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 6px;
  background: var(--green);
}

.cover-top {
  background: var(--black);
  color: var(--white);
  height: 84mm;
  padding: 18mm 16mm 0 22mm;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
}

.cover-top::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 6px;
  background: var(--green);
}

.cover-brand-name {
  font-weight: 700;
  font-size: 11pt;
  letter-spacing: 0.14em;
}
.cover-brand-url {
  margin-top: 4px;
  color: var(--faint);
  font-size: 9pt;
}

.cover-tag {
  font-size: 8.5pt;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--green);
  background: #1f2937;
  padding: 5px 12px;
  border-radius: 999px;
}

.cover-body {
  padding: 18mm 22mm 0 22mm;
}

.cover-kicker {
  color: var(--green-dark);
  font-weight: 700;
  font-size: 10pt;
  letter-spacing: 0.18em;
  margin-bottom: 14px;
}

.cover-title {
  font-size: 44pt;
  line-height: 1.04;
  letter-spacing: -0.02em;
  font-weight: 800;
  color: var(--black);
  margin: 0;
}

.cover-sub {
  margin-top: 18px;
  font-size: 13pt;
  line-height: 1.5;
  color: var(--muted);
  max-width: 130mm;
}

.cover-meta {
  margin: auto 22mm 0 22mm;
  padding-top: 16px;
  padding-bottom: 16px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.cover-meta .meta-item {
  padding: 0 8px;
  border-right: 1px solid var(--rule);
}
.cover-meta .meta-item:last-child { border-right: none; }

.meta-label {
  font-size: 8pt;
  letter-spacing: 0.16em;
  font-weight: 700;
  color: var(--muted);
}
.meta-value {
  margin-top: 6px;
  font-size: 14pt;
  font-weight: 700;
  color: var(--black);
  letter-spacing: -0.01em;
}

.cover-abstract {
  padding: 12mm 22mm 0 22mm;
}
.abstract-label {
  color: var(--green-dark);
  font-weight: 700;
  font-size: 10pt;
  letter-spacing: 0.18em;
  margin-bottom: 10px;
}
.cover-abstract p {
  margin: 0;
  font-size: 11pt;
  line-height: 1.62;
  color: var(--text);
  text-align: justify;
}

.cover-footer {
  margin-top: auto;
  background: var(--black);
  color: var(--faint);
  font-size: 8.5pt;
  padding: 10px 22mm;
  display: flex;
  justify-content: space-between;
}
.cover-footer-url {
  color: var(--green);
  font-weight: 700;
}

/* ---------- Page chrome (after cover) ---------- */

body { counter-reset: page; }

.section, .toc {
  position: relative;
  page-break-before: always;
  break-before: page;
  padding: 0 0 0 8mm;
}

.section::before, .toc::before {
  content: '';
  position: fixed;
  left: 0; top: 0; bottom: 0;
  width: 6px;
  background: var(--green);
}

/* ---------- TOC ---------- */

.toc .kicker {
  font-size: 10pt;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.18em;
  margin-bottom: 10px;
}
.toc .display {
  font-size: 34pt;
  letter-spacing: -0.02em;
  font-weight: 800;
  color: var(--black);
  margin: 0;
  line-height: 1.05;
}
.toc .underline {
  width: 92px;
  height: 4px;
  background: var(--green);
  margin: 14px 0 28px;
  border-radius: 2px;
}

.toc-row {
  display: flex;
  align-items: baseline;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule-soft);
}
.toc-num {
  width: 38px;
  color: var(--green-dark);
  font-weight: 700;
  font-size: 12pt;
  letter-spacing: 0.06em;
}
.toc-title {
  font-weight: 700;
  font-size: 12.5pt;
  color: var(--black);
  letter-spacing: -0.01em;
}
.toc-kicker {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9.5pt;
}

/* ---------- Section headings ---------- */

.section-kicker {
  font-size: 9.5pt;
  letter-spacing: 0.2em;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 12px;
}

.section-title {
  font-size: 30pt;
  font-weight: 800;
  letter-spacing: -0.022em;
  line-height: 1.08;
  color: var(--black);
  margin: 0;
}

.section-underline {
  width: 96px;
  height: 4px;
  background: var(--green);
  border-radius: 2px;
  margin: 18px 0 22px;
}

.lead {
  font-size: 13pt;
  line-height: 1.55;
  color: var(--body);
  margin: 0 0 22px;
  letter-spacing: -0.005em;
}

/* ---------- Body type ---------- */

p {
  margin: 0 0 12px;
  text-align: justify;
  hyphens: auto;
  font-feature-settings: 'kern' 1, 'liga' 1;
}

.h3 {
  font-size: 13pt;
  font-weight: 700;
  color: var(--black);
  margin: 22px 0 10px;
  letter-spacing: -0.01em;
  position: relative;
  padding-left: 0;
}
.h3::after {
  content: '';
  display: block;
  width: 28px;
  height: 2px;
  background: var(--green);
  margin-top: 6px;
}

/* ---------- Bullets ---------- */

.bullets {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
}
.bullets li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 7px;
  line-height: 1.55;
  break-inside: avoid;
}
.bullets li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--green);
  font-weight: 700;
}

/* ---------- Numbered step list ---------- */

.steps {
  list-style: none;
  counter-reset: step;
  margin: 0 0 14px;
  padding: 0;
}
.steps li {
  counter-increment: step;
  position: relative;
  padding: 4px 0 4px 36px;
  margin-bottom: 10px;
  line-height: 1.55;
  break-inside: avoid;
}
.steps li::before {
  content: counter(step);
  position: absolute;
  left: 0; top: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--green);
  color: var(--white);
  font-weight: 700;
  font-size: 10pt;
  text-align: center;
  line-height: 22px;
}

/* ---------- Tables ---------- */

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 18px;
  font-size: 9.5pt;
  break-inside: auto;
}
.data-table thead th {
  background: var(--black);
  color: var(--white);
  text-align: left;
  font-weight: 700;
  font-size: 9.5pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 11px 12px;
}
.data-table tbody td {
  padding: 12px;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
  line-height: 1.5;
  color: var(--text);
}
.data-table tbody tr:nth-child(even) td {
  background: var(--zebra);
}
.data-table tbody td.first-col {
  color: var(--black);
  font-weight: 700;
}
.data-table tbody tr {
  break-inside: avoid;
}

/* ---------- Callouts ---------- */

.callout {
  background: var(--green-soft);
  border-left: 4px solid var(--green);
  padding: 14px 18px;
  margin: 12px 0 18px;
  break-inside: avoid;
}
.callout-title {
  font-weight: 700;
  color: var(--green-ink);
  font-size: 10.5pt;
  margin-bottom: 6px;
}
.callout-body {
  color: var(--text);
  font-size: 10pt;
  line-height: 1.6;
}

/* ---------- Pull quote ---------- */

.pull-quote {
  border-left: 3px solid var(--green);
  margin: 18px 0;
  padding: 8px 18px;
  break-inside: avoid;
}
.pull-quote p {
  font-style: italic;
  font-size: 13.5pt;
  color: var(--ink);
  line-height: 1.5;
  margin: 0;
  letter-spacing: -0.005em;
}
.pull-quote cite {
  display: block;
  margin-top: 8px;
  font-style: normal;
  color: var(--muted);
  font-weight: 700;
  font-size: 9pt;
  letter-spacing: 0.05em;
}

/* ---------- Code blocks ---------- */

.code {
  background: var(--card-dark);
  color: #d4d4d8;
  font-family: 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  font-size: 9pt;
  line-height: 1.55;
  padding: 14px 16px;
  border-radius: 4px;
  white-space: pre;
  overflow: hidden;
  margin: 6px 0 18px;
  break-inside: avoid;
}

/* ---------- Cards ---------- */

.cards {
  display: grid;
  gap: 10px;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  margin: 8px 0 22px;
  break-inside: avoid;
}
.card {
  padding: 16px 12px;
  text-align: center;
  border-radius: 4px;
  break-inside: avoid;
}
.card-dark {
  background: var(--card-dark);
  color: var(--white);
}
.card-light {
  background: #f6f7f9;
  color: var(--ink);
}
.card-num {
  font-size: 24pt;
  font-weight: 800;
  color: var(--green);
  line-height: 1;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}
.card-title {
  font-weight: 700;
  font-size: 10.5pt;
  margin-bottom: 6px;
}
.card-dark .card-body { color: #a1a1aa; }
.card-light .card-body { color: var(--muted); }
.card-body {
  font-size: 8.5pt;
  line-height: 1.5;
}

/* ---------- Stat strip ---------- */

.stat-strip {
  background: var(--card-dark);
  color: var(--white);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 8px 0 22px;
  border-radius: 4px;
  overflow: hidden;
  break-inside: avoid;
}
.stat {
  padding: 14px 16px;
  border-right: 1px solid #2a2d33;
}
.stat:last-child { border-right: none; }
.stat-label {
  color: var(--faint);
  font-size: 7.5pt;
  letter-spacing: 0.16em;
  font-weight: 700;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 18pt;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--white);
}

@media print {
  .section { padding-top: 0; }
  h1, h2, h3, .callout, .card, .pull-quote, .stat-strip { break-inside: avoid; }
}
`;

const HEADER_HTML = `
<div style="
  font-family:'Inter','Segoe UI',sans-serif;
  font-size:8.5pt;color:#6b7280;
  width:100%;padding:0 16mm;display:flex;
  justify-content:space-between;border-bottom:0.5pt solid #e5e7eb;
  margin-bottom:6px;">
  <span style="font-weight:700;">BASEUSDP</span>
  <span>Project Whitepaper — May 2026</span>
</div>`;

const FOOTER_HTML = `
<div style="
  font-family:'Inter','Segoe UI',sans-serif;
  font-size:8.5pt;color:#6b7280;
  width:100%;padding:0 16mm;display:flex;
  justify-content:space-between;border-top:0.5pt solid #e5e7eb;
  padding-top:6px;">
  <span>Confidential · May 2026</span>
  <span style="font-weight:700;">Page <span class="pageNumber"></span></span>
</div>`;

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>BASEUSDP — Project Whitepaper</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${COVER_HTML}
${TOC_HTML}
${SECTIONS.join('\n')}
</body>
</html>`;

fs.writeFileSync(HTML_PATH, HTML, 'utf8');
console.log('HTML written:', HTML_PATH);

// ---------- Render with headless Chrome ----------

const fileUrl = 'file:///' + HTML_PATH.replace(/\\/g, '/');

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--print-to-pdf-no-header',
  '--no-margins',
  `--print-to-pdf=${OUT_PDF}`,
  '--virtual-time-budget=10000',
  fileUrl,
];

try {
  execFileSync(chrome, args, { stdio: 'inherit' });
  console.log('PDF generated:', OUT_PDF);
} catch (err) {
  console.error('Chrome print-to-pdf failed:', err.message);
  process.exit(1);
}

// Sync into public/ so the website serves the same file.
const PUBLIC_PDF = path.join(__dirname, '..', 'public', 'BASEUSDP-Whitepaper.pdf');
try {
  fs.copyFileSync(OUT_PDF, PUBLIC_PDF);
  console.log('Synced to:', PUBLIC_PDF);
} catch (err) {
  console.warn('Could not sync to public/:', err.message);
}
