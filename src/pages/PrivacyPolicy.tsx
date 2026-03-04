import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import AltisLogo from "@/components/AltisLogo";

const PrivacyPolicy = () => {
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
          Privacy Policy
        </h1>
        <p className="text-muted-foreground text-sm mb-12">
          Last updated: February 11, 2026
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p>
              Welcome to BASEUSDP ("we," "our," or "us"). We are committed to protecting your
              privacy and ensuring the security of your personal information. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you
              use our platform, website, and related services (collectively, the "Service").
            </p>
            <p className="mt-3">
              By accessing or using the Service, you agree to the terms of this Privacy Policy.
              If you do not agree with the practices described herein, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-foreground/90 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Wallet addresses when connecting to the platform</li>
              <li>Email address if you subscribe to our newsletter or contact us</li>
              <li>Transaction details when using payment features</li>
              <li>Any additional information you voluntarily provide through support requests</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground/90 mb-2 mt-6">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and approximate geographic location</li>
              <li>Usage data (pages visited, features used, interaction patterns)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground/90 mb-2 mt-6">2.3 Blockchain Data</h3>
            <p>
              Please note that blockchain transactions are inherently public. While our platform
              utilizes zero-knowledge proof technology to enhance transaction privacy, certain
              on-chain data may be publicly accessible on the respective blockchain networks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process transactions and send related notifications</li>
              <li>Improve, personalize, and expand our Service</li>
              <li>Understand and analyze how you use our Service</li>
              <li>Develop new products, services, features, and functionality</li>
              <li>Communicate with you for customer service, updates, and marketing purposes</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations and enforce our terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>
                <strong className="text-foreground/90">Service Providers:</strong> With third-party vendors
                who perform services on our behalf (analytics, hosting, infrastructure)
              </li>
              <li>
                <strong className="text-foreground/90">Legal Requirements:</strong> When required by law,
                regulation, legal process, or governmental request
              </li>
              <li>
                <strong className="text-foreground/90">Protection of Rights:</strong> To protect the rights,
                property, or safety of BASEUSDP, our users, or the public
              </li>
              <li>
                <strong className="text-foreground/90">Business Transfers:</strong> In connection with a
                merger, acquisition, or sale of assets
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your
              personal information against unauthorized access, alteration, disclosure, or
              destruction. These measures include encryption, access controls, and secure
              infrastructure practices. However, no method of transmission over the Internet
              or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Retention</h2>
            <p>
              We retain your personal information only for as long as necessary to fulfill the
              purposes outlined in this Privacy Policy, unless a longer retention period is
              required or permitted by law. When we no longer need your information, we will
              securely delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Data portability — receive your data in a structured, machine-readable format</li>
              <li>Withdraw consent at any time where processing is based on consent</li>
            </ul>
             <p className="mt-3">
               To exercise any of these rights, please reach out to us on our social channels.
             </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Third-Party Services</h2>
            <p>
               Our Service may contain links to third-party websites, services, or applications
               that are not operated by us. We have no control over and assume no responsibility
               for the content, privacy policies, or practices of any third-party services. We
               encourage you to review the privacy policies of any third-party services you
               interact with.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Children's Privacy</h2>
            <p>
              Our Service is not intended for individuals under the age of 18. We do not
              knowingly collect personal information from children. If you are a parent or
               guardian and believe your child has provided us with personal information, please
               reach out to us on our social channels
               and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new Privacy Policy on this page and updating the
              "Last updated" date. Your continued use of the Service after any changes
              constitutes your acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy
              or our data practices, please contact us at:
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

export default PrivacyPolicy;
