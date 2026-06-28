/**
 * types.ts — Shared TypeScript types and enums for the expense tracker.
 *
 * These mirror the Zod schemas in schema.ts but are plain TS types so they can
 * be used in type positions without pulling Zod into every consumer. Whenever a
 * schema changes here, keep schema.ts in sync.
 */

/* -------------------------------------------------------------------------- */
/*  Enums / literal unions                                                     */
/* -------------------------------------------------------------------------- */

export type AccountType =
  | "bank"
  | "cash"
  | "card"
  | "savings"
  | "investment"
  | "other";

export type CategoryType = "expense" | "income" | "both";

export type TransactionType = "expense" | "income" | "transfer";

export type ExchangeRateSource = "frankfurter" | "manual";

export type BudgetPeriod = "monthly";

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type RecurringType = "expense" | "income";

export type Theme = "light" | "dark" | "system";

export type FirstDayOfWeek = "monday" | "sunday";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type ExchangeRateProvider = "frankfurter";

/* -------------------------------------------------------------------------- */
/*  Core entity types                                                          */
/* -------------------------------------------------------------------------- */

/** A generic "everything else" bag for forward-compatible fields. */
export type Metadata = Record<string, unknown>;

export interface Settings {
  schema_version: number;
  updated_at: string;
  base_currency: string;
  theme: Theme;
  date_format: DateFormat;
  first_day_of_week: FirstDayOfWeek;
  visible_currencies: string[];
  exchange_rate_provider: ExchangeRateProvider;
  exchange_rate_cache_hours: number;
  metadata: Metadata;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  metadata: Metadata;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  type: CategoryType;
  color: string;
  icon: string;
  archived: boolean;
  created_at: string;
  metadata: Metadata;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  account_id: string;
  category_id: string | null;
  date: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;

  /** Destination account — only set on `transfer` transactions. */
  transfer_to_account_id: string | null;
  /** Amount in the source account's currency (transfer only). */
  transfer_from_amount: number | null;
  /** Amount in the destination account's currency (transfer only). */
  transfer_to_amount: number | null;
  /** Exchange rate applied to the transfer (transfer only). */
  exchange_rate: number | null;
  /** Where the exchange rate came from (transfer only). */
  exchange_rate_source: ExchangeRateSource | null;
  /** ISO date the exchange rate was sourced (transfer only). */
  exchange_rate_date: string | null;
  /** Optional fee charged on a transfer (transfer only). */
  transfer_fee: number | null;
  /** Account the transfer fee is booked to (transfer only). */
  transfer_fee_account_id: string | null;

  metadata: Metadata;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  active: boolean;
  created_at: string;
  metadata: Metadata;
}

export interface RecurringTransaction {
  id: string;
  type: RecurringType;
  amount: number;
  currency: string;
  account_id: string;
  category_id: string;
  notes: string;
  tags: string[];
  frequency: RecurringFrequency;
  day_of_month: number;
  next_date: string;
  last_created: string | null;
  active: boolean;
  created_at: string;
  metadata: Metadata;
}

/* -------------------------------------------------------------------------- */
/*  Container / file-shape types                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every persisted file carries schema_version + updated_at at the top level and
 * a single primary array (or, for settings, flat fields). These container
 * types describe the on-disk shape of each JSON file.
 */
export type SettingsFile = Settings;

export interface AccountsFile {
  schema_version: number;
  updated_at: string;
  accounts: Account[];
}

export interface CategoriesFile {
  schema_version: number;
  updated_at: string;
  categories: Category[];
}

export interface TransactionsFile {
  schema_version: number;
  updated_at: string;
  transactions: Transaction[];
}

export interface BudgetsFile {
  schema_version: number;
  updated_at: string;
  budgets: Budget[];
}

export interface RecurringFile {
  schema_version: number;
  updated_at: string;
  recurring: RecurringTransaction[];
}

/** Union of every top-level file payload. */
export type AnyDataFile =
  | SettingsFile
  | AccountsFile
  | CategoriesFile
  | TransactionsFile
  | BudgetsFile
  | RecurringFile;

/* -------------------------------------------------------------------------- */
/*  Static reference data                                                      */
/* -------------------------------------------------------------------------- */

/** Account type options surfaced in the UI, with display labels and icons. */
export const ACCOUNT_TYPES: ReadonlyArray<{
  value: AccountType;
  label: string;
  icon: string;
}> = [
  { value: "bank", label: "Bank", icon: "🏦" },
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "card", label: "Card", icon: "💳" },
  { value: "savings", label: "Savings", icon: "🐷" },
  { value: "investment", label: "Investment", icon: "📈" },
  { value: "other", label: "Other", icon: "📦" },
];

/** Currency metadata for the currencies the app ships with out of the box. */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  /** Number of decimal places typically displayed. */
  decimals: number;
}

export const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  CZK: { code: "CZK", symbol: "Kč", name: "Czech Koruna", decimals: 2 },
};

/* -------------------------------------------------------------------------- */
/*  Default categories                                                         */
/* -------------------------------------------------------------------------- */

export interface DefaultCategory {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

/**
 * Seed categories created on first run. IDs are generated at creation time, not
 * here, so these are pure templates.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Food", type: "expense", color: "#EF4444", icon: "🍔" },
  { name: "Transport", type: "expense", color: "#3B82F6", icon: "🚌" },
  { name: "Rent", type: "expense", color: "#8B5CF6", icon: "🏠" },
  { name: "Utilities", type: "expense", color: "#F59E0B", icon: "💡" },
  { name: "Entertainment", type: "expense", color: "#EC4899", icon: "🎬" },
  { name: "Shopping", type: "expense", color: "#14B8A6", icon: "🛍️" },
  { name: "Health", type: "expense", color: "#10B981", icon: "💊" },
  { name: "Salary", type: "income", color: "#22C55E", icon: "💰" },
  { name: "Other", type: "both", color: "#6B7280", icon: "📦" },
];

/* -------------------------------------------------------------------------- */
/*  Current schema version                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Bump this whenever a breaking change is made to any file's shape and a
 * migration is added to migrations.ts. All files share one version counter for
 * simplicity — a migration bumps the version for every file at once.
 */
export const CURRENT_SCHEMA_VERSION = 1;
