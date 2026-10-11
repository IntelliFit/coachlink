# 自重与按秒训练回归指引

先读D:/files/coachlink状态和AGENTS.md。默认内存数据库测试，不猜测/改kk历史。

1. 测试子进程TEMP/TMP/TMPDIR指向D:/cache/agent-tests独立任务目录，使用现有依赖。
2. 执行 `node node_modules/vitest/vitest.mjs run tests/training-set-metrics.test.ts tests/training-set-metrics-api.test.ts tests/training-set-metrics-records.test.ts tests/execution-completion-regression.test.ts src/app/api/execution/bearer-auth.test.ts src/app/api/impromptu/bearer-auth.test.ts --reporter=default --maxWorkers=1 --minWorkers=1 --no-file-parallelism --cache=false`。
3. 覆盖0外加kg/空值区别、时间actual_duration与e1RM隔离、旧kg×次请求拒绝、新增组继承、快速完成/已完成组保留、缺秒数文案、容量、明确次数与辅助负荷。
4. 验证mini/App成功保存沿原cache工具回写，返回今日页进度一致，不另建storage规则。
5. UI仅在有构建授权且完整项目/AppID/窗口/端口/版本/占用者确认后串行验收；优先复用，不靠反复开窗或安装大依赖恢复。
6. 用受控fixture/mock，不完成真实学员训练。检查自重入口0、保持X秒、旧缺秒数不补20、海报/分享容量排除时间组、备注/视频/手动进步保留。
7. finally恢复本任务mock/storage、断开并释放借用窗口，只关闭本任务创建且未移交用户窗口。若明确授权真实测试数据，记录主键并finally精确清理。
8. 报告真实通过项和阻塞，不把scoped typecheck/语法/监听/旧dist当三端UI通过；确认路径和reparse后只清本任务临时目录。
