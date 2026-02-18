import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import AltisLogo from "@/components/AltisLogo";

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
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

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
          Terms and Conditions
        </h1>
        <p className="text-muted-foreground text-sm mb-12">
          Last updated: February 11, 2026
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing or using the BASEUSDP platform, website, and related services
              (collectively, the "Service"), you agree to be bound by these Terms and Conditions
              ("Terms"). If you do not agree to these Terms, you must not access or use the
              Service.
            </p>
            <p className="mt-3">
              We reserve the right to modify these Terms at any time. Changes will be effective
              immediately upon posting on this page. Your continued use of the Service after
              any modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to use the Service. By using the Service, you
              represent and warrant that you are of legal age and have the legal capacity to
              enter into a binding agreement. You also represent that your use of the Service
              does not violate any applicable law or regulation in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Description of Service</h2>
            <p>
              BASEUSDP provides a privacy-focused payment layer for the agentic economy.
              Our platform enables confidential transactions utilizing zero-knowledge proof
              technology and the x402 payment protocol. The Service includes but is not
              limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Privacy-preserving cryptocurrency payment processing</li>
              <li>Zero-knowledge proof generation and verification</li>
              <li>Wallet connection and transaction management</li>
              <li>Dashboard and analytics tools</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Wallet Connection and Account Security</h2>
            <p>
              To use certain features of the Service, you may need to connect a cryptocurrency
              wallet. You are solely responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Maintaining the security of your wallet and private keys</li>
              <li>All activity that occurs through your connected wallet</li>
              <li>Ensuring your wallet software is up to date and secure</li>
              <li>Any transactions initiated from your wallet through our Service</li>
            </ul>
            <p className="mt-3">
              We will never ask for your private keys or seed phrases. If anyone claiming to
              represent BASEUSDP requests such information, it is a scam.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Transactions and Payments</h2>
            <p>
              All cryptocurrency transactions processed through the Service are subject to
              the following conditions:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>
                <strong className="text-foreground/90">Irreversibility:</strong> Blockchain transactions
                are generally irreversible. Once a transaction is confirmed on the blockchain,
                it cannot be undone or reversed.
              </li>
              <li>
                <strong className="text-foreground/90">Network Fees:</strong> You are responsible for
                any network (gas) fees associated with your transactions.
              </li>
              <li>
                <strong className="text-foreground/90">Processing Times:</strong> Transaction processing
                times depend on the underlying blockchain network and are outside our control.
              </li>
              <li>
                <strong className="text-foreground/90">Accuracy:</strong> You are responsible for
                ensuring the accuracy of all transaction details, including recipient addresses
                and amounts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Prohibited Uses</h2>
            <p>You agree not to use the Service for any of the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Money laundering, terrorist financing, or any other illegal activity</li>
              <li>Fraud, deception, or misrepresentation</li>
              <li>Violation of any applicable local, state, national, or international law</li>
              <li>Circumvention of economic sanctions or trade restrictions</li>
              <li>Interference with or disruption of the Service or its infrastructure</li>
              <li>Unauthorized access to other users' accounts or data</li>
              <li>Distribution of malware, viruses, or other harmful code</li>
              <li>Any activity that could damage, disable, or impair the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by
              BASEUSDP and are protected by international copyright, trademark, patent, trade
              secret, and other intellectual property laws. You may not reproduce, distribute,
              modify, create derivative works of, publicly display, or otherwise exploit any
              content from the Service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES
              OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES
              OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-3">
              We do not warrant that the Service will be uninterrupted, timely, secure, or
              error-free. We do not warrant the accuracy, reliability, or completeness of any
              information provided through the Service. The use of blockchain technology and
              cryptocurrency involves inherent risks, and you acknowledge and accept these
              risks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BASEUSDP AND ITS OFFICERS,
              DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
              BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Loss of profits, data, or digital assets</li>
              <li>Unauthorized access to or alteration of your transmissions or data</li>
              <li>Loss resulting from blockchain network failures or vulnerabilities</li>
              <li>Loss resulting from smart contract bugs or exploits</li>
              <li>Any other loss arising from your use of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless BASEUSDP and its officers,
              directors, employees, agents, and affiliates from and against any claims,
              liabilities, damages, losses, costs, and expenses (including reasonable
              attorney's fees) arising out of or in connection with your use of the Service,
              your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any
              time, with or without cause and with or without notice. Upon termination, your
              right to use the Service will immediately cease. All provisions of these Terms
              that by their nature should survive termination shall survive, including
              ownership provisions, warranty disclaimers, indemnification, and limitations
              of liability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable
              laws, without regard to conflict of law principles. Any disputes arising from
              or relating to these Terms or the Service shall be resolved through binding
              arbitration, unless otherwise required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid, illegal, or
              unenforceable, the remaining provisions shall continue in full force and effect.
              The invalid or unenforceable provision shall be modified to the minimum extent
              necessary to make it valid and enforceable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Contact Us</h2>
            <p>
              If you have any questions or concerns about these Terms and Conditions, please
              contact us at:
            </p>
             <div className="mt-4 p-6 bg-secondary border border-border rounded-lg">
               <p className="font-medium text-foreground">BASEUSDP</p>
               <p className="mt-2">
                 Twitter:{" "}
                 <a href="https://x.com/BaseUSDP" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:no-underline">
                   @BaseUSDP
                 </a>
               </p>
             </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;
