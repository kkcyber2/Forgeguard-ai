import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Agathon — typed Supabase client adapter.
 * ----------------------------------------
 *
 * Migration `0002_agathon_schema.sql` adds new tables (subscriptions,
 * invoices, payment_methods, brain_transcripts, custom_tools,
 * tool_executions, scan_reports, usage_events) and adds new columns to
 * existing ones (profiles.stripe_customer_id, scans.intensity, etc.).
 *
 * The committed `Database` type in src/types/supabase.ts is auto-generated
 * by `supabase gen types typescript` and lags the migration. Until you
 * run codegen against the live DB, those tables don't exist in the
 * compile-time Supabase types — so calling `admin.from("subscriptions")`
 * trips the type-checker.
 *
 * This module exports a *narrow* augmentation that captures only the
 * columns the Agathon helpers actually read or write. Once you run
 *
 *     npx supabase gen types typescript --linked > src/types/supabase.ts
 *
 * the augmentation is harmless — the codegen-generated columns are a
 * superset of what we declare here.
 *
 * Use it like:
 *
 *     import { asAgathonDb } from "@/lib/agathon/agathon-db";
 *     const db = asAgathonDb(createAdminSupabase());
 *     await db.from("subscriptions").upsert({ ... });
 */

// ---- Narrow row shapes --------------------------------------------------- //

export interface AgathonProfileRow {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  current_plan: "free" | "operator" | "redteam" | "enterprise" | null;
  entitlements: Record<string, unknown> | null;
  scans_used_this_period: number | null;
}

export interface AgathonSubscriptionRow {
  stripe_subscription_id: string;
  user_id: string;
  stripe_customer_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: "free" | "operator" | "redteam" | "enterprise";
  raw: unknown;
}

export interface AgathonInvoiceRow {
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
}

export interface AgathonPaymentMethodRow {
  stripe_payment_method_id: string;
  stripe_customer_id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

// Compose with the existing Database type. Anything we don't override
// falls through to the generated shape, so callers that grab `scans` or
// `scan_logs` still get full typing.

export type AgathonDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      profiles: {
        Row: Database["public"]["Tables"]["profiles"]["Row"] & AgathonProfileRow;
        Insert: Database["public"]["Tables"]["profiles"]["Insert"] &
          Partial<AgathonProfileRow>;
        Update: Partial<AgathonProfileRow> &
          Database["public"]["Tables"]["profiles"]["Update"];
        Relationships: [];
      };
      subscriptions: {
        Row: AgathonSubscriptionRow;
        Insert: AgathonSubscriptionRow;
        Update: Partial<AgathonSubscriptionRow>;
        Relationships: [];
      };
      invoices: {
        Row: AgathonInvoiceRow;
        Insert: AgathonInvoiceRow;
        Update: Partial<AgathonInvoiceRow>;
        Relationships: [];
      };
      payment_methods: {
        Row: AgathonPaymentMethodRow;
        Insert: AgathonPaymentMethodRow;
        Update: Partial<AgathonPaymentMethodRow>;
        Relationships: [];
      };
    };
  };
};

/**
 * Cast a generic Supabase client to the Agathon-augmented Database. This
 * is a type-only operation — runtime is unchanged.
 */
export function asAgathonDb(
  client: SupabaseClient<Database>,
): SupabaseClient<AgathonDatabase> {
  return client as unknown as SupabaseClient<AgathonDatabase>;
}
