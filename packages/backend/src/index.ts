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

// CORS configuration - MUST be first middleware
// Allow multiple origins for production and development
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
  : [
      "https://www.void402.com",
      "https://void402.com",
      "https://code-whisperer-33.vercel.app",
      "https://code-whisperer-33-*.vercel.app", // Vercel preview deployments
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8080",
    ];

// Add CORS headers FIRST for Vercel serverless compatibility (before cors middleware)
// This MUST be the very first middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  const isAllowed = !origin || allowedOrigins.some(allowed => {
    if (allowed === "*") return true;
    if (allowed.includes("*")) {
      const pattern = allowed.replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return origin === allowed;
  });
  
  // ALWAYS set CORS headers for preflight requests
  // Set CORS headers - ALWAYS set them for allowed origins
  if (isAllowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (isAllowed) {
    // No origin but allowed
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // Handle preflight OPTIONS requests - MUST return early with 204
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Explicitly handle OPTIONS for all routes BEFORE other middleware
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  const isAllowed = !origin || allowedOrigins.some(allowed => {
    if (allowed === "*") return true;
    if (allowed.includes("*")) {
      const pattern = allowed.replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return origin === allowed;
  });
  
  if (isAllowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

// Also use cors middleware as backup
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === "*") return true;
      if (allowedOrigin.includes("*")) {
        // Handle wildcard patterns like "https://*.vercel.app"
        const pattern = allowedOrigin.replace("*", ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return origin === allowedOrigin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // Log for debugging
      console.log(`CORS check - Origin: ${origin}, Allowed: ${JSON.stringify(allowedOrigins)}`);
      logger.warn(`CORS blocked origin: ${origin}, Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
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

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
let initializationError: Error | null = null;

async function initializeServices(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      logger.info("Initializing Void402 Solana services with Token-2022...");

      // Solana connection
      const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(solanaRpcUrl, "confirmed");

      // Token-2022 configuration
      const mintAddress = process.env.TOKEN_2022_MINT_ADDRESS || "";
      const facilitatorProgramId = process.env.FACILITATOR_PROGRAM_ID || "";

      if (mintAddress && facilitatorProgramId) {
        // Initialize main transaction service
        await solanaTransactionService.initialize(
          solanaRpcUrl,
          mintAddress,
          facilitatorProgramId
        );

        // Initialize x402 payment service
        await solanaX402Service.initialize(facilitatorProgramId, connection);

        // Initialize transaction history service
        transactionHistoryService.initialize(connection, mintAddress);
        
        logger.info("✅ Token-2022 service initialized");
        logger.info(`   Mint: ${mintAddress}`);
        logger.info(`   Facilitator: ${facilitatorProgramId}`);
        isInitialized = true;
      } else {
        logger.warn("⚠️  Token-2022 configuration missing");
        logger.warn("   Set TOKEN_2022_MINT_ADDRESS in .env");
        logger.warn("   Set FACILITATOR_PROGRAM_ID in .env");
        
        // Initialize history service without mint (will still work for SOL transactions)
        transactionHistoryService.initialize(connection);
        isInitialized = true; // Still mark as initialized for basic functionality
      }

      logger.info("Services initialized successfully");
      initializationError = null;
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to initialize services:", error);
      throw initializationError;
    }
  })();

  return initializationPromise;
}

/**
 * Ensure services are initialized before handling requests
 * This is critical for Vercel serverless functions where initialization is async
 */
export async function ensureInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationError) {
    throw new Error(`Services failed to initialize: ${initializationError.message}`);
  }

  // Wait for initialization to complete (with timeout)
  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("Service initialization timeout")), 10000);
  });

  await Promise.race([initializeServices(), timeout]);
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

// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== "1") {
  startServer().catch((error) => {
    logger.error("Failed to start server:", error);
    process.exit(1);
  });
} else {
  // Initialize services for Vercel (async initialization)
  // Start initialization immediately but don't block
  initializeServices().catch((error) => {
    logger.error("Failed to initialize services:", error);
  });
}
