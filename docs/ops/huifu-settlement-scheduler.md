# 汇付教练收入自动结算

教练订阅付款成功后，平台先保留 7 天退款保护期。到期后必须将订单从
`coach_subscription_settlements.pending` 发起汇付分账；汇付返回处理中时，再通过对账将成功分账记入教练钱包。

## 生产配置

生产运行时使用 Apollo，因此在 `coachlink / local / app-config` 增加仅服务端使用的随机密钥：

```env
HUIFU_SETTLEMENT_CRON_SECRET=<至少 32 字节的随机值>
```

不要使用 `NEXT_PUBLIC_` 前缀，也不要把该值写回根目录 `.env`。更新 Apollo 后，重启 Web Deployment，使 `instrumentation.ts` 的进程内兜底任务读取到新配置。

同时，在部署仓库创建 Kubernetes Secret，并把**同一个值**注入 CronJob：

```bash
kubectl -n coachlink create secret generic coachlink-runtime-secrets \
  --from-literal=HUIFU_SETTLEMENT_CRON_SECRET='<same-random-value>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

将 [`deploy/k8s/huifu-settlement-cronjob.example.yaml`](../../deploy/k8s/huifu-settlement-cronjob.example.yaml) 复制到部署仓库，按实际 namespace、域名和 Secret 名称替换后应用。两个 CronJob 每 10 分钟分别执行：

- `process-due`：对所有到期 `pending` / `split_failed` 结算发起汇付分账。
- `reconcile`：查询汇付仍在 `processing` 的分账结果；确认成功后写入钱包。

`concurrencyPolicy: Forbid` 防止同一类任务重叠；业务侧也会以结算记录状态作为幂等锁，因此应用内兜底与 CronJob 同时运行不会重复分账。

## 验收与排障

部署后检查：

```bash
kubectl -n coachlink get cronjob
kubectl -n coachlink get jobs --sort-by=.metadata.creationTimestamp
kubectl -n coachlink logs job/<latest-process-due-job>
```

成功时，`pending` 到期记录的 `attempts` 会大于 0，并进入 `split_success`、`processing` 或 `wallet_credited`。若 CronJob 密钥、域名或接口异常，`curl --fail` 会使 Job 失败；应用内兜底调用也会在 Web Pod 日志中记录非 2xx 状态，避免再出现“界面一直待结算、尝试次数却是 0”的静默故障。

首次补偿应先确认待结算名单和总额，再调用 `process-due`；该接口会发起真实资金分账。
