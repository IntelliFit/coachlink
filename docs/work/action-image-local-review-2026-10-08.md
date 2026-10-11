# 本地动作图片审核库

## 使用

- 地址：http://127.0.0.1:3002 。服务只监听本机，不连接业务数据库。
- 当前有 410 张动作图片；原 430 个审核位置固定，另含 18 条删除记录和 2 条合并记录，4 条暂时隐藏动作单独列出。
- “从反手扣腕撞腹继续”跳到原第 6 页最后一项；第 7 页仍从反手宽距贴腹开始。打开 `http://127.0.0.1:3002/?resume=1` 也可直接继续。
- 点击图片可放大；支持搜索、分类、审核状态筛选，每页 24 项。
- 点“不合格”立即保存到本机并加入返工清单。可选填错误原因，点“保存备注”保存。也可点“合格”或“撤销”。
- 刷新页面、重启服务仍保留结果。每个动作以 publicId + 图片完整 SHA256 识别版本；新版图回到待审核，旧版结论保留。
- 审核完后在当前对话说“重做不合格”，代理读取本地清单，按备注研究并生成同风格的新图，不再重做已合格图片。

## 本地文件

- 启动：`scripts/start-action-image-review.cmd`，或 `node scripts/action-image-review-server.mjs`。电脑重启后若链接打不开，重新运行启动脚本。
- 端口已由 port-manager 为 `D:\files\coachlink` / `action-image-review` 登记为 3002；不修改主站配置。
- 页面：`scripts/action-image-review/index.html`。
- 服务：`scripts/action-image-review-server.mjs`。
- 权威审核记录：`artifacts/action-image-review/reviews.json`。不要删除；当前未人为评审的动作均待审核。
- 自动生成的返工清单：`artifacts/action-image-review/rework-queue.json`，包含名称、publicId、canonicalId、素材 key、图片 SHA、图片路径与备注。页面也可导出。
- 服务日志：`artifacts/action-image-review/server.stdout.log`、`server.stderr.log`。
- 交付截图：`artifacts/action-image-review/review-library.jpg`。

## 实现与验证

- 图片取自之前已登记的本地最终素材，通过已导入 URL 与完整 SHA 对应，不重新生成、不下载远程素材。
- 审核写入串行执行，JSON 先写临时文件再原子替换；拒绝跨站写入和过期图片版本，异常不会覆盖坏掉的历史记录。
- 独立临时数据目录验证通过：430 图片映射、PNG 读取、并发保存、拒绝清单、服务重启保持结果、撤销、旧版提交 409、跨域 403；验证未写用户实际审核文件。
- 本机没有找到 `web-devtools` skill，使用可用的 CUA 浏览器实查：名字搜索平板支撑、放大/关闭图片、有氧分类 20 条均成功，并保存截图。用户实际审核文件保持空，不把代理测试视作用户评审。
- 本轮 lint、typecheck、Next build（547 页）通过。首次项目单测因 C 盘 0 可用空间出现 ENOSPC；改为 D 盘临时目录、单 worker 复跑，78 文件 520 测试全部通过。临时环境变量仅作用于该次检查进程。
- 页面已作为交付浏览器标签保留，当前后台 node PID 17844，127.0.0.1:3002；服务留给用户审核。原 PID 53840/43484 为历史值。

## 后续返工

人工不合格记录是返工依据，优先于此前代理的视觉复核。新版生成继续遵守统一 CoachLink 解剖插画风格：静态单幅、动态只展示有区别的关键姿势；网络视频/照片仅用于理解。按清单备注重做后更新现有素材登记、图片导入与范围清单，再刷新审核库。禁止把旧图的合格结论自动继承给新版。
