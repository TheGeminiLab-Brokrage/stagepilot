-- WhatsApp opt-out support (2026-07-20)
-- A contact who asked to stop receiving messages is permanently excluded from
-- every distribution, refill, export, and re-upload path.
-- Run this in the Supabase SQL editor BEFORE deploying the matching app code.

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false;

-- Speeds up the exclusion filter used by distribution/refill queries
CREATE INDEX IF NOT EXISTS whatsapp_contacts_opted_out_idx
  ON public.whatsapp_contacts (sheet_id)
  WHERE opted_out = true;
