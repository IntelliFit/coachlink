ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS login_identifier text,
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_login_identifier_unique
ON public.admin_users (login_identifier)
WHERE login_identifier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_is_active
ON public.admin_users (is_active);
