/**
 * schema.ts — Zod runtime validation schemas for every persisted entity.
 *
 * Each `validateX` / `validateXFile` function accepts truly unknown input,
 * parses it through the corresponding Zod schema, and returns strongly-typed
 * data with defaults applied for any missing optional fields. Parse failures
 * throw a ZodError; callers that need soft handling should wrap in try/catch or
 * use `.safeParse` via the exported `XSchema` objects directly.
 */
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  DEFAULT_CATEGORIES,
  type Account,
  type AccountType,
  type Budget,
  type BudgetPeriod,
  type Category,
  type CategoryType,
  type DateFormat,
  type ExchangeRateProvider,
  type ExchangeRateSource,
  type FirstDayOfWeek,
  type Metadata,
  type RecurringFrequency,
  type RecurringTransaction,
  type RecurringType,
  type Settings,
  type Theme,
  type Transaction,
  type TransactionType,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Re-exports — keep types.ts as the single source of truth for types, but    */
/*  also surface them here so consumers can `import { ... } from "@/lib/schema"`. */
/* -------------------------------------------------------------------------- */

export type {
  Account,
  AccountType,
  AccountsFile,
  AnyDataFile,
  Budget,
  BudgetPeriod,
  BudgetsFile,
  Category,
  CategoryType,
  CategoriesFile,
  CurrencyInfo,
  DateFormat,
  ExchangeRateProvider,
  ExchangeRateSource,
  FirstDayOfWeek,
  Metadata,
  RecurringFile,
  RecurringFrequency,
  RecurringTransaction,
  RecurringType,
  Settings,
  SettingsFile,
  Theme,
  Transaction,
  TransactionType,
  TransactionsFile,
} from "./types";

export {
  ACCOUNT_TYPES,
  CURRENCY_INFO,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                     */
/* -------------------------------------------------------------------------- */

/** ISO-8601-ish timestamp string (validated loosely; we don't reparse dates). */
const timestampSchema = z.string().min(1);

/** UUID v1–v5. */
const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

/** Free-form forward-compat bag. Defaults to {} when absent. */
const metadataSchema: z.ZodType<Metadata> = z
  .record(z.string(), z.unknown())
  .default({});

/** A 3-letter ISO 4217 currency code. */
const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code");

/** A `YYYY-MM-DD` calendar date. */
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** A 6-digit hex color like `#EF4444`. */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a #RRGGBB hex string");

/** Non-empty string used for a single emoji/glyph icon. */
const iconSchema = z.string().min(1);

/* -------------------------------------------------------------------------- */
/*  Literal-union schemas (kept in sync with types.ts)                         */
/* -------------------------------------------------------------------------- */

export const accountTypeSchema = z.enum([
  "bank",
  "cash",
  "card",
  "savings",
  "investment",
  "other",
]) satisfies z.ZodType<AccountType>;

export const categoryTypeSchema = z.enum([
  "expense",
  "income",
  "both",
]) satisfies z.ZodType<CategoryType>;

export const transactionTypeSchema = z.enum([
  "expense",
  "income",
  "transfer",
]) satisfies z.ZodType<TransactionType>;

export const exchangeRateSourceSchema = z
  .enum(["frankfurter", "manual"])
  .nullable()
  .default(null) satisfies z.ZodType<ExchangeRateSource | null>;

export const budgetPeriodSchema = z
  .enum(["monthly"])
  .default("monthly") satisfies z.ZodType<BudgetPeriod>;

export const recurringFrequencySchema = z.enum([
  "weekly",
  "monthly",
  "yearly",
]) satisfies z.ZodType<RecurringFrequency>;

export const recurringTypeSchema = z.enum([
  "expense",
  "income",
]) satisfies z.ZodType<RecurringType>;

export const themeSchema = z
  .enum(["light", "dark", "system"])
  .default("light") satisfies z.ZodType<Theme>;

export const firstDayOfWeekSchema = z
  .enum(["monday", "sunday"])
  .default("monday") satisfies z.ZodType<FirstDayOfWeek>;

export const dateFormatSchema = z
  .enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])
  .default("DD/MM/YYYY") satisfies z.ZodType<DateFormat>;

export const exchangeRateProviderSchema = z
  .enum(["frankfurter"])
  .default("frankfurter") satisfies z.ZodType<ExchangeRateProvider>;

/* -------------------------------------------------------------------------- */
/*  Entity schemas                                                             */
/* -------------------------------------------------------------------------- */

export const accountSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  type: accountTypeSchema,
  currency: currencyCodeSchema,
  initial_balance: z.number().finite().default(0),
  color: hexColorSchema.default("#3B82F6"),
  icon: iconSchema.default("🏦"),
  archived: z.boolean().default(false),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  metadata: metadataSchema,
}) satisfies z.ZodType<Account>;

export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  parent_id: uuidSchema.nullable().default(null),
  type: categoryTypeSchema,
  color: hexColorSchema.default("#6B7280"),
  icon: iconSchema.default("📦"),
  archived: z.boolean().default(false),
  created_at: timestampSchema,
  metadata: metadataSchema,
}) satisfies z.ZodType<Category>;

export const transactionSchema = z.object({
  id: uuidSchema,
  type: transactionTypeSchema,
  amount: z.number().finite().nonnegative(),
  currency: currencyCodeSchema,
  account_id: z.string().min(1),
  category_id: z.string().nullable().default(null),
  date: dateOnlySchema,
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
  created_at: timestampSchema,
  updated_at: timestampSchema,

  // Transfer-only fields — all default to null for expense/income.
  transfer_to_account_id: z.string().nullable().default(null),
  transfer_from_amount: z.number().finite().nullable().default(null),
  transfer_to_amount: z.number().finite().nullable().default(null),
  exchange_rate: z.number().finite().positive().nullable().default(null),
  exchange_rate_source: exchangeRateSourceSchema,
  exchange_rate_date: dateOnlySchema.nullable().default(null),
  transfer_fee: z.number().finite().nullable().default(null),
  transfer_fee_account_id: z.string().nullable().default(null),

  metadata: metadataSchema,
}) satisfies z.ZodType<Transaction>;

export const budgetSchema = z.object({
  id: uuidSchema,
  category_id: uuidSchema,
  amount: z.number().finite().nonnegative(),
  currency: currencyCodeSchema,
  period: budgetPeriodSchema,
  active: z.boolean().default(true),
  created_at: timestampSchema,
  metadata: metadataSchema,
}) satisfies z.ZodType<Budget>;

export const recurringSchema = z.object({
  id: uuidSchema,
  type: recurringTypeSchema,
  amount: z.number().finite().nonnegative(),
  currency: currencyCodeSchema,
  account_id: uuidSchema,
  category_id: uuidSchema,
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
  frequency: recurringFrequencySchema,
  day_of_month: z.number().int().min(1).max(31),
  next_date: dateOnlySchema,
  last_created: dateOnlySchema.nullable().default(null),
  active: z.boolean().default(true),
  created_at: timestampSchema,
  metadata: metadataSchema,
}) satisfies z.ZodType<RecurringTransaction>;

export const settingsSchema = z.object({
  schema_version: z.number().int().nonnegative().default(1),
  updated_at: timestampSchema,
  base_currency: currencyCodeSchema.default("EUR"),
  theme: themeSchema,
  date_format: dateFormatSchema,
  first_day_of_week: firstDayOfWeekSchema,
  visible_currencies: z.array(currencyCodeSchema).default([
    "EUR",
    "INR",
    "USD",
    "CZK",
  ]),
  exchange_rate_provider: exchangeRateProviderSchema,
  exchange_rate_cache_hours: z.number().int().positive().default(24),
  metadata: metadataSchema,
}) satisfies z.ZodType<Settings>;

/* -------------------------------------------------------------------------- */
/*  File (container) schemas                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every container file carries a top-level `schema_version`. We coerce it to a
 * number so files written as `{"schema_version": "1"}` (e.g. from a JSON edit)
 * still validate.
 */
const fileVersionSchema = z.coerce.number().int().nonnegative().default(1);

export const settingsFileSchema = settingsSchema;

export const accountsFileSchema = z.object({
  schema_version: fileVersionSchema,
  updated_at: timestampSchema,
  accounts: z.array(accountSchema).default([]),
});

export const categoriesFileSchema = z.object({
  schema_version: fileVersionSchema,
  updated_at: timestampSchema,
  categories: z.array(categorySchema).default([]),
});

export const transactionsFileSchema = z.object({
  schema_version: fileVersionSchema,
  updated_at: timestampSchema,
  transactions: z.array(transactionSchema).default([]),
});

export const budgetsFileSchema = z.object({
  schema_version: fileVersionSchema,
  updated_at: timestampSchema,
  budgets: z.array(budgetSchema).default([]),
});

export const recurringFileSchema = z.object({
  schema_version: fileVersionSchema,
  updated_at: timestampSchema,
  recurring: z.array(recurringSchema).default([]),
});

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Run an unknown value through a schema and return the validated, defaulted
 * result. Throws `ZodError` on failure.
 */
function parseWith<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  return schema.parse(data);
}

/* --- Entities --- */

export function validateAccount(data: unknown): Account {
  return parseWith(accountSchema, data);
}

export function validateCategory(data: unknown): Category {
  return parseWith(categorySchema, data);
}

export function validateTransaction(data: unknown): Transaction {
  return parseWith(transactionSchema, data);
}

export function validateBudget(data: unknown): Budget {
  return parseWith(budgetSchema, data);
}

export function validateRecurring(data: unknown): RecurringTransaction {
  return parseWith(recurringSchema, data);
}

export function validateSettings(data: unknown): Settings {
  return parseWith(settingsSchema, data);
}

/* --- File containers --- */

export function validateSettingsFile(data: unknown) {
  return parseWith(settingsFileSchema, data);
}

export function validateAccountsFile(data: unknown) {
  return parseWith(accountsFileSchema, data);
}

export function validateCategoriesFile(data: unknown) {
  return parseWith(categoriesFileSchema, data);
}

export function validateTransactionsFile(data: unknown) {
  return parseWith(transactionsFileSchema, data);
}

export function validateBudgetsFile(data: unknown) {
  return parseWith(budgetsFileSchema, data);
}

export function validateRecurringFile(data: unknown) {
  return parseWith(recurringFileSchema, data);
}

/** The full set of file schemas, keyed by an identifier. Handy for the
 *  migration runner and any generic "load + validate + migrate" pipeline. */
export const FILE_SCHEMAS = {
  settings: settingsFileSchema,
  accounts: accountsFileSchema,
  categories: categoriesFileSchema,
  transactions: transactionsFileSchema,
  budgets: budgetsFileSchema,
  recurring: recurringFileSchema,
} as const;

export type FileSchemaKey = keyof typeof FILE_SCHEMAS;

/* -------------------------------------------------------------------------- */
/*  Default factories                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Build a fresh, valid `Settings` object. Used on first run (no settings.json
 * exists yet) and anywhere else a "blank" settings file is needed.
 */
export function defaultSettings(): Settings {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    updated_at: now,
    base_currency: "EUR",
    theme: "light",
    date_format: "DD/MM/YYYY",
    first_day_of_week: "monday",
    visible_currencies: ["EUR", "INR", "USD", "CZK"],
    exchange_rate_provider: "frankfurter",
    exchange_rate_cache_hours: 24,
    metadata: {},
  };
}

/**
 * Materialize the seed category templates (DEFAULT_CATEGORIES) into full
 * `Category` entities with generated UUIDs, timestamps, and empty metadata.
 * Used on first run to populate categories.json.
 */
export function defaultCategories(): Category[] {
  const now = new Date().toISOString();
  return DEFAULT_CATEGORIES.map((tpl) => ({
    id: uuidv4(),
    name: tpl.name,
    parent_id: null,
    type: tpl.type,
    color: tpl.color,
    icon: tpl.icon,
    archived: false,
    created_at: now,
    metadata: {},
  }));
}
