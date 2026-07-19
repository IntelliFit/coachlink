# 功率分析器代码与基础设施修复交接

## 已在 CoachLink 代码中处理

1. 微信小程序仍通过 `coachlink.fit` 上传，不新增对象存储合法域名依赖。
2. Next 上传接口使用 Busboy 解析 multipart，并把文件流直接交给 Supabase Storage，不再调用 `req.formData()` / `file.arrayBuffer()` 缓冲整段视频。
3. Worker 下载输入和上传输出均改为流式传输，避免大文件在 Node 进程内完整读入内存。
4. OpenCV 只生成带分析标记的临时画面；最终文件由 FFmpeg 编码为 H.264，并把输入音频转为 AAC 后合并。
5. 分析器会校验音轨：原视频有音频而输出无音频时任务直接失败，不再交付静音文件。
6. 小程序对 Nginx/网关返回的 HTTP 413 提供明确提示，不再显示“上传响应解析失败”。
7. Next 下载兜底接口改为对象存储到客户端的流式响应；Web 仍优先使用 signed URL。

## 服务器与发布处理

代码无法绕过位于 Next 之前的 Nginx 请求体限制。生产 Nginx 已于 2026-07-14 完成以下调整，本节保留为配置记录和回滚依据。

建议在 `coachlink.fit` 的 HTTPS `server` 中、现有 `location /` 之前增加专用 location：

```nginx
location ^~ /api/toolbox/power-analysis/ {
    # 应大于 POWER_ANALYSIS_MAX_VIDEO_MB，并为 multipart 边界预留空间。
    # 当前应用默认 100MB，因此建议 110MB；如 Apollo 调大，需同步调整。
    client_max_body_size 110m;

    # 让上传流直接进入 Next，不先完整落到 Nginx 临时文件。
    proxy_request_buffering off;

    # 下载兜底接口也是流式响应。
    proxy_buffering off;

    proxy_connect_timeout 60s;
    proxy_send_timeout 360s;
    proxy_read_timeout 360s;

    proxy_pass http://127.0.0.1:30010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
}
```

应用配置后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

然后验证：

1. 未登录的 2MB POST 应到达应用并返回 JSON 401，不能再由 Nginx 返回 HTML 413。
2. 登录小程序上传 10MB、50MB、接近上限的视频，观察 Pod 内存不能随文件大小近似翻倍。
3. Supabase `videos` bucket 的 `file_size_limit` 必须不低于输入上限和预期输出上限，建议至少 200MB。

## 构建和部署

Web/API 镜像需要重新构建并部署，包含流式上传/下载代码和 `busboy` 依赖。

Power Worker 镜像也必须重新构建并部署。`Dockerfile.power-worker` 已安装 `ffmpeg`，部署后先验证：

```bash
ffmpeg -version
ffprobe -version
```

可选 Apollo 调优项（代码已有默认值，不设置也可运行）：

```env
POWER_ANALYSIS_VIDEO_CRF=23
POWER_ANALYSIS_VIDEO_PRESET=medium
POWER_ANALYSIS_AUDIO_BITRATE_KBPS=128
# 下载视频默认不大于原始上传文件且不超过 50MB；按需可进一步收紧。
POWER_ANALYSIS_OUTPUT_MAX_MB=50
POWER_ANALYSIS_OUTPUT_MAX_RATIO_PERCENT=100
```

### 生产环境现状（2026-07-14 只读核验）

- 服务器：`ubuntu@154.8.205.78`，主机名 `VM-24-14-ubuntu`。
- 部署仓库：`/home/ubuntu/littlehorse-deployment`。
- Web Deployment：`coachlink-main`，3 个副本，镜像 `ccr.ccs.tencentyun.com/littlehorse/coachlink:latest`。
- Worker Deployment：`coachlink-power-worker-main`，1 个副本，镜像 `ccr.ccs.tencentyun.com/littlehorse/coachlink-power-worker:latest`。
- Keel 正常运行并轮询同标签新镜像；两个 Deployment 均为 `imagePullPolicy: Always`。
- 当前 Worker 容器内没有可用的 `ffmpeg` / `ffprobe`，必须部署新 Worker 镜像。
- `ubuntu` 用户可免密 sudo；Nginx 配置是 `/etc/nginx/conf.d/coachlink.conf`。

### 发布前门禁

必须从已经提交且工作树干净的 `main` 分支构建。不要从混有其他未提交改动的目录直接推生产镜像，否则 `latest` 会包含无法追踪的内容，而 SHA 标签仍指向旧提交。

```powershell
cd D:\files\coachlink
git status --short
git branch --show-current
npm run lint
npm run typecheck
npm test
npm run test:e2e
npx next build
```

任何一步失败都先停止发布。本次修复所在工作区当前仍有其他未提交修改，且 Next build 被 `src/app/api/plan-lib/extract-file-text/route.ts:123` 的无关语法错误阻断，因此暂时不能安全推生产镜像。

### 在本机构建并推送两套镜像

本机需要启动 Docker Desktop，并提前登录腾讯云 CCR：

```powershell
docker version
docker login ccr.ccs.tencentyun.com

cd D:\files\coachlink
npm run push-docker-ccr
npm run push-power-worker-ccr
```

仓库脚本会在 `main` 分支推送以下标签：

- Web：`coachlink:latest`、`coachlink:main`、`coachlink:<7位提交SHA>`。
- Worker：`coachlink-power-worker:latest`、`coachlink-power-worker:main`、`coachlink-power-worker:<7位提交SHA>`。

### Keel 自动更新与生产观察

镜像推送是人工触发；推送完成后，Web 与 Worker Deployment 的 Keel 注解会每分钟检查同标签的新 digest，并自动执行滚动更新。正常发布不需要 `kubectl apply -k`，也不需要手动 `kubectl rollout restart`。

```bash
ssh ubuntu@154.8.205.78

kubectl get pods -l app=coachlink-main -w
kubectl get pods -l app=coachlink-power-worker-main -w
kubectl -n keel logs deployment/keel --since=10m
kubectl rollout status deployment/coachlink-main --timeout=10m
kubectl rollout status deployment/coachlink-power-worker-main --timeout=10m
kubectl logs deployment/coachlink-power-worker-main --since=10m
kubectl exec deployment/coachlink-power-worker-main -- ffmpeg -version
kubectl exec deployment/coachlink-power-worker-main -- ffprobe -version
```

只有镜像已成功推送、等待 2～3 分钟后 Keel 仍没有更新时，才使用以下兜底：

```bash
kubectl rollout restart deployment/coachlink-main
kubectl rollout restart deployment/coachlink-power-worker-main
```

`kubectl apply -k coachlink/main` / `kubectl apply -k coachlink-power-worker/main` 仅用于首次安装，或 Deployment、Service、Secret、CronJob 等 YAML 发生变化；纯镜像内容更新不需要 apply。Worker 的每小时清理 CronJob 没有 Keel 注解，但使用 `:latest` 和 `imagePullPolicy: Always`，下一次新 Job 会自动拉取最新 Worker 镜像。

如自动 rollout 失败，先查看 `kubectl describe pod <pod名>` 与容器日志，不要继续调整 Nginx 或发布小程序。

### 修改生产 Nginx

流式 Web/API 已部署并验证健康后再放开 Nginx 大文件入口，避免旧版 `formData()` 代码在短暂窗口内接收大文件并推高内存。

```bash
ssh ubuntu@154.8.205.78
sudo cp /etc/nginx/conf.d/coachlink.conf /etc/nginx/conf.d/coachlink.conf.bak-$(date +%Y%m%d-%H%M%S)
sudoedit /etc/nginx/conf.d/coachlink.conf
```

把前文的专用 `location ^~ /api/toolbox/power-analysis/` 放入 `server_name coachlink.fit;` 对应的 HTTPS `server`，且位于通用 `location /` 之前。保存后：

```bash
sudo nginx -t
sudo systemctl reload nginx
systemctl is-active nginx
```

若 `nginx -t` 失败，不要 reload；按报错修正或把最新备份复制回去。

Nginx 不受 Keel/Kubernetes 管理，必须人工修改并 reload。为了让修改可追踪，还应同步更新实际 Git 仓库 `/home/ubuntu/littlehorse-deployment/coachlink/coachlink.conf` 并提交；仅修改 `/etc/nginx/conf.d/coachlink.conf` 会生效，但未来重新复制仓库配置时可能被覆盖。Windows 下的 `D:\files\littlehorse-deployment-main` 是无 `.git` 的源码快照，不会自动同步到 GitHub 或服务器。

本次实际执行结果：

- 生效配置：`/etc/nginx/conf.d/coachlink.conf`。
- 备份：`/etc/nginx/conf.d/coachlink.conf.bak-20260714-054144`。
- 服务器部署仓库和 Windows 快照已同步同一配置；服务器仓库文件尚未提交。
- `nginx -t` 通过，reload 后服务为 `active`。
- 线上 2MB multipart 探针返回应用层 JSON 401，不再被 Nginx 以 HTML 413 拦截。

### 调整 Supabase Storage

Supabase 有两层限制，必须同时满足：

1. Dashboard 的 Storage Settings 全局文件上限至少 200MB。
2. `videos` bucket 的 per-bucket 上限至少 200MB。

可在 Supabase Dashboard 的 SQL Editor 先查询并只修改大小字段，避免覆盖 bucket 的 public/MIME 配置：

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'videos';

update storage.buckets
set file_size_limit = 209715200
where id = 'videos';
```

更新后重新执行 `select` 确认。全局限制优先于 bucket 限制；如果项目套餐不允许 200MB，需要升级套餐或把应用输入上限同步降低，不能只改数据库字段。

### 发布微信小程序

仓库提供分阶段发布命令。首次使用前，在 `apps/wechat/` 下按示例准备两个不会提交 Git 的本地文件：

```powershell
Copy-Item apps\wechat\.env.weapp-release.example apps\wechat\.env.weapp-release.local
Copy-Item apps\wechat\release.weapp.example.json apps\wechat\release.weapp.json
```

填写微信公众平台上传私钥路径、AppSecret 和真实审核类目后，按阶段执行：

```powershell
cd D:\files\coachlink
npm run weapp:release:upload -- --version 2026.07.14.1 --desc "修复功率分析视频上传、下载和音频"
npm run weapp:release:audit
npm run weapp:release:status
# 审核通过后才执行：
npm run weapp:release:publish
```

当前本机尚不存在 `.env.weapp-release.local` 和 `release.weapp.json`，因此发布命令现在还不能直接运行。

### 自动与手动边界

| 环节 | 触发方式 | 是否自动 |
|---|---|---|
| Git push 后测试 | GitHub Actions | 自动触发，但当前单测/E2E失败不会严格阻断镜像发布 |
| Web 镜像构建与推送 | `npm run push-docker-ccr` | 需要人工执行；脚本内部自动 build/tag/push |
| Worker 镜像构建与推送 | `npm run push-power-worker-ccr` | 需要人工执行；脚本内部自动 build/tag/push |
| Web/Worker Deployment 更新 | Keel 每分钟检查 `latest` digest | 自动滚动更新 |
| Apollo 业务配置变更 | Web Pod 内 `apollo-reloader` 长轮询 | 自动错峰删除 Pod 并重新加载 |
| Worker `.env.worker` 变更 | `kubectl apply -k` 后重启 Worker | 人工；Worker 不接 Apollo |
| Worker 过期文件清理 | Kubernetes CronJob 每小时 | 自动 |
| Nginx 配置 | 修改配置、`nginx -t`、reload | 人工 |
| Supabase 全局/bucket 上限 | Dashboard 或 SQL | 人工 |
| 微信小程序上传、审核、发布 | 仓库 release 命令 | 人工触发；命令内部可自动执行阶段流程 |
| 飞书集群通知 | systemd notifier | 自动通知，不负责部署 |

建议发布顺序：干净提交并通过全部门禁 → 人工推 Web/API 镜像 → 人工推 Worker 镜像 → Keel 自动更新 → 确认 Worker 有 FFmpeg → 人工调整 Supabase → 人工修改 Nginx → 生产接口验收 → 人工触发小程序上传/审核/发布。

## 上线验收

至少准备四类真实手机视频：有声 MP4、无声 MP4、iPhone MOV、接近上传上限的视频。

每条都检查：

1. 小程序上传和开始分析成功。
2. Web 与小程序均可下载/保存。
3. `ffprobe` 确认有声输入的输出同时存在 H.264 视频流和 AAC 音频流。
4. 输出体积不再出现 OpenCV `mp4v` 导致的数倍膨胀。
5. 中止一次下载后，不刷新页面即可上传并分析下一条视频。

## 本地代码验证结果

- `npm run lint`：通过（仓库当前为提示性脚本）。
- `npm run typecheck`：通过。
- `npm test`：通过，35 个测试文件、177 条用例。
- `npm --workspace apps/wechat run build:weapp`：通过，2754 个模块完成编译，微信产物修正脚本全部执行完成。
- 有声样例：H.264+AAC 输入约 1.73MB，最终 H.264+AAC 输出约 1.59MB，音轨保留。
- 无声样例：正常生成 H.264-only 输出，不会因原视频没有音轨而误报失败。
- `npx next build`：被本次任务范围外、工作区已有的 `src/app/api/plan-lib/extract-file-text/route.ts:123` 语法错误阻断；功率分析相关代码的 TypeScript 类型检查已通过。
- 小程序自动化：本机 `mrc` 已安装，但微信开发者工具 9420 自动化端口没有监听，未完成页面点击/真机上传验证。
