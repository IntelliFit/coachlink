# Mobile Push Operations

CoachLink native push uses Expo device tokens, a PostgreSQL outbox, and a protected drain endpoint. The Web process starts an idempotent in-process drain loop, while production should also run the Kubernetes CronJob as an independent recovery path.

## Required rollout

1. Apply `supabase/migrations/20260908090000_mobile_push_installations.sql`.
2. Put `MOBILE_PUSH_CRON_SECRET` in the selected Web runtime source (Apollo or the single local business env file). Use at least 32 random bytes. `CRON_SECRET` is accepted only as a compatibility fallback.
3. Set `EXPO_PUBLIC_EAS_PROJECT_ID` for Android/iOS builds, or link the app to an EAS project so `Constants.easConfig.projectId` is available.
4. Configure FCM/APNs credentials in the Expo/EAS project. If Expo push access security is enabled, also set the server-only `EXPO_ACCESS_TOKEN`.
5. Deploy `deploy/k8s/mobile-push-cronjob.example.yaml` after replacing its host and Secret reference with the target environment values.

Optional tuning:

```env
MOBILE_PUSH_DRAIN_INTERVAL_MS=15000
```

The processor claims rows with `FOR UPDATE SKIP LOCKED`, so multiple Web replicas and the recovery CronJob can run concurrently. Delivery payloads contain only notification kind and UUID references; message text and Expo tokens are not stored in the outbox or error logs.

## Smoke check

With a valid server secret, the drain endpoint should return a JSON counter object:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MOBILE_PUSH_CRON_SECRET" \
  "https://coachlink.fit/api/internal/mobile-push/drain?limit=10"
```

Verify registration, logout/unregister, foreground badge refresh, background delivery, notification tap navigation, invalid-token disablement, and that test data is removed afterwards.
