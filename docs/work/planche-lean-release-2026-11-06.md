# 静态、动态冲肩上线

用户在本地两张候选交付后明确要求“你改完倒是把这动作上线呀”。仅确认和发布这两个当前 SHA，其他待审/不合格动作保持原结论。

- 静态冲肩：`18f38c3a-b512-44c5-8479-3e6a5eedf12c`，按秒，单幅保持图，SHA `7aeb8a07c6eb1681b980172c4a6d74fea03d1aaa4501d974709a369a17e0f20f`。
- 动态冲肩：`35018603-cb60-400c-a364-aaa3d70583b4`，按次，两幅关键位，SHA `d6ac1bb57a92103cd288369ec7f28cc607abacd9f6d4ac6a1b554a9d0ff7fe65`。
- 复用已有两个 canonical ID，仅更新图片地址；新增公共入口时先设待审隐藏，后端名单就绪后才启用。私人动作及训练历史不改。
- 两张图实际以真人视频帧加统一画风参考作为输入；生成记录见 `artifacts/action-image-review/planche-lean-2026-11-04/generation-jobs.json`。
- 最小备份：`D:/private/coachlink-action-review/2026-11-06/planche-release/before.json`。保存原 canonical 图片、原公共记录（空）、新建记录字段及私人引用摘要。

## 发布来源与验证

- 线上基线：`fd52c754dce00c14f70cc720d51966b5eda99966`，原镜像 manifest `sha256:5e03b986d32b6cb0d0f23ea7feefb0a7d35dff79797b04bd6d821c9acd910ae0`。
- 固定源码直接从 Git 对象流式导出到服务器；3,521 个文件逐一核对 Git blob，归档的 CRLF 仅在规范化后与原 blob 完全一致时接受。应用源码只改 `src/lib/streetWorkoutImageApprovals.json` 两个条目，原 429 条保留。
- 依赖层复用镜像 `sha256:a116fdd567a95f01a916c4598bb8db84b1b85fe23c43c5c23b964aa1c76540c5`；实际核对锁文件完整 SHA `c5e86f3b6d1bb53079e848c5520125903fed24e29c97114e6994c85b94a5851b`、Next 16.0.1、TypeScript 5.9.3 和原生 isolated-vm 可加载，未重新安装依赖。
- 后端允许名单定向检查：正确图 2 项显示、错图 2 项隐藏、待审类型 2 项隐藏。
- 本次服务器目录 `/home/ubuntu/coachlink-planche-release-20261106`；已有主机/集群实测对应 CoachLink，构建用既有 `safe-docker-build` 限制 CPU/内存并串行。未修改其他产品、worker 或小程序包。
- 首次构建因漏带 Tailwind 配置主动停止；补齐后先遇可用内存保护拒绝，再遇旧依赖缓存标签缺失；最终改用核验过的现有依赖层。以上均未切换线上流量。

已发布并回读通过：

- 初次发布镜像 manifest：`sha256:5a182979385744a446b7ee489e6dc950640a182fe4f62c667460665ca2187254`，保留线上基线 revision 标签并附加 `fit.coachlink.approval-release=planche-20261106`。初次发布时未提交或推送 Git 分支；后续用户明确要求同步，现将两条审核配置及本说明提交，并分别合入 GitHub/Gitee 的 dev、main；各分支其他功能及本机 WIP 保留。
- 体验端 `coachlink-dev` generation128、1/1 Ready；正式端 `coachlink-main` generation165、3/3 Ready。全部新 Pod 的实际 imageID 与 manifest 一致，0重启；原 apollo-reloader 镜像及目标副本数未改。
- 两端健康接口200，公共动作搜索“冲肩”恰好返回两项，详情名称/标准ID/图片地址/计时计次属性正确，CDN图片完整 SHA 与本地通过版本一致。
- 两端325力量/街健+20有氧=345项；原343项的ID、名称、分类、标准ID、属性、部位和图片地址逐项与操作前一致。私人动作引用回读未变，未恢复其他待审/不合格动作。
- 本地审核库已同步为这两张“合格、已发布”，原审核顺序和其他审核记录保持。其余4张待审、1张不合格仍不发布。
- 完整回读：`artifacts/action-image-review/planche-release-2026-11-06/online-readback.json`；Pod/源码/依赖层回执在同目录。应用生产编译通过；没有运行全量测试或全量类型检查，不以编译代替测试。

## Git 同步补齐

- 两条审核配置是后端显示这两个动作的必要条件；图片和动作数据已上线仍不能代替源码入库。提交前核对原429条未改、新增2条与审核版本及线上地址一致。
- 本次仅合入两条审核配置和本说明；main 中关于“这2条还没进git”的过时提示同步更正。保留各分支自己的功能与提交历史，Gitee 仅快进到对应 GitHub 分支。
- 仓库 Docker 发布工作流只允许手动触发，推送不重建或部署后端；main 推送可能运行既有云端测试，不在本机全量构建、安装依赖或重传图片。
- 当前线上后端已由后续即兴训练发布更新为镜像 `8195a6429e24ae6af12561fff63db9179f2fc564fa365490450a9e233f3dceaf`，仍包含这两条审核配置。本次源码同步不更换镜像。最终提交、四个远端分支和两端接口回读见本地 `artifacts/action-image-review/planche-git-sync-2026-11-06/`。

## 恢复与产物

- 回滚应用须恢复上述原 manifest；如撤回两条新公共入口，只按上述精确公共 ID 及 canonical ID 删除，不删标准动作或私人引用。canonical 图片恢复前应再次检查当前值仍为本次新地址，不能覆盖后续修改。
- 发布回执在 `artifacts/action-image-review/planche-release-2026-11-06/`；本机临时目录 `D:/cache/agent-tests/coachlink-planche-release-20261106`。本机没有源码归档、全量构建或依赖安装产物。
- 本次本机回执、最小备份和日志合计约1.6MB；审核服务仍保留运行，本机缓存目录中的服务日志应在停用审核库后再清理。
- 构建日志、固定源码与镜像保留供审计；任务目录可在验收后按确切路径单独清理，不清理共享 Docker 缓存、用户审核库或私有恢复备份。
- 服务器固定源码与回执目录约157MiB；新镜像Docker报告189,248,658字节（含共享层，不是净新增磁盘量），构建缓存净新增无法在有其他任务同时清理的主机上准确归因。保留发布与回滚镜像；若后续清理，仅列出本任务的固定目录和无运行容器引用的构建层后再确认范围。
