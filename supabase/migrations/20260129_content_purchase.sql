-- =============================================
-- Content purchase (single-article paywall)
-- Created at: 2026-01-29
-- =============================================

-- 1) Add pricing to coach contents
ALTER TABLE public.coach_contents
ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.coach_contents.price_cents IS 'Single purchase price in cents. 0 = free.';

-- 2) Create purchases table (one user buys one content)
CREATE TABLE IF NOT EXISTS public.content_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.coach_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.alipay_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_purchases IS 'Single-content purchase records (paywall unlock).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_content_purchases_user_content
  ON public.content_purchases (user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_content_purchases_user
  ON public.content_purchases (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_purchases_content
  ON public.content_purchases (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_purchases_status
  ON public.content_purchases (status);

-- 3) Keep updated_at fresh (reuse existing trigger function if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'content_purchases_set_updated_at'
    ) THEN
      CREATE TRIGGER content_purchases_set_updated_at
      BEFORE UPDATE ON public.content_purchases
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END $$;

-- 4) RLS
ALTER TABLE public.content_purchases ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own purchase records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_purchases'
      AND policyname = 'Allow authenticated read own content purchases'
  ) THEN
    CREATE POLICY "Allow authenticated read own content purchases"
      ON public.content_purchases
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_purchases'
      AND policyname = 'Allow service role full access to content purchases'
  ) THEN
    CREATE POLICY "Allow service role full access to content purchases"
      ON public.content_purchases
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON public.content_purchases TO authenticated;
GRANT ALL ON public.content_purchases TO service_role;

