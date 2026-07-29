# Motion Effects Worker

Production uses the files in `main/` plus an untracked `main/.env.worker`.
Copy the existing Power Analysis worker environment as a starting point, then
change only:

- `TASK_QUEUE_TOPIC=coachlink-motion-effects-tasks-main`
- `TASK_QUEUE_CONSUMER_GROUP=coachlink-motion-effects-workers-main`
- `TASK_QUEUE_CLIENT_ID=coachlink-motion-effects-worker-main`

The worker has its own deployment, Kafka topic, database table, and hourly
cleanup job. It must not consume the Power Analysis topic.
