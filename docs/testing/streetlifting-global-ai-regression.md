# 单杠海外点位 AI 回归 Prompt

请在 `D:\files\coachlink` 验证海外单杠点位，使用 `.kimi/skills/weapp-devtools/SKILL.md`，不要修改已有测试、真实业务数据或发布版本。

用户最新要求是搜索和直接地图点击选点，手填经纬度只能备用。优先运行 `node scripts/verify-streetlifting-location-picker-ui.cjs`：真实海外地名搜索→选择结果→地图中心选点→确认自动返回→国家/坐标自动回填；脚本检查已有真实登录并finally恢复用户原草稿，不提交点位、不伪造登录。核对 `artifacts/streetlifting-global/2026-10-03/picker/ui-manifest.json` 与实际PNG。另需真实地图点击和POI点击路径；自动化无法产生原生点击坐标时明确记录未验收，不能以人工注入事件模拟真实地图点击。

`--picker-only` 只验证目标搜索页和地图中心，写独立picker-only-manifest.json，不可据此称表单返回已验收。本轮最终两个manifest均失败：真实本地API200，但新主入口/搜索框未检出；正常刷新一次后仍失败。先诊断实际渲染与运行时代码，不要继续无差别刷新或用模拟事件补通过。运行全量测试时停下编译与UI导航；2026-10-03最终69文件443测试已独立串行通过。

新增 `locationSearch.test.ts` / `locationSearchRoute.test.ts` 覆盖地名搜索GeoJSON经纬顺序、WGS84来源、南纬/西经、非法候选与认证输入边界。搜索服务走自身API，服务端可用STREETLIFTING_PLACE_SEARCH_URL切换Photon兼容上游；公共Photon仅合理频率使用，无可用性保证，不进行压测或批量抓取。

1. 运行 `npm run lint`、`npm run typecheck`、`npm test -- --maxWorkers=1 --minWorkers=1`。不要与构建同时运行全量测试，避免冷导入超时。新增坐标回归位于 `src/lib/locationCoordinates.test.ts`，应覆盖伦敦西经、悉尼南纬、零坐标、越界/空值、韩国坐标不偏移、国内导入 GPS 坐标转换及 legacy/native 不二次转换；`src/lib/streetliftingLocationCache.test.ts` 覆盖本地优先/云端覆盖、60天过期、用户草稿隔离和20项查询缓存上限。
2. 运行 `node scripts/verify-streetlifting-global-db.cjs`。脚本只使用已有本地 PostgreSQL Docker 镜像，不读取项目环境配置，创建唯一临时容器；全部 SQL 在事务中回滚，finally 删除容器。确认国家查询、海外坐标读写、历史行 metadata 为空兼容，以及 residual_tables=0。
3. 本地构建 `apps/wechat`，开发 API 显式指向当前可用本地后端；不要误用默认 3000。根本地配置仍遵循 `scripts/config/bootstrap-env.mjs` 单源规则，不改配置来源或真实数据库。
4. 必须确认项目 `D:\files\coachlink\apps\wechat`、AppID `wx316e39eb71c0e834`、自动化端口 `9420`；先执行 `mrc where --port 9420`。确认没有其他任务正在导航同一会话，再复用现有正常 DevTools 会话，不用桌面鼠标/键盘控制。若没有已登录会话或会话正被其他任务使用，报告阻塞，禁止伪造登录或擅自关闭/重开。
5. 手填备用路径：在添加表单点击“经纬度备用输入”，填写英国和伦敦经纬度，点击“查看位置”，检查地图中心，切换世界视角，再返回确认草稿保留；不提交表单，不创建真实点位。逐张查看本轮PNG及ui-manifest.json。旧 `verify-streetlifting-global-ui.cjs` 只对应旧入口布局，本轮未擅自改旧测试脚本，不直接用其旧选择器当最新验收。
6. 另外用悉尼 `-33.8688,151.2093` 及韩国 `37.5665,126.978` 检查预览；不以 SDK ack 或截图文件名代替实际坐标/路由/画面证据。不得把模拟器验证写成海外真机搜索或导航已验证。
7. 生产生效顺序是新 SQL 迁移 → API 更新 → 小程序新包。未经用户单独授权不得提交、推送、迁移生产、上传体验版或提审。
