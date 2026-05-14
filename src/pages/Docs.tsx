import { Link } from "react-router-dom";
import { useState } from "react";
import Footer from "@/components/Footer";
import AltisLogo from "@/components/AltisLogo";

type SectionId =
  | "overview"
  | "getting-started"
  | "deposits"
  | "sending"
  | "withdrawals"
  | "privacy-model"
  | "tokens"
  | "fees"
  | "security"
  | "faq"
  | "support";

interface DocsSection {
  id: SectionId;
  title: string;
}

const SECTIONS: DocsSection[] = [
  { id: "overview", title: "Overview" },
  { id: "getting-started", title: "Getting Started" },
  { id: "deposits", title: "Deposits" },
  { id: "sending", title: "Sending Payments" },
  { id: "withdrawals", title: "Withdrawals" },
  { id: "privacy-model", title: "Privacy Model" },
  { id: "tokens", title: "Supported Tokens and Networks" },
  { id: "fees", title: "Fees" },
  { id: "security", title: "Security" },
  { id: "faq", title: "FAQ" },
  { id: "support", title: "Support" },
];

const Docs = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  const handleNavClick = (id: SectionId) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = 100;
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset * -1;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <AltisLogo size={28} className="text-foreground" />
            <span className="text-xl font-bold text-foreground tracking-tight">
              BASEUSDP
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Documentation
            </p>
            <nav className="flex flex-col gap-1">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={handleNavClick(s.id)}
                  className={`text-sm px-3 py-2 rounded transition-colors ${
                    activeSection === s.id
                      ? "bg-foreground/5 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
              Documentation
            </h1>
            <p className="text-muted-foreground text-base mb-12 max-w-2xl">
              Everything you need to start using BaseUSDP. A private agentic
              wallet for stablecoin payments on Base.
            </p>

            <div className="space-y-16 text-muted-foreground leading-relaxed">
              <section id="overview">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Overview
                </h2>
                <p>
                  BaseUSDP is a stablecoin wallet built for private payments on
                  the Base network. Your balance is held inside an encrypted
                  pool, and every transaction routes in a way that breaks the
                  on chain link between sender and receiver. The experience
                  feels like a normal wallet. The on chain footprint does not
                  point back to you.
                </p>
                <p className="mt-4">
                  This documentation covers the full user flow, from connecting
                  a wallet to depositing, sending, and withdrawing funds. It
                  also explains the privacy model at a high level so you can
                  understand exactly what is hidden and what is not.
                </p>
              </section>

              <section id="getting-started">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Getting Started
                </h2>
                <p>
                  BaseUSDP works directly in your browser. No app install is
                  required. You connect with a self custody wallet that you
                  already own.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Supported wallets
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Phantom</li>
                  <li>MetaMask</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Connecting
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Open baseusdp.com and click Connect Wallet.</li>
                  <li>Select your wallet provider.</li>
                  <li>
                    Approve the connection. BaseUSDP only requests permission
                    to read your address and request signatures. It never
                    holds your private keys.
                  </li>
                  <li>
                    Once connected, the Dashboard opens with your encrypted
                    balance, recent activity, and the actions you can take.
                  </li>
                </ol>
              </section>

              <section id="deposits">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Deposits
                </h2>
                <p>
                  A deposit moves stablecoins from your public wallet into your
                  encrypted balance on BaseUSDP. Once funds are inside the
                  pool, they are no longer linked to the wallet that deposited
                  them.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  How to deposit
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Open the Dashboard and select Deposit.</li>
                  <li>Choose USDC or USDT.</li>
                  <li>Enter the amount you want to deposit.</li>
                  <li>
                    Sign the transfer in your wallet. Funds move into a fresh
                    holding wallet created for this deposit.
                  </li>
                  <li>
                    The deposit is automatically split into several smaller
                    amounts. Each piece is routed independently through
                    privacy infrastructure before settling into the pool.
                  </li>
                  <li>
                    Your encrypted balance updates once all pieces are
                    confirmed. From this point forward, the deposit cannot be
                    traced back to your origin wallet.
                  </li>
                </ol>
                <p className="mt-4">
                  The entire flow requires a single signature on your side.
                  Splitting, routing, and settlement happen automatically.
                </p>
              </section>

              <section id="sending">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Sending Payments
                </h2>
                <p>
                  You can pay any wallet on Base, or any other BaseUSDP user
                  by their username. Both modes preserve sender privacy. The
                  username mode also protects the recipient.
                </p>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Sending to an address
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Open Payments and stay on the Address tab.</li>
                  <li>Paste any valid Base wallet address.</li>
                  <li>Pick USDC or USDT and enter the amount.</li>
                  <li>Sign once to authorize the transfer.</li>
                  <li>
                    Funds exit the privacy pool through an intermediate wallet
                    and arrive at the destination as a normal token transfer.
                    The recipient does not need a BaseUSDP account.
                  </li>
                </ol>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Sending to a username
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Open Payments and switch to the Username tab.</li>
                  <li>
                    Type the recipient username. BaseUSDP resolves it
                    instantly. The recipient wallet address stays hidden from
                    you.
                  </li>
                  <li>Pick USDC or USDT and enter the amount.</li>
                  <li>Sign once to authorize the transfer.</li>
                  <li>
                    The amount lands in the recipient encrypted balance.
                    Neither party reveals a wallet address to the other.
                  </li>
                </ol>
                <p className="mt-4">
                  Usernames are case insensitive and can be edited from
                  Settings. A user must complete at least one deposit before
                  they can receive transfers.
                </p>
              </section>

              <section id="withdrawals">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Withdrawals
                </h2>
                <p>
                  A withdrawal moves stablecoins from your encrypted balance
                  back out to any wallet on Base. The destination can be your
                  own wallet, a friend, or an exchange address.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  How to withdraw
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Open Withdraw and pick USDC or USDT.</li>
                  <li>Enter the amount and the destination address.</li>
                  <li>Sign once to authorize the withdrawal.</li>
                  <li>
                    Your encrypted balance decreases instantly inside the
                    pool. Funds exit through an intermediate wallet and arrive
                    at the destination as a regular token transfer.
                  </li>
                </ol>
                <p className="mt-4">
                  To outside observers, the payout looks like a transfer from
                  an unrelated wallet. There is no on chain link between your
                  encrypted balance and the destination.
                </p>
              </section>

              <section id="privacy-model">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Privacy Model
                </h2>
                <p>
                  BaseUSDP combines three techniques to protect your activity.
                  Each one addresses a different leak that traditional wallets
                  expose.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Encrypted balances
                </h3>
                <p>
                  Your balance is stored inside a shared pool. Only you can
                  view, send, or withdraw your share. Outside observers see
                  the pool, not individual accounts.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Intermediate wallets
                </h3>
                <p>
                  Every transfer out of the pool flows through an unrelated
                  intermediate wallet. The recipient sees funds arrive from a
                  wallet that holds no relationship to you.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Deposit splitting
                </h3>
                <p>
                  Deposits are broken into multiple random pieces and routed
                  independently. This removes the size and timing fingerprint
                  that would otherwise tie a deposit to a later withdrawal.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  What is private
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>The link between your origin wallet and your encrypted balance.</li>
                  <li>The link between sender and recipient on payments and withdrawals.</li>
                  <li>The size and timing relationship between deposits and outflows.</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  What remains public
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>The fact that you connected a wallet to BaseUSDP.</li>
                  <li>Total volume in the pool (aggregate, not per user).</li>
                  <li>Each individual transfer event on Base, viewed in isolation.</li>
                </ul>
              </section>

              <section id="tokens">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Supported Tokens and Networks
                </h2>
                <p>
                  BaseUSDP currently supports USDC and USDT on the Base
                  network. Additional assets and networks are planned. The
                  roadmap on the homepage lists upcoming additions.
                </p>
                <p className="mt-4">
                  Always confirm that the destination address you are sending
                  to is a Base address. Sending tokens to an address on a
                  different network may result in permanent loss of funds.
                </p>
              </section>

              <section id="fees">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Fees
                </h2>
                <p>
                  BaseUSDP applies a small protocol fee on outgoing transfers
                  and withdrawals. Deposits are free of protocol fees.
                  Standard Base network gas applies to the signature you make
                  in your wallet.
                </p>
                <p className="mt-4">
                  Fee tiers may apply for users who hold the platform token.
                  The current fee schedule is shown in the confirmation step
                  of every transfer and withdrawal, before you sign.
                </p>
              </section>

              <section id="security">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Security
                </h2>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Self custody
                </h3>
                <p>
                  BaseUSDP never holds your private keys or seed phrase. Every
                  action requires a signature from your connected wallet. If
                  you disconnect, you retain full control of your assets.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Recover access
                </h3>
                <p>
                  Your encrypted balance is bound to the wallet you used to
                  deposit. If you lose access to that wallet, you also lose
                  access to the balance. Treat your seed phrase with the same
                  care you would for any other crypto wallet.
                </p>
                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Verify before signing
                </h3>
                <p>
                  Every signature request shows the action you are about to
                  authorize. Always review the amount and the destination
                  before approving in your wallet.
                </p>
              </section>

              <section id="faq">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Frequently Asked Questions
                </h2>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Do I need an account?
                </h3>
                <p>
                  No traditional account is required. You connect a wallet you
                  already own. A username can be added later if you want to
                  receive payments by name.
                </p>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Can my recipient be a non user?
                </h3>
                <p>
                  Yes. When you send to a Base address, the recipient does
                  not need a BaseUSDP account. They receive plain stablecoins
                  in their wallet.
                </p>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Why is my username send blocked?
                </h3>
                <p>
                  Recipients must complete at least one deposit before they
                  can receive transfers by username. Ask them to make any
                  deposit, then try again.
                </p>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  How long does a deposit take?
                </h3>
                <p>
                  Most deposits complete within a few minutes. Complex routing
                  paths or network congestion may extend this. Progress is
                  shown live in the deposit modal.
                </p>

                <h3 className="text-lg font-medium text-foreground/90 mb-3 mt-6">
                  Is BaseUSDP custodial?
                </h3>
                <p>
                  No. Funds inside the pool remain controlled by the same
                  wallet that deposited them. You can withdraw at any time
                  without permission from the platform.
                </p>
              </section>

              <section id="support">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Support
                </h2>
                <p>
                  For questions, feature requests, or to report an issue, the
                  fastest channel is X at{" "}
                  <a
                    href="https://x.com/UsdpBase"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline hover:no-underline"
                  >
                    @UsdpBase
                  </a>
                  . You can also reach the team through the contact links in
                  the footer.
                </p>
                <p className="mt-4">
                  For legal and policy details, see the{" "}
                  <Link
                    to="/privacy-policy"
                    className="text-foreground underline hover:no-underline"
                  >
                    Privacy Policy
                  </Link>{" "}
                  and the{" "}
                  <Link
                    to="/terms-and-conditions"
                    className="text-foreground underline hover:no-underline"
                  >
                    Terms of Service
                  </Link>
                  .
                </p>
              </section>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Docs;
