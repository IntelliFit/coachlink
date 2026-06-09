# Power Analysis Worker Queue

Power Analysis uses a queue-backed worker so video analysis does not run inside normal Next.js requests.

## Runtime Roles

- Web/API creates upload jobs, receives direct-to-storage upload completion, and publishes a queue message.
- The queue carries only `{ taskId, taskType }`.
- `tool_power_analysis_jobs` remains the source of truth for status, ownership, metrics, storage paths, and expiry.
- Worker consumes queue messages, claims the matching queued DB row, downloads the input video, runs Python analysis, uploads output, and writes a terminal DB state before acknowledging the queue message.

## Local Memory Queue

Use this in the selected local business env file, for example `.env.development`.

```env
TASK_QUEUE_DRIVER=memory
TASK_QUEUE_BUFFER_SIZE=1024
TASK_QUEUE_TOPIC=coachlink-power-analysis-tasks
TASK_QUEUE_CONSUMER_GROUP=coachlink-power-workers-local
TASK_QUEUE_CLIENT_ID=coachlink-power-worker-local
POWER_ANALYSIS_RECOVER_INTERVAL_MS=60000
POWER_ANALYSIS_RECOVER_BATCH_SIZE=50
```

Memory mode is process-local and intended for local development. When Web runs with `TASK_QUEUE_DRIVER=memory`, the enqueue API lazily starts an embedded in-process worker, so `npm run dev` is enough for the local happy path. The embedded worker also periodically republishes `queued` DB rows into memory so local development survives restarts and missed in-process messages.

## Kafka Queue

Use these keys in Apollo for dev/main, or in the selected local env file when testing Kafka locally.

```env
TASK_QUEUE_DRIVER=kafka
TASK_QUEUE_BROKERS=kafka-0.kafka:9092,kafka-1.kafka:9092,kafka-2.kafka:9092
TASK_QUEUE_TOPIC=coachlink-power-analysis-tasks
TASK_QUEUE_CONSUMER_GROUP=coachlink-power-workers
TASK_QUEUE_CLIENT_ID=coachlink-power-worker
POWER_ANALYSIS_RECOVER_INTERVAL_MS=60000
POWER_ANALYSIS_RECOVER_BATCH_SIZE=50
```

Kafka topic must exist before the worker starts. In Kafka mode, Web only publishes messages; it does not start an embedded worker. The Kubernetes worker Deployment consumes Kafka messages and commits offsets only after the DB task is claimed and processed into a terminal state. The Kafka worker does not do periodic DB polling/recovery by default.

## Commands

```bash
npm run power-analysis:worker      # queue consumer, production/default
npm run power-analysis:poll-worker # legacy DB polling fallback
npm run power-analysis:work-once   # process one queued DB job without queue
npm run power-analysis:cleanup     # expire and remove old input/output files
npm run push-power-worker-ccr      # build and push worker image
```

For local video-analysis execution, install Python dependencies in an environment whose `mediapipe` package still exposes the legacy `mediapipe.solutions.pose` API used by `scripts/power-analysis/analyze_video.py`.

```bash
npm run power-analysis:setup
.venv-power-analysis\Scripts\python.exe -c "import mediapipe as mp; print(mp.__version__, hasattr(mp, 'solutions'))"
```

The second command must print `True`. The setup command uses `uv` to create `.venv-power-analysis` with Python 3.11 and install `scripts/power-analysis/requirements.txt`. The worker automatically prefers this venv's Python unless `POWER_ANALYSIS_PYTHON_BIN` is explicitly set. The worker Docker image uses the container Python environment and installs the same requirements during image build.

## Worker Image

Image repository:

```text
ccr.ccs.tencentyun.com/littlehorse/coachlink-power-worker
```

Tags:

- `dev` branch: `:dev` and `:<short-sha>`
- `main` branch: `:latest`, `:main`, and `:<short-sha>`

The worker image entrypoint is:

```bash
node scripts/power-analysis-worker.mjs --queue
```

The cleanup CronJob entrypoint is:

```bash
node scripts/power-analysis-worker.mjs --cleanup
```

Both entrypoints load root `.env` first. In production, mount the same Apollo bootstrap `.env` used by Web at `/app/.env`; the worker then fetches the full business config through `scripts/config/bootstrap-env.mjs`.

## Required Runtime Config

The worker needs the same server-side config as the API:

```env
CONFIG_SOURCE=apollo
APOLLO_CONFIG_SERVER_URL=...
APOLLO_APP_ID=coachlink
APOLLO_CLUSTER=main
APOLLO_NAMESPACES=application.env
APOLLO_ACCESS_KEY_SECRET=...

NEXT_SUPABASE_URL=...
NEXT_SUPABASE_SERVICE_ROLE_KEY=...

TASK_QUEUE_DRIVER=kafka
TASK_QUEUE_BROKERS=...
TASK_QUEUE_TOPIC=coachlink-power-analysis-tasks
TASK_QUEUE_CONSUMER_GROUP=coachlink-power-workers
```

`NEXT_SUPABASE_SERVICE_ROLE_KEY` is required because the worker updates jobs and reads/writes transient storage artifacts.
