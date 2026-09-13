-- Native mobile push registrations are intentionally separate from Web Push
-- subscriptions because Expo tokens do not use endpoint/p256dh/auth fields.

CREATE TABLE IF NOT EXISTS public.mobile_push_installations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    installation_id text NOT NULL,
    provider text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo')),
    push_token text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('android', 'ios')),
    permission_status text NOT NULL DEFAULT 'granted',
    app_version text,
    locale text,
    timezone text,
    device_model text,
    enabled boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    invalidated_at timestamptz,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, push_token),
    UNIQUE (provider, installation_id)
);

CREATE INDEX IF NOT EXISTS mobile_push_installations_user_enabled_idx
    ON public.mobile_push_installations (user_id, enabled)
    WHERE enabled = true;

ALTER TABLE public.mobile_push_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mobile_push_installations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mobile_push_installations TO service_role;

CREATE TABLE IF NOT EXISTS public.mobile_notification_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    dedupe_key text NOT NULL UNIQUE,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'receipt_pending', 'sent', 'retry', 'failed')),
    delivery_stage text NOT NULL DEFAULT 'send'
        CHECK (delivery_stage IN ('send', 'receipt')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    receipt_attempt_count integer NOT NULL DEFAULT 0 CHECK (receipt_attempt_count >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    -- NULL means the first send has not snapshotted the recipient's devices yet.
    -- Retries contain only device rows that have not accepted a ticket, avoiding
    -- duplicate delivery to devices that already succeeded in a partial batch.
    target_installation_ids uuid[],
    -- Array of { ticketId, installationId }. Push tokens are never persisted in
    -- the outbox or error columns.
    expo_ticket_map jsonb NOT NULL DEFAULT '[]'::jsonb,
    delivered_count integer NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
    expo_ticket_id text,
    last_error text,
    lock_token uuid,
    locked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_notification_outbox_pending_idx
    ON public.mobile_notification_outbox (next_attempt_at, created_at)
    WHERE status IN ('pending', 'retry', 'receipt_pending');

CREATE INDEX IF NOT EXISTS mobile_notification_outbox_stale_processing_idx
    ON public.mobile_notification_outbox (locked_at)
    WHERE status = 'processing';

ALTER TABLE public.mobile_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mobile_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mobile_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.touch_mobile_push_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_mobile_push_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS touch_mobile_push_installations_updated_at ON public.mobile_push_installations;
CREATE TRIGGER touch_mobile_push_installations_updated_at
BEFORE UPDATE ON public.mobile_push_installations
FOR EACH ROW EXECUTE FUNCTION public.touch_mobile_push_updated_at();

DROP TRIGGER IF EXISTS touch_mobile_notification_outbox_updated_at ON public.mobile_notification_outbox;
CREATE TRIGGER touch_mobile_notification_outbox_updated_at
BEFORE UPDATE ON public.mobile_notification_outbox
FOR EACH ROW EXECUTE FUNCTION public.touch_mobile_push_updated_at();

-- Registration has two uniqueness domains (installation and provider token).
-- A plain PostgREST UPSERT can only target one of them and races or fails when a
-- token is reissued after reinstall. This service-role-only function serializes
-- the tiny registration critical section and atomically merges both identities.
CREATE OR REPLACE FUNCTION public.register_mobile_push_installation(
    p_user_id uuid,
    p_installation_id text,
    p_push_token text,
    p_platform text,
    p_permission_status text DEFAULT 'granted',
    p_app_version text DEFAULT NULL,
    p_locale text DEFAULT NULL,
    p_timezone text DEFAULT NULL,
    p_device_model text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    registration_id uuid;
BEGIN
    IF p_user_id IS NULL
       OR p_installation_id IS NULL
       OR p_installation_id !~ '^[A-Za-z0-9._:-]{12,200}$'
       OR p_push_token IS NULL
       OR p_push_token !~ '^(ExpoPushToken|ExponentPushToken)\[[^]]{8,512}\]$'
       OR p_platform NOT IN ('android', 'ios') THEN
        RAISE EXCEPTION 'invalid mobile push registration';
    END IF;

    -- Registrations are infrequent; one transaction-scoped lock avoids a
    -- two-unique-key race without leaving application-visible lock rows.
    PERFORM pg_advisory_xact_lock(hashtextextended('coachlink-mobile-push-registration', 0));

    SELECT installation.id
    INTO registration_id
    FROM public.mobile_push_installations AS installation
    WHERE installation.provider = 'expo'
      AND (
          installation.installation_id = p_installation_id
          OR installation.push_token = p_push_token
      )
    ORDER BY (installation.installation_id = p_installation_id) DESC,
             installation.created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF registration_id IS NULL THEN
        INSERT INTO public.mobile_push_installations (
            user_id,
            installation_id,
            provider,
            push_token,
            platform,
            permission_status,
            app_version,
            locale,
            timezone,
            device_model,
            enabled,
            last_seen_at
        ) VALUES (
            p_user_id,
            p_installation_id,
            'expo',
            p_push_token,
            p_platform,
            COALESCE(NULLIF(p_permission_status, ''), 'granted'),
            p_app_version,
            p_locale,
            p_timezone,
            p_device_model,
            true,
            clock_timestamp()
        )
        RETURNING id INTO registration_id;
    ELSE
        -- The same token and installation can temporarily live on two rows
        -- after a reinstall. Keep the stable installation row and remove only
        -- the other conflicting row inside the same transaction.
        DELETE FROM public.mobile_push_installations AS installation
        WHERE installation.provider = 'expo'
          AND installation.id <> registration_id
          AND (
              installation.installation_id = p_installation_id
              OR installation.push_token = p_push_token
          );

        UPDATE public.mobile_push_installations AS installation
        SET user_id = p_user_id,
            installation_id = p_installation_id,
            push_token = p_push_token,
            platform = p_platform,
            permission_status = COALESCE(NULLIF(p_permission_status, ''), 'granted'),
            app_version = p_app_version,
            locale = p_locale,
            timezone = p_timezone,
            device_model = p_device_model,
            enabled = true,
            invalidated_at = NULL,
            last_error_code = NULL,
            last_seen_at = clock_timestamp()
        WHERE installation.id = registration_id;
    END IF;

    RETURN registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_mobile_push_installation(
    uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_mobile_push_installation(
    uuid, text, text, text, text, text, text, text, text
) TO service_role;

-- Claim rows in the database, not with a client-side SELECT-then-UPDATE loop.
-- SKIP LOCKED permits multiple workers; lock_token fences stale workers, and a
-- lease makes rows recoverable after a worker process crashes.
CREATE OR REPLACE FUNCTION public.claim_mobile_notification_outbox(
    p_limit integer DEFAULT 50,
    p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.mobile_notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT candidate.id
        FROM public.mobile_notification_outbox AS candidate
        WHERE (
            candidate.status IN ('pending', 'retry', 'receipt_pending')
            AND candidate.next_attempt_at <= clock_timestamp()
        ) OR (
            candidate.status = 'processing'
            AND candidate.locked_at <= clock_timestamp()
                - make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 3600))
        )
        ORDER BY candidate.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    )
    UPDATE public.mobile_notification_outbox AS claimed
    SET status = 'processing',
        attempt_count = CASE
            WHEN claimed.delivery_stage = 'send' THEN claimed.attempt_count + 1
            ELSE claimed.attempt_count
        END,
        lock_token = gen_random_uuid(),
        locked_at = clock_timestamp()
    FROM candidates
    WHERE claimed.id = candidates.id
    RETURNING claimed.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mobile_notification_outbox(integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_notification_outbox(integer, integer)
    TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_chat_mobile_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    recipient_id uuid;
BEGIN
    FOR recipient_id IN
        SELECT DISTINCT member.member_id
        FROM public.chat_rooms AS room
        CROSS JOIN LATERAL unnest(COALESCE(room.members, ARRAY[]::uuid[])) AS member(member_id)
        INNER JOIN public.users AS recipient ON recipient.id = member.member_id
        WHERE room.id = NEW.room_id
          AND member.member_id <> NEW.sender_id
          AND EXISTS (
              SELECT 1
              FROM public.mobile_push_installations AS installation
              WHERE installation.user_id = member.member_id
                AND installation.enabled = true
          )
    LOOP
        INSERT INTO public.mobile_notification_outbox (
            recipient_user_id,
            kind,
            dedupe_key,
            payload
        ) VALUES (
            recipient_id,
            'chat_message',
            'chat:' || NEW.id::text || ':' || recipient_id::text,
            jsonb_build_object(
                'kind', 'chat_message',
                'roomId', NEW.room_id,
                'messageId', NEW.id
            )
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_chat_mobile_notifications() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_chat_mobile_notifications ON public.chat_messages;
CREATE TRIGGER enqueue_chat_mobile_notifications
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enqueue_chat_mobile_notifications();
