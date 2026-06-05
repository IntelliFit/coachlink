# Runtime Configuration

CoachLink Web uses a strict single-source runtime configuration model. The application can read business configuration from local env files or from Apollo, but it must not merge both.

## Source Selection

The root `.env` file is the bootstrap file. It is intentionally small and must only decide the config source plus the bootstrap fields needed for that source.

```env
CONFIG_SOURCE=local
LOCAL_ENV_FILE=.env.development
```

Valid values:

- `CONFIG_SOURCE=local`: load business config from one local env file.
- `CONFIG_SOURCE=apollo`: fetch all business config from Apollo.

Do not put Supabase keys, payment keys, LLM keys, or other business config in `.env` unless that value is an Apollo bootstrap value. In Apollo mode, local business env files are not loaded.

## Local Mode

In local mode, `LOCAL_ENV_FILE` selects the only business env file to load.

```env
CONFIG_SOURCE=local
LOCAL_ENV_FILE=.env.development
```

If `LOCAL_ENV_FILE` is omitted:

- development uses `.env.development`
- production build/start uses `.env.production`

The old `.env.local` merge pattern is not the project runtime contract anymore. Use one selected local env file so local behavior matches the production/Apollo source-selection model.

## Apollo Mode

In Apollo mode, `.env` contains only Apollo bootstrap settings:

```env
CONFIG_SOURCE=apollo
APOLLO_CONFIG_SERVER_URL=https://apollo-configservice.example.com
APOLLO_APP_ID=coachlink
APOLLO_CLUSTER=local
APOLLO_NAMESPACES=application.env
# APOLLO_ACCESS_KEY_SECRET=
# APOLLO_LABEL=
```

Apollo should store the business config as `.env` / Java-properties style key-value content:

```env
NEXT_SUPABASE_URL=https://...
NEXT_SUPABASE_ANON_KEY=...
NEXT_SUPABASE_SERVICE_ROLE_KEY=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://coachlink.fit
DEEPSEEK_API_KEY=...
```

JSON Apollo responses with a `configurations` object are also supported, but `.env` style content is preferred because the current codebase reads `process.env.KEY` directly.

## Startup Path

All normal Web entry points run through `scripts/config/bootstrap-env.mjs`:

- `npm run dev` -> `scripts/start-dev.mjs`
- `npm run build` -> `scripts/build-prod.js`
- `npm run start` -> `scripts/start-prod.mjs`

The bootstrap sets `__NEXT_PROCESSED_ENV=true` before launching Next.js. This prevents Next.js from auto-loading `.env.development`, `.env.production`, `.env.local`, or `.env` after the selected source has already been applied.

The standalone build copies `scripts/start-prod.mjs` and `scripts/config/` into `.next/standalone/`, and rewrites the standalone `package.json` start script to preserve the same bootstrap behavior after deployment.

## Public Env Caveat

`NEXT_PUBLIC_*` values are compiled into the browser bundle during `next build`. If a public value is managed by Apollo, Apollo must be reachable and contain the correct value before the production build runs. Runtime changes to `NEXT_PUBLIC_*` after build do not update already-built client JavaScript.

Server-only values such as service-role keys, payment secrets, cron secrets, Redis credentials, and LLM keys are read at process startup.

## Adding New Config

When adding a new runtime setting:

1. Add the value to the selected source only: one local env file or Apollo.
2. Read it through `process.env.MY_KEY` in server-side code, matching existing project style.
3. Use `NEXT_PUBLIC_` only for values that are safe to expose to the browser.
4. Do not add a fallback that reads another local env file in Apollo mode.
5. Do not call `dotenv.config()` in Web runtime entry paths. Use `scripts/config/bootstrap-env.mjs`.

Utility or one-off scripts may still load env files explicitly, but that does not change the Web runtime contract.
