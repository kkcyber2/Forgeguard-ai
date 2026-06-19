-- War Machine upsert requires UNIQUE(website_url) for PostgREST on_conflict
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_website_url_unique;

DROP INDEX IF EXISTS public.leads_website_url_key;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_website_url_unique UNIQUE (website_url);
