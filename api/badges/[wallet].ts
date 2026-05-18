/**
 * Onchain badges (#12)
 * GET /api/badges/:wallet
 *
 * Reads attestations + Basenames for a wallet and returns a flat badge map.
 * v1 sources:
 * - Coinbase Verified Account  (EAS schema 0xf8b05c79f0...)
 * - Coinbase Verified Country  (EAS schema 0x08b27fb634...) — returns the country code
 *
 * Basenames is handled client-side via our existing ENS resolver, so it's
 * not in this route — keeps this endpoint to a single network call.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const EAS_GRAPHQL = "https://base.easscan.org/graphql";
const COINBASE_VERIFIED_ACCOUNT_SCHEMA =
  "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";
const COINBASE_VERIFIED_COUNTRY_SCHEMA =
  "0x08b27fb63458d0a9a89a4a2148a8208938ca51220bafa8074587791f2bf333fe";
const COINBASE_ATTESTER = "0x44ACE9abB148e8412AC4492e9A1AE6bd88226803";

const ALLOWED_ORIGINS = [
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

async function fetchAttestation(
  schemaId: string,
  recipient: string
): Promise<{ revoked: boolean; decodedDataJson: string } | null> {
  const query = `{
    attestations(
      where: {
        schemaId: { equals: "${schemaId}" },
        recipient: { equals: "${recipient}" },
        attester: { equals: "${COINBASE_ATTESTER}" }
      },
      orderBy: [{ time: desc }],
      take: 1
    ) {
      revoked
      decodedDataJson
    }
  }`;
  try {
    const res = await fetch(EAS_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const list = json?.data?.attestations ?? [];
    return list[0] ?? null;
  } catch (err) {
    console.warn("[Badges] EAS query failed:", err);
    return null;
  }
}

function parseDecodedCountry(decodedDataJson: string): string | null {
  try {
    const parsed = JSON.parse(decodedDataJson);
    const entry = Array.isArray(parsed)
      ? parsed.find((p: any) => p?.name === "verifiedCountry")
      : null;
    const value = entry?.value?.value;
    if (typeof value === "string" && value.length > 0) return value;
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const wallet = (req.query.wallet as string | undefined)?.toLowerCase() ?? "";
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: "Invalid wallet" });
  }

  const [accountAttn, countryAttn] = await Promise.all([
    fetchAttestation(COINBASE_VERIFIED_ACCOUNT_SCHEMA, wallet),
    fetchAttestation(COINBASE_VERIFIED_COUNTRY_SCHEMA, wallet),
  ]);

  const coinbaseVerifiedAccount = !!accountAttn && !accountAttn.revoked;
  const coinbaseCountry =
    countryAttn && !countryAttn.revoked
      ? parseDecodedCountry(countryAttn.decodedDataJson)
      : null;

  // 5-minute browser cache. Attestations don't change minute-to-minute.
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

  return res.status(200).json({
    success: true,
    badges: {
      coinbase_verified_account: coinbaseVerifiedAccount,
      coinbase_verified_country: coinbaseCountry,
    },
  });
}
