# Plan date/calendar regression prompt

在 coachlink 工作区验证计划日、实际训练日期、补记提交时间的分离。

1. 先读 AGENTS.md 和状态文件。不得对真实学员执行写入测试；不得通过真实账号“点完成”来验证新接口。
2. 运行 `npx vitest run tests/plan-calendar-consistency-regression.test.ts tests/record-completion-regression.test.ts tests/execution-completion-regression.test.ts`。
3. 在无端口暴露的临时 PostgreSQL 16 容器运行 `node scripts/test-plan-completion-dates.mjs <容器名>`。容器名必须是 `coachlink-plan-date-test-` 前缀。脚本创建独立数据库并在 finally 删除；结束后停止自己创建的 --rm 容器。不得使用业务数据库连接串。
4. Web 与小程序用独立测试账号/请求 Mock，查看月历中同一天 D1 和 D4 均保留；重复点击切换；已完成历史即使超出未来周窗口也可看。检查 D 编号依旧对应原计划，不重新编号。
5. 未开启记录时点击“补记已练过的这一天”，必须先选择实际日期。确认前关闭弹窗不得产生保存；未来日期不可选。确认保存只产生一次完成事实，不能伪造组数、重量、视频。重复请求和刷新重试不能再扣次数。
6. 超时部分完成记录走同一日期确认入口，补记后原有组、视频、备注不变；已完成记录走“核对训练日期”，日期更正留下审计且不再次消费权益。
7. 用 D50/53/57/60/64/67 已完成的固定案例，其中 D53=9/24、D57=9/25、D60=9/17、D64=9/21、D67=9/23，时钟固定9/26。推进不得倒退到D54-D56，历史仍按已有日期展示并提示核对，不能暗中改日期。
8. 登录/刷新会话和计划 CRUD 的完整 E2E 仅使用已有隔离测试配置；未配置时记录阻塞，不把 Mock UI 或单元测试称为真实全链路验收。
9. 恢复所有 Mock、测试 storage 和临时身份，清理全部新建测试主键；提交证据区分单元测试、真实 SQL、UI 交互与未验证项。数据库迁移或部署须另行授权。
