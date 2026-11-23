-- When the paid price was saved, so Budget's "+£X this week" and trend line follow when money was
-- spent rather than when the item arrived. Set by the app whenever actual_price is saved or changed
-- (cleared with it). Older rows stay null and fall back to delivered/installed/added in the app.
-- Safe to run more than once.

alter table public.items add column if not exists price_paid_at timestamptz;
