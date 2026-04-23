-- Coach content columns
-- Adds named columns/series for coach articles while keeping loose articles.

CREATE TABLE IF NOT EXISTS public.coach_content_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_url text,
  slug text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_content_columns_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_content_columns_coach_slug
  ON public.coach_content_columns (coach_id, slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_content_columns_coach
  ON public.coach_content_columns (coach_id, sort_order, created_at DESC);

ALTER TABLE public.coach_contents
  ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES public.coach_content_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS column_sort_order integer;

CREATE INDEX IF NOT EXISTS idx_coach_contents_column
  ON public.coach_contents (column_id, column_sort_order, created_at DESC)
  WHERE column_id IS NOT NULL;

COMMENT ON TABLE public.coach_content_columns IS 'Named article columns/series owned by coaches.';
COMMENT ON COLUMN public.coach_contents.column_id IS 'Nullable column/series id. NULL means loose article.';
COMMENT ON COLUMN public.coach_contents.column_sort_order IS 'Optional ordering inside the assigned coach content column.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'coach_content_columns_set_updated_at'
    ) THEN
      CREATE TRIGGER coach_content_columns_set_updated_at
      BEFORE UPDATE ON public.coach_content_columns
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END $$;

ALTER TABLE public.coach_content_columns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coach_content_columns'
      AND policyname = 'Anyone can view visible coach content columns'
  ) THEN
    CREATE POLICY "Anyone can view visible coach content columns"
      ON public.coach_content_columns
      FOR SELECT
      TO anon, authenticated
      USING (
        is_visible = true
        AND EXISTS (
          SELECT 1
          FROM public.coaches
          WHERE coaches.id = coach_content_columns.coach_id
            AND coaches.status = 'approved'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coach_content_columns'
      AND policyname = 'Coaches can manage own content columns'
  ) THEN
    CREATE POLICY "Coaches can manage own content columns"
      ON public.coach_content_columns
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.coaches
          WHERE coaches.id = coach_content_columns.coach_id
            AND coaches.user_id::text = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.coaches
          WHERE coaches.id = coach_content_columns.coach_id
            AND coaches.user_id::text = auth.uid()::text
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coach_content_columns'
      AND policyname = 'Service role can manage content columns'
  ) THEN
    CREATE POLICY "Service role can manage content columns"
      ON public.coach_content_columns
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON public.coach_content_columns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_content_columns TO authenticated;
GRANT ALL ON public.coach_content_columns TO service_role;
