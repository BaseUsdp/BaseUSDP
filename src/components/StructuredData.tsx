/**
 * StructuredData Component
 *
 * Renders JSON-LD structured data in the document head
 * for improved search engine understanding of BASEUSDP pages.
 *
 * Supports Organization, WebApplication, and FAQ schema types.
 */

import { memo, useMemo } from "react";

interface OrganizationSchema {
  type: "Organization";
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}

interface WebApplicationSchema {
  type: "WebApplication";
  name: string;
  url: string;
  description: string;
  applicationCategory: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
}

interface FAQSchema {
  type: "FAQ";
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

type SchemaType = OrganizationSchema | WebApplicationSchema | FAQSchema;

interface StructuredDataProps {
  schema: SchemaType;
}

function buildJsonLd(schema: SchemaType): Record<string, any> {
  switch (schema.type) {
    case "Organization":
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: schema.name,
        url: schema.url,
        logo: schema.logo,
        description: schema.description,
        sameAs: schema.sameAs,
      };

    case "WebApplication":
      return {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: schema.name,
        url: schema.url,
        description: schema.description,
        applicationCategory: schema.applicationCategory,
        operatingSystem: schema.operatingSystem ?? "Any",
        offers: schema.offers
          ? {
              "@type": "Offer",
              price: schema.offers.price,
              priceCurrency: schema.offers.priceCurrency,
            }
          : undefined,
      };

    case "FAQ":
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: schema.questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.answer,
          },
        })),
      };
  }
}

function StructuredDataInner({ schema }: StructuredDataProps) {
  const jsonLd = useMemo(() => JSON.stringify(buildJsonLd(schema)), [schema]);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}

export const StructuredData = memo(StructuredDataInner);

/** Pre-configured BASEUSDP organization schema */
export const BASEUSDP_ORG_SCHEMA: OrganizationSchema = {
  type: "Organization",
  name: "BASEUSDP",
  url: "https://baseusdp.com",
  logo: "https://baseusdp.com/logo.png",
  description: "Privacy-first stablecoin payment protocol on Base (Coinbase L2).",
  sameAs: [
    "https://x.com/baseusdp",
    "https://github.com/BaseUsdp/BaseUSDP",
  ],
};

/** Pre-configured BASEUSDP web app schema */
export const BASEUSDP_APP_SCHEMA: WebApplicationSchema = {
  type: "WebApplication",
  name: "BASEUSDP",
  url: "https://baseusdp.com/dashboard",
  description:
    "Send and receive private payments using Zero-Knowledge Proofs on Base. Supports USDC, ETH, and other ERC-20 tokens.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: {
    price: "0",
    priceCurrency: "USD",
  },
};

export default StructuredData;
