/**
 * BASEUSDP Flywheel status (read-only)
 * GET /api/flywheel/status
 *
 * Returns the on-chain USDC balance of the dedicated flywheel wallet
 * and the cumulative fee volume recorded in zk_transactions for Base.
 *
 * Public — no auth required. Wallet address is non-sensitive.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getBaseProvider,
  getUsdcAddress,
  formatUsdc,
  isValidBaseAddress,
  ERC20_ABI,
} from "../lib/void402-base.js";
import { ethers } from "ethers";

const USDP_TOKEN_ADDRESS_BASE =
  process.env.BASE_USDP_TOKEN_ADDRESS ||
  "0x7b29e5266634BCbA06686E580AfD4419a8c84b07";

const BURN_ADDRESSES = [
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000000",
].map((a) => a.toLowerCase());

const USDP_BURN_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const flywheelAddress = process.env.FLYWHEEL_WALLET_ADDRESS;
  if (!flywheelAddress || !isValidBaseAddress(flywheelAddress)) {
    return res.status(503).json({
      configured: false,
      error: "FLYWHEEL_WALLET_ADDRESS not configured",
    });
  }

  const provider = getBaseProvider();

  let usdcBalance = "0";
  let usdcBalanceRaw = "0";
  try {
    const usdc = new ethers.Contract(getUsdcAddress(), ERC20_ABI, provider);
    const raw: bigint = await usdc.balanceOf(flywheelAddress);
    usdcBalanceRaw = raw.toString();
    usdcBalance = formatUsdc(raw);
  } catch (err: any) {
    console.warn("[flywheel] balance lookup failed:", err?.message);
  }

  let usdpBurnt = 0;
  let usdpBurntRaw = "0";
  let usdpDecimals = 18;
  let usdpSymbol = "USDP";
  try {
    const usdp = new ethers.Contract(USDP_TOKEN_ADDRESS_BASE, USDP_BURN_ABI, provider);
    try {
      usdpDecimals = Number(await usdp.decimals());
    } catch {}
    try {
      usdpSymbol = await usdp.symbol();
    } catch {}

    const latest = await provider.getBlockNumber();
    const horizon = Number(process.env.FLYWHEEL_BURN_HORIZON_BLOCKS || 500_000); // ~12d at 2s blocks
    const start = Math.max(0, latest - horizon);
    const CHUNK = 9_000; // stay under Base RPC's 10k-block ceiling

    const filter = usdp.filters.Transfer(flywheelAddress, null);
    const ranges: Array<[number, number]> = [];
    for (let from = start; from <= latest; from += CHUNK + 1) {
      ranges.push([from, Math.min(from + CHUNK, latest)]);
    }

    let raw = 0n;
    const batchSize = 8;
    for (let i = 0; i < ranges.length; i += batchSize) {
      const batch = ranges.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(([from, to]) =>
          usdp.queryFilter(filter, from, to).catch((e: any) => {
            console.warn(`[flywheel] chunk ${from}-${to} failed:`, e?.message);
            return [];
          })
        )
      );
      for (const events of results) {
        for (const event of events as any[]) {
          const args = event?.args;
          if (!args) continue;
          const to = String(args.to || "").toLowerCase();
          if (BURN_ADDRESSES.includes(to)) {
            raw += BigInt(args.value.toString());
          }
        }
      }
    }
    usdpBurntRaw = raw.toString();
    usdpBurnt = Number(ethers.formatUnits(raw, usdpDecimals));
  } catch (err: any) {
    console.warn("[flywheel] usdp burn query failed:", err?.message);
  }

  return res.status(200).json({
    configured: true,
    chain: "base",
    wallet: flywheelAddress,
    explorer: `https://basescan.org/address/${flywheelAddress}`,
    balance: {
      usdc: Number(usdcBalance),
      raw: usdcBalanceRaw,
      decimals: 6,
    },
    usdpBurnt: {
      amount: usdpBurnt,
      raw: usdpBurntRaw,
      decimals: usdpDecimals,
      symbol: usdpSymbol,
      token: USDP_TOKEN_ADDRESS_BASE,
      note: "Transfers from the flywheel wallet to 0x…dEaD / 0x…0000 on Base USDP",
    },
    allocation: {
      buybacks: 30,
      burns: 50,
      rewards: 20,
      note: "Indicative split. Execution is manual until the buyback/burn module ships.",
    },
  });
}
