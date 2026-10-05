# 教练 AI 修改学员计划：network error 诊断

日期：2026-10-06；用户时间口径 Asia/Tokyo。工作目录 `D:/files/coachlink`。

用户询问截图中的中断属于个人网络问题还是软件 bug。本轮范围是只读诊断，未将截图中的“继续啊”视为代理继续修改训练数据的指令。

## 后续修复：已本地实现并验证

用户随后明确要求“所以怎么修复啊 改啊”，已实施修复。当前状态为本地完成，尚未提交、推送、部署或修改正式 Nginx；正式站仍运行旧版本，不能宣称线上故障已经解决。

- 新增 `src/lib/planEditSse.ts`：立即发送连接注释，模型等待期间每 15 秒发送心跳；关闭时清理定时器/请求监听器，取消时中止本轮工作，安全处理已关闭 controller；响应带 `X-Accel-Buffering: no` 和 `no-cache, no-transform`。
- `batch-operation/route.ts` 接入该流，所有 OpenAI 调用携带取消 signal，分段编译/补丁/旧代码引擎的重试在取消后停止；万界 Anthropic fallback 合并请求取消 signal 与原有超时 signal。没有更改训练计划生成内容、模型选择或持久化规则。
- 前端两种调用模式共用完整性检查：只有预览结果、查询结果、澄清问题或仅预览输入模式的输入快照，才视为正常完成。正常 EOF 但没有结果也报告中断；已收到结果后断连保留结果，服务端错误只报一次。连接中断提示重新提交原修改要求，HTTP 代理错误页不再原样显示。
- 部署候选 `deploy/nginx/plan-ai-sse.location.conf.example` 为该单一路径关闭 buffering/cache/gzip，设置读取间隔 180s；正式 NodePort 30010，dev 使用 30011。已在服务器临时配置中通过 `nginx -t`，未写现行配置或 reload。

验证结果：

- `npm run lint` 退出 0（脚本明确提示未配置 ESLint）；`npm run typecheck` 通过。
- 额外把实际修改的 API/服务/LLM/流模块纳入类型检查，与 Git HEAD 源码进行虚拟文件基线对比：历史 4 个错误、当前 4 个、新增 0。历史错误涉及 context 默认字段、Supabase 深层类型及 create-template question 类型；未修改这些无关代码。证据 `typecheck-comparison.json`。
- `npx next build` 编译成功，547 页生成完成；构建按现有配置跳过完整类型验证，不把 build 当类型检查的替代。
- `npm test` 78 文件、520 项通过，包含本次新增 13 项生命周期/取消/碎片 UTF-8/完整结果/业务错误回归；未修改既有测试文件。测试没有真实数据库写入。
- 真正运行 `BatchOperationDialog`、前端服务及新服务端流模块的隔离浏览器验证：模拟模型 65 秒等待，在模拟 60 秒空闲代理下收到 4 次心跳，最大数据间隔 15014ms，完整预览到达并实际点击“确认应用”成功；中途 EOF 显示可读中断提示且没有可应用结果。页面异常 0，模型与历史接口为受控模拟，真实数据库写入 0。
- 原要求的 `web-devtools` skill 在项目及本机技能目录未找到，已用现有 Playwright 浏览器工具完成上述替代验证。初次 harness 默认导入错误已修正，未修改业务组件；截图待动画完成后再次验证了错误显示。最终两张 PNG 已查看。
- 临时浏览器与本地验证服务器已关闭；`port-manager` 验证服务分配已释放。远程语法检查临时目录已清理。

本地验证证据位于 `artifacts/ai-plan-network-diagnosis/2026-10-06/`：`ui-result.json`、`ui-incomplete-result.json`、`ui-slow-completed.png`、`ui-incomplete-error.png`、`nginx-check.json`。这些证明本次连接修复与界面错误处理，不代表已进行真实模型调用、生产学员计划保存或线上部署。

后续上线仅需发布本次 Web/API 修复并应用对应 Nginx location；不得把工作区其他小程序、支付、地图等 WIP 混入此次发布，也不把本次修复请求作为修改学员实际训练数据的授权。

## 结论

这两次失败已经由正式服务器日志确认属于系统端超时。Nginx 等待 AI SSE 上游数据超过读取间隔上限后切断连接，浏览器读取流失败，前端直接展示底层 `network error`。断开后后端仍尝试 enqueue，进一步触发 `Controller is already closed`。

尚未确定模型服务为什么在第三段耗时较长；这不影响对这两次连接被服务器主动超时关闭的确认。不把所有网络问题泛化为同一原因。

## 正式环境证据

准确匹配请求：`POST /api/plan-lib/batch-operation`；Referer 为用户截图的订阅 `3a71d6a5-924b-4ffb-95c1-c4be34e5b625` 学员计划页。

| 事件 | 服务器 +08:00 | 用户 Asia/Tokyo | 内容 |
| --- | --- | --- | --- |
| 首次代理中断 | 05:05:13 | 06:05:13 | upstream timed out while reading upstream |
| 再次代理中断 | 05:08:07 | 06:08:07 | upstream timed out while reading upstream |
| 首次后端续写 | 05:05:17.230 | 06:05:17.230 | Controller is already closed / enqueue |
| 再次后端续写 | 05:08:29.098 | 06:08:29.098 | Controller is already closed / enqueue |

截图分别为 06:05:12 和 06:08:06，与访问/错误日志相差约一秒。SSE 响应头先发送，所以访问日志中的 HTTP 200 不能证明完整任务成功；两次返回字节数分别为 1047、1641。

`sudo nginx -T` 与 `/etc/nginx/conf.d/coachlink.conf` 确认该路径走普通 `location /`，该 location 与 http/server 父级没有自定义 `proxy_read_timeout` 或关闭 buffering；其他视频路径的 900s 设置不覆盖这个 AI 接口。采用 Nginx 默认读取间隔 60s、buffering on。官方说明读取超时针对相邻读取之间的间隔，并非整个任务的总时长：[Nginx proxy_read_timeout](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout)。buffering 默认和 `X-Accel-Buffering` 行为见[官方 buffering 文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)。

通过只读 `kubectl exec` 检查当前生产编译 chunk：存在 text/event-stream，没有 X-Accel-Buffering、setInterval 或 addEventListener。当前 deployment generation 125、3/3 副本 Ready；历史已终止 Pod 不代表当前线上不可用，未进行清理。

## 源码对应

- `src/app/api/plan-lib/batch-operation/route.ts`：局部补丁按 chunk 串行等待非流式模型结果；SSE 只有阶段消息，没有周期心跳。sendMessage 直接 enqueue，finally 直接 close，缺少断连/取消保护。
- `src/app/service/batchOperationService.ts`：reader.read 异常后直接 `onError(error.message)`，缺少用户可理解的错误说明。
- `src/components/BatchOperationDialog.tsx`：只有完整 preview_result 到达后才更新预览；计划页 local 模式还需应用草稿和实际保存。进度到 3/4 不代表前三段已经写入训练计划。

## 后续修复方向

1. 为该 AI SSE 路径配置及时透传和合理的读取超时；代码响应加 `X-Accel-Buffering: no`。
2. 在模型等待期间周期发送 SSE 注释心跳；维护 stream 关闭状态，取消时释放定时器，避免往已关闭 controller 写入，处理客户端断开。
3. 前端区分流中断与服务端业务错误，明确本轮没有完成结果；正常结束但缺少最终结果也应判为不完整。
4. 如果实现“继续”，必须持久化/恢复分段结果，不能把再次发送一句“继续”当成已有后台任务的续传。

这些是诊断阶段的修复建议。随后用户已授权直接修改，具体实现与验证见上方“后续修复”；分段断点恢复未新增，也未宣称已上线。

## 诊断阶段操作边界

本轮只读正式日志/配置/生产编译代码，以及本地源码；未重新发起模型任务、改训练数据、读取数据库、改现有测试或业务源码，也未修改 Nginx、重启、提交、推送或部署。没有进行浏览器复现；诊断依据是实际两次线上请求的日志。证据为 `artifacts/ai-plan-network-diagnosis/2026-10-06/evidence.json`，不保留客户端 IP、密钥或健康问卷内容。
