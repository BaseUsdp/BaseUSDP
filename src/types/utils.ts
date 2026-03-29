/**
 * Shared Utility Types
 *
 * Generic TypeScript utility types used across the BASEUSDP codebase.
 */

/** Make specific keys of T required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys of T optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep partial — makes all nested properties optional */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Deep readonly — makes all nested properties readonly */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Extract the resolved type of a Promise */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/** String literal union from an array */
export type ValueOf<T> = T[keyof T];

/** Branded type for nominal typing */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Branded string types for domain safety */
export type WalletAddress = Brand<string, "WalletAddress">;
export type TransactionHash = Brand<string, "TransactionHash">;
export type TokenAmount = Brand<string, "TokenAmount">;

/** Result type (Rust-inspired) for operations that can fail */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Async result type */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/** Function that returns void (sync or async) */
export type VoidFn = () => void | Promise<void>;

/** Event handler type */
export type EventHandler<T = void> = (event: T) => void;

/** CSS class names type — string or conditional object */
export type ClassName = string | undefined | null | false;

/** Component with children */
export interface WithChildren {
  children: React.ReactNode;
}

/** Component with optional className */
export interface WithClassName {
  className?: string;
}

/** Common component props */
export interface BaseComponentProps extends WithClassName {
  id?: string;
  "data-testid"?: string;
}

/** Hex string (0x-prefixed) */
export type HexString = `0x${string}`;

/** ISO 8601 date string */
export type ISODateString = string & { readonly __iso: unique symbol };

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Sort parameters */
export interface SortParams<T extends string = string> {
  field: T;
  order: "asc" | "desc";
}

/** Non-empty array type */
export type NonEmptyArray<T> = [T, ...T[]];

/** Entries type for Object.entries with proper key types */
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];
