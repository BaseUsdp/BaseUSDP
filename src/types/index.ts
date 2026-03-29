/**
 * Types Barrel Export
 *
 * Re-exports all type definitions from a single entry point.
 *
 * Usage:
 *   import type { Transaction, WalletAddress, ApiResponse } from "@/types";
 */

export type {
  ApiResponse,
  PaginatedResponse,
  NonceRequest,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
  BalanceResponse,
  ZKBalanceResponse,
  TransferRequest,
  TransferResponse,
  SwapQuoteRequest,
  SwapQuoteResponse,
  PaymentLinkResponse,
  SupportTicketRequest,
  HealthCheckResponse,
} from "./api";

export type {
  PrivacyLevel,
  TransactionDirection,
  TransactionStatus,
  TokenSymbol,
  TokenInfo,
  Transaction,
  TransactionFilter,
  TransactionSort,
  TransactionCSVRow,
  ZKProofMetadata,
  TransactionReceipt,
  TransactionLog,
} from "./transactions";

export type {
  WalletProvider,
  Chain,
  NetworkEnvironment,
  ConnectionState,
  ChainConfig,
  WalletInfo,
  ConnectedWallet,
  EVMProvider,
  SignMessageRequest,
  SignMessageResponse,
} from "./wallet";

export { BASE_MAINNET, BASE_SEPOLIA } from "./wallet";

export type {
  WSMessageType,
  WSMessage,
  WSSubscribeMessage,
  WSUnsubscribeMessage,
  WSAuthMessage,
  WSTxUpdateMessage,
  WSBalanceUpdateMessage,
  WSPriceUpdateMessage,
  WSNotificationMessage,
  WSErrorMessage,
  WSPingMessage,
  WSPongMessage,
  ServerMessage,
  ClientMessage,
  WSConfig,
} from "./websocket";

export { DEFAULT_WS_CONFIG } from "./websocket";

export type {
  RequireKeys,
  OptionalKeys,
  DeepPartial,
  DeepReadonly,
  ValueOf,
  Brand,
  WalletAddress,
  TransactionHash,
  TokenAmount,
  Result,
  AsyncResult,
  VoidFn,
  EventHandler,
  ClassName,
  WithChildren,
  WithClassName,
  BaseComponentProps,
  HexString,
  ISODateString,
  PaginationParams,
  SortParams,
  NonEmptyArray,
  Entries,
} from "./utils";
