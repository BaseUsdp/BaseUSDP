/**
 * Void402 Backend Server
 * Main entry point for x402 payment server and encrypted transaction services
 * 
 * ARCHITECTURE:
 * - Client-side signing for secure transaction handling
 * - Rate limiting and validation on all endpoints
 * - Wallet-based authentication
 * - Comprehensive error handling and logging
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Connection } from "@solana/web3.js";

// Routes
import paymentRoutes from "./routes/paymentRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import clientSigningRoutes from "./routes/clientSigningRoutes.js";
import solanaRoutes from "./routes/solanaRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";

// Services
import { solanaTransactionService } from "./services/solanaTransactionService.js";
import { solanaX402Service } from "./services/solanaX402Service.js";
import { transactionHistoryService } from "./services/transactionHistoryService.js";
import { transactionBuilderService } from "./services/transactionBuilderService.js";

// Middleware
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  generalRateLimiter,
  logger,
} from "./middleware/index.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Parse JSON bodies
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use(requestLogger);

// General rate limiting (applied to all routes)
app.use(generalRateLimiter);

// =============================================================================
// ROUTES
// =============================================================================

// Health check (no rate limiting)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Void402 Backend",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Payment routes
app.use("/api/payments", paymentRoutes);

// Transaction routes (legacy)
app.use("/api/transactions", transactionRoutes);

// Solana routes (legacy - kept for backward compatibility)
app.use("/api/solana", solanaRoutes);

// Client-side signing routes (NEW)
app.use("/api/solana", clientSigningRoutes);

// Transaction history routes (NEW)
app.use("/api/history", historyRoutes);

// Example protected endpoint
app.get("/api/protected", async (req, res) => {
  res.json({
    message: "This endpoint requires x402 payment",
    note: "Configure PAY_TO_ADDRESS in .env to enable x402 protection",
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

async function initializeServices() {
  try {
    logger.info("Initializing Void402 Solana services...");

    // Solana connection
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(solanaRpcUrl, "confirmed");

    // Token-2022 configuration
    const mintAddress = process.env.TOKEN_2022_MINT_ADDRESS || "";
    const facilitatorProgramId = process.env.FACILITATOR_PROGRAM_ID || "";

    // ALWAYS initialize transaction builder service (for SOL transfers and balance checks)
    // Use a placeholder mint if none configured - will work for SOL operations
    const effectiveMint = mintAddress || "So11111111111111111111111111111111111111112"; // Native SOL mint
    await transactionBuilderService.initialize(solanaRpcUrl, effectiveMint);
    logger.info("✅ Transaction builder service initialized");
    logger.info(`   RPC: ${solanaRpcUrl}`);

    // Initialize history service (works for all transactions)
    transactionHistoryService.initialize(connection, mintAddress || undefined);
    logger.info("✅ Transaction history service initialized");

    if (mintAddress && facilitatorProgramId) {
      // Initialize main transaction service
      await solanaTransactionService.initialize(
        solanaRpcUrl,
        mintAddress,
        facilitatorProgramId
      );

      // Initialize x402 payment service
      await solanaX402Service.initialize(facilitatorProgramId, connection);
      
      logger.info("✅ Token-2022 services initialized");
      logger.info(`   Mint: ${mintAddress}`);
      logger.info(`   Facilitator: ${facilitatorProgramId}`);
    } else {
      logger.warn("⚠️  Token-2022 configuration missing (optional)");
      logger.warn("   Set TOKEN_2022_MINT_ADDRESS in .env for token transfers");
      logger.warn("   Set FACILITATOR_PROGRAM_ID in .env for x402 payments");
    }

    logger.info("All services initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize services:", error);
  }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
  await initializeServices();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 Void402 Backend Server v0.2.0                          ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   📡 Server:     http://localhost:${PORT}                      ║
║   💚 Health:     http://localhost:${PORT}/health               ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   📍 API Endpoints:                                          ║
║                                                              ║
║   Auth:                                                      ║
║     POST /api/auth/nonce       - Get auth nonce             ║
║     POST /api/auth/verify      - Verify & create session    ║
║     POST /api/auth/logout      - Invalidate session         ║
║                                                              ║
║   Transactions:                                              ║
║     POST /api/solana/build-transfer-transaction             ║
║     POST /api/solana/build-payment-transaction              ║
║     POST /api/solana/submit-transaction                     ║
║                                                              ║
║   History:                                                   ║
║     GET /api/history/:address                               ║
║     GET /api/history/:address/count                         ║
║     GET /api/history/:address/summary                       ║
║                                                              ║
║   Payments:                                                  ║
║     POST /api/payments/create                               ║
║     POST /api/payments/verify                               ║
║     GET  /api/payments/status/:id                           ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   🔒 Security Features:                                      ║
║     ✓ Rate limiting (100 req/min general, 10/min tx)        ║
║     ✓ Input validation on all endpoints                     ║
║     ✓ Request logging                                        ║
║     ✓ Wallet-based authentication                           ║
║     ✓ Error handling with proper status codes               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
