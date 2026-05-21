-- =============================================================
-- Sovereign Identity — Stronghold 2.0
-- Adds identity-proofing columns to profiles table
-- =============================================================

-- Signature (stored as base64 data URL)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_data  text,
  ADD COLUMN IF NOT EXISTS signature_at    timestamptz;

-- Domain verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_domain       text,
  ADD COLUMN IF NOT EXISTS domain_verify_token  text,
  ADD COLUMN IF NOT EXISTS domain_verified      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_tag          text;        -- e.g. "GOOGLE SEC"

-- Identity proofing (webcam) — flag only (actual KYC via external provider)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_proofed  boolean NOT NULL DEFAULT false;
