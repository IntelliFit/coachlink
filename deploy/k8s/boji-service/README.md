# 薄肌检测器服务（boji-service）

`/toolbox/boji` 和小程序工具页调用的 Python 服务，代码是开源的 [boji-detector](https://github.com/SmallHorseBrother/boji-detector)，版本固定在 `deploy/boji-service/Dockerfile` 的 `BOJI_DETECTOR_REF`。

- 同步接口：`POST /v1/analyze`（请求体是照片本身），单张约 0.3–0.5 秒；`GET /healthz` 供探针使用。
- 无状态：不连数据库、不用 Kafka、不存照片，照片只在内存里处理。
- 只在集群内可见（ClusterIP `coachlink-boji-service-main:8000`），不配 Ingress。Web 默认就请求这个地址；不在同一命名空间时，在 Web 配置里设 `BOJI_SERVICE_URL`。
- 可选：在 Web 和本服务两边都设同一个 `BOJI_SERVICE_TOKEN`，服务就只接受带 `X-Boji-Token` 的请求。

## 发布

1. 在 `main` 上推镜像：`npm run push-boji-service-ccr`（镜像 `ccr.ccs.tencentyun.com/littlehorse/coachlink-boji-service`）。
2. 首次安装，或本目录 YAML 有改动时：`kubectl apply -k deploy/k8s/boji-service/main`。
3. 之后只推镜像即可，Keel 每分钟检查 `:latest` 并滚动更新。

检查：

```bash
kubectl get pods -l app=coachlink-boji-service-main
kubectl run boji-check --rm -it --image=curlimages/curl --restart=Never -- curl -s http://coachlink-boji-service-main:8000/healthz
```

## Web 侧配置（可选，均有默认值）

| 变量 | 默认 | 说明 |
|---|---|---|
| `BOJI_SERVICE_URL` | 生产 `http://coachlink-boji-service-main:8000`，本地 `http://127.0.0.1:8765` | 服务地址 |
| `BOJI_SERVICE_TOKEN` | 空 | 与服务端一致时启用校验 |
| `BOJI_HOURLY_LIMIT` | 30 | 每人每小时检测次数（Redis 计数，连不上时退回进程内计数） |
| `BOJI_MAX_UPLOAD_MB` | 8 | 单张照片上限 |
| `BOJI_TIMEOUT_MS` | 20000 | 调用服务超时 |
