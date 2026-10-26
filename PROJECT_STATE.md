## 待下次小程序发版：哑铃弹弹长尾物理（2026-10-26，只在 dev）

- `cc6216b8`：完全弹性 + 能量守恒、缝比哑铃短（只能竖着掉）、每局随机摩擦；中位约 84 下，3.5% 上千。倍速 1/2/3/5/10×，录制上限 10 分钟。
- 纯小程序改动，无后端/迁移。用户要求**不单独发体验版**，下次小程序发版时一起带上。2026.10.25.1213 里仍是旧的短弹版（4–6 下就掉）。

## 正式发布准备：薄肌 PK + 哑铃弹跳物理版（2026-10-25）

- 用户真机测试：薄肌 PK 没问题；哑铃弹跳有问题，pushup 会话改为真实物理（57f207fa，只改小程序/文档/测试）。
- dev/main 均推到 57f207fa。typecheck 通过；vitest 1078/1079（既有 streetliftingLocationOverview）。
- 后端无新改动，直接用已在 dev 真机验证的 `coachlink@sha256:33a25e28…`（4ef05011）：coachlink-main c9a851ae → 33a25e28，3/3，healthy/login/boji/功率分析 200，challenge 未知 id 404。dev 早已是 33a25e28。Worker 仍 d41b45f6（无变化）。
- 小程序开发版 **2026.10.25.1213**（2956 模块，总包 10,124,839 / 主包 1,989,697，描述 release-57f207f-boji-pk-dumbbell），用于体验版和送审；哑铃弹跳录制/保存视频需真机确认。

## 体验版：薄肌 PK + 哑铃弹跳（2026-10-25，只上 dev）

- 用户已在 SQL Editor 执行 20261025090000_boji_scores.sql；只读核实 service 可查表、rank 函数返回 {sample_users:0}，anon 读表/调函数均 401。
- dev 4ef05011 = f626bda8 + 84fa7889（哑铃弹跳相机游戏，纯小程序）+ feat/boji-pk（超越 X%、最像谁、好友 PK）。冲突 src/app/toolbox/boji/page.tsx：保留暗色 dark: 样式 + ChallengeBanner + 新隐私文案。typecheck 通过；vitest 1075/1076（既有 streetliftingLocationOverview）。**origin/main 仍 f626bda8**，等用户真机测完再合。
- 小程序开发版 **2026.10.25.1139**（2956 模块，总包 10,123,108 / 主包 1,987,777，描述 trial-4ef0501-boji-pk-dumbbell），用户手机真机测，未本地 UI 验证。
- Web `coachlink@sha256:33a25e28…`（标签 4ef0501，服务器 binary diff 还原，2131 文件 blob 一致）**只切 coachlink-dev**（c9a851ae → 33a25e28，3/3，buildTime 2026-10-25T03:39:06Z）；challenge 未知 id 返回 404「这场 PK 不存在或已失效」，analyze 未登录 401。**coachlink-main 仍 c9a851ae**（不含 PK），送审版 2026.10.25.1004 不受影响。测完后：dev→main 合并、coachlink-main 切 33a25e28、再出正式版。

## 送审包：合并 + 小程序 2026.10.25.1004（2026-10-25，未推镜像）

- dev/main 推到 f833dc13：origin/dev 两个封面提交、dev 上 kg/lbs 记录（2e60be14）与身体数据默认填自己（f93a88ca + 决策记录）、海报超过 8 个动作截断修复（4742154e，来自"动作超过8个显示不全"会话）、get-profile/get-student-profile 越权修复（claude/quizzical-murdock-4e9b31）、feat/ui-refresh（网页发现页、工具箱暗色、热门动作、单臂引体公开）、自定义动作关键帧角度标注（claude/suspicious-goodall-f1741a，e40087e4）。
- **未纳入**：feat/boji-pk（排名/最像谁/PK，需先执行线上迁移 20261025090000_boji_scores.sql 并上线后端，所在会话正等用户回答）；"pushup健身挑战工具"会话正在主检出写的哑铃弹跳游戏（dumbbell-bounce、arcadeReplayRecorder、cameraCompositeRecorder 未提交）。
- 小程序在干净 worktree（D:/CodexWork/coachlink-release-2026-10-25，node_modules 用联接）构建，避免带入主检出未提交改动：2944 模块/976 文件，只含正式域名，无 dumbbell-bounce。DevTools 端口 43678 上传开发版 **2026.10.25.1004**（总包 10,069,349 / 主包 1,981,156，描述 release-f833dc1-audit）。
- 门禁：typecheck 通过；worktree 内 vitest 7 文件失败，其中 5 个是 worktree 环境问题（apps/mobile 无 expo、联接导致模块身份不同），在主检出重跑只剩既有 streetliftingLocationOverview。
- 用户要求后已更新后端（2026-10-25 11:00–11:15 北京时间）：服务器以 b5caf5a4 浅克隆 + 本机 binary diff 还原 dcea600f，2122 个文件 git blob 哈希逐一一致。Web `coachlink@sha256:c9a851ae…`（标签 dcea600）：dev、main 均 f7cffc5b → c9a851ae，3/3，两域 healthy/login/功率分析/薄肌 200，buildTime 2026-10-25T02:59:18Z，未登录 get-profile 401。Worker `coachlink-power-worker@sha256:d41b45f6…`（标签 power-20261025-dcea600，以 155e1c02 为基础叠加代码，镜像内 62 项测试通过）：worker-dev、worker-main 均 a67a5384 → d41b45f6，Kafka 两个消费组各只剩新 pod 且持有 16 个分区（main 组刚切换时短暂显示 0 分区，约 1 分钟后完成重平衡）。无迁移、依赖未变。

## 全量合并 + 小程序体验包（2026-10-24，未推镜像）

- dev/main 推到 299f9cfb：主检出 c010845f（单杠地图做工具箱首卡 + 小程序页面进入追踪）、AGENTS/CLAUDE 镜像推送规则、feat/boji-weapp（薄肌检测器小程序页）、feat/ui-refresh 3 个提交 + 该 worktree 未提交的功率分析页 v1 改版（8c6384bb）、perf/bearer-auth-parallel、perf/list-students-speed、perf/coach-overview-student-payment-parallel。唯一冲突 src/testUtils/mockSupabase.ts 保留 perf 分支新增的 is()。
- 门禁：typecheck 通过；vitest 132 文件 992/993，唯一失败仍是既有 streetliftingLocationOverview recentMonths；e2e 写正式库未跑。
- 2026-10-25 用户要求推镜像后已上线：Web `coachlink@sha256:f7cffc5b…`（标签只推 9684fc5 一个，控制 CCR 标签数），main b270ad4b → f7cffc5b、dev f403d885 → f7cffc5b，均 3/3；两域 healthy/login/toolbox/boji 200，buildTime 2026-10-24T17:27:28Z，dev 3 分钟内无错误日志。本机构建可用但 CCR 推大层连续 4 次超时、scp 48MB 源码包也因约 40KB/s 断在半途；最终做法：本机 `git -c core.autocrlf=false diff --binary b5caf5a4 9684fc5f`（排除 docs/design/apps 等，gzip 后 0.4MB）传到服务器，在 ~/coachlink-release-20261020c-src（b5caf5a4 浅克隆）导出后 git apply，2101 个文件哈希与本地 9684fc5f 逐一一致，再用 coachlink-deps:lock-c5e86f3b6d1b 构建并由服务器推送。Worker/薄肌服务无改动未动。
- 原记录：线上 Web 当时仍 419a2a79。已核对小程序新代码用到的接口（boji analyze、/api/trace、locations/list）都在 419a2a79 中，学员页改动纯前端，体验包可直接对接线上后端。
- 小程序开发版 2026.10.24.1953 上传成功（DevTools 端口 43678，2939 模块，总包 10,034,838 / 主包 1,975,355 字节，描述 release-299f9cf-boji-ui-refresh-perf）；需用户在 mp 后台选为体验版。未提审。

## 薄肌检测器上线（2026-10-23，测试版）

- **线上 Web 现为 main 419a2a79 = 88f4c924 + 薄肌检测器**（逐文件核对：只多 boji 的 25 个新增文件，无删改）。镜像 `coachlink@sha256:b270ad4b…`，用户授权后 `kubectl set image` 切 coachlink-main（近几次 Web 更新都是手动钉 digest，Keel 对该部署没有自动更新），3/3，buildTime 2026-10-22T21:06:33Z；change-cause 已写。`/toolbox/boji` 200、工具箱首卡显示、未登录 analyze 401、登录弹窗不跳页。coachlink-dev 未切换，仍为 f403d885（不含 boji）。
- **以后发 Web 必须基于含 boji 的提交（≥ 773d71dd，例如 main）**；从 88f4c924 一类旧 worktree 构建或回滚到 f403d885，会让 `/toolbox/boji` 退回登录跳转、工具箱入口失效。
- boji-service：`deploy/k8s/boji-service/main` 已 apply（default 命名空间 Deployment + ClusterIP `coachlink-boji-service-main:8000`），镜像 `coachlink-boji-service:latest`（4f0ff94 构建，引擎 boji-detector e624dc1），1/1；在 web pod 内 healthz 与一次完整 analyze 通过（180 ms）。
- 推镜像经验：Docker Desktop 默认推 OCI 索引 + attestation；需要普通单 manifest 时用 `docker buildx imagetools create --prefer-index=false -t <tag> <repo>@<amd64 digest>`。本机推 CCR 大层多层并发易超时（timeout awaiting response headers），逐层推送可解；boji-service 仓库因此留有 build-stage-1..6 临时标签，可在控制台删除。
- 小程序薄肌检测器页在分支 feat/boji-weapp（f167628c），未推送、未在 DevTools 验收、未提审。

## 教练入驻：审核积压处理、申请接口越权修复、抽成 10%、开店进度与《教练手册》（2026-10-22）

- 线上数据（用户逐项指示后执行，已回读核对）：通过赵上、Epitaph、计划执行者8479（建 coaches、is_coach=true、发欢迎私信，私信暂不带手册链接）；街健探索者5130、动作打磨者8181 改待补充材料并私信补充项；测试号沈妈妈、MAX 申请改 rejected 不发私信，coaches 仍 suspended，未删任何行。审核人沿用此前 20 次通过的管理员账号。教练名单与手机号 CSV 在 D:/CodexWork/coachlink-coach-ops/coaches-2026-10-22.csv（含个人信息，不入库）。
- 10-21 前没收到申请私信的原因：平台待办通知 620280d3 直到 10-21 发布才上线，5 个申请都早于它；链路本身已验证可送达。
- 本地代码（未提交、未部署）：申请列表仅管理员、详情非管理员只能查自己；审核联动抽到 `src/lib/coachApplicationReview.ts`，待补充材料也发私信；后台审核页显示手机号、待补充材料按钮、批量批准、状态多选，新增「开店进度」页签（`/api/admin/coach-onboarding`）；三端申请手机号必填 + 入驻须知勾选；平台服务费 10%（`packages/core/src/coachPolicy.ts`），分账改读结算单记录金额；公开页 `/coach/handbook`。
- 服务端手机号：格式错误拒绝；为空用账号手机号兜底（老版小程序服务层失败不抛错，直接拒绝会被当成「已提交」吞掉）；申请人重新提交留空不覆盖已有号码。代码评审（opus）无高危，CSV 公式注入、草稿问卷计入开店、小程序手机号不能输 + 已修。
- 门禁：typecheck 通过、APP typecheck 通过；vitest 876/877，唯一失败仍是既有 streetliftingLocationOverview。未跑 e2e（写正式库）；Web/小程序 UI 未在浏览器/DevTools 验收。
- 待办：发布前须先上线才能让新教练按 10% 结算；群二维码 7 天过期，建议换企业微信活码；汇付开户流程问题待用户说明具体现象。
- 发布（用户授权提交 dev、按原流程发 Web/API、小程序上传开发版）：328a0435 已推 GitHub dev/main（叠在另一会话已上线的 51309674 之上，线上 Web 为 a9ff2e69 = 51309674）。干净 worktree D:/CodexWork/coachlink-release-2026-10-22/src 本机构建 Web 镜像成功（551 页，4 标签 revision 标签已核对）。推 CCR 全部被拒：littlehorse/coachlink 个人版已达 100 个标签上限，覆盖已有 dev/main/latest 也被拒，main/dev 未切换、线上未变。只读核对：服务器仍引用 12 个 digest + xpay-notify-20261008-v1 标签，共 17 个标签须保留，83 个无引用标签清单在该目录 ccr-tags-safe-to-delete.txt；本机无 tccli，删除需用户在腾讯云控制台操作或另行授权。
- 小程序开发版 2026.10.22.2338 已上传（日志 ✔ upload；总包 9,975,670 / 主包 1,966,987 字节，972 文件，只含 coachlink.fit/dev.coachlink.fit；DevTools 服务端口仍 43678），未提审。注意：停掉 docker build 客户端不会取消 BuildKit 里的构建，旧构建会在之后覆盖标签，需重建或核对 label。
- 教练端「我的主页」显示的教练群二维码 cdn-assets.coachlink.fit/beta-groups/coach-wechat-group.png 为 2026-06-18 上传，早已过期。
- 续（10-22 晚）：用户同意写入新群码（10-30 前有效）并表示旧镜像不需保留。群码改为随 Web 发布的 public/images/coach-wechat-group.png（`COACH_GROUP_QR_PATH` / `COACH_GROUP_QR_VALID_UNTIL`），手册页底部与小程序教练「我的主页」使用；换码＝覆盖文件+改日期+发布。仅推送 4c7e15d0 到 dev/main（叠在另一会话已推送的 boji 三个提交之上）；本检出 dev 上另一会话未推送的 c010845f（单杠地图 hero + pageTrace）未推送、未改动。
- CCR 个人版 registry API 不允许 delete（401，action=delete），本机无 tccli，旧标签只能在控制台删；未删任何标签。
- **已上线（10-23 凌晨）**：用户在控制台删旧标签后剩 19 个（xpay-notify-20261008-v1 也被删，复核服务器已无引用）。期间另一会话已上线 7aa8155e（revision 标签 `51309674+419a2a79`：超时关闭训练可补记），直接发 41aba9f 会回滚它，故在 worktree 再 cherry-pick 419a2a79 得 88f4c924（= 51309674 + 328a0435 + 群码 + 超时修复；不含 boji 与 c010845f）。worktree 内 typecheck 通过，vitest 869/870（既有 streetliftingLocationOverview 失败；另 5 个 apps/mobile 测试因 worktree 未链 expo 依赖无法加载）。镜像 `coachlink@sha256:f403d885…`（标签 88f4c92/dev/main/latest），核对两套仍为 7aa8155e 后先切 dev 再切 main，均 3/3；两域 buildTime 2026-10-22T19:32:58Z，healthy/login/discovery/handbook/群码图片 200，未登录 list-coach-applications 401，手册含 10% 与群码有效期。小程序开发版改为 2026.10.23.0343（同一提交，含超时修复，✔ upload，总包 9,975,041 / 主包 1,969,550），未提审。
- 清理：本机发布镜像、拉取的 7aa8155e 已删，`docker builder prune` 清掉全局构建缓存 19.46GB（含其他会话可重建缓存）；worktree 已从 git 注销，目录仅剩 dist-release（DevTools 仍占用 debug.log，CLI close 后未释放）；另一会话的本地镜像 7086f9d 未动。worktree 的 node_modules 覆盖用 junction（@coachlink/core 指向 worktree 自身 packages/core，否则会解析到主检出旧 core），已逐个按链接删除，共享目录完好。
- 发布内容刻意不含 boji（boji-service 未部署）和 c010845f：Web 镜像从 worktree 提交 41aba9fe（= 328a0435 + 群码 cherry-pick，仅存在于 D:/CodexWork/coachlink-release-2026-10-22/src）构建，551 页，标签 41aba9f/dev/main/latest 的 revision 已核对，待推送。小程序在同一 worktree（junction 链主检出 node_modules，已删除链接、共享目录完好）构建 972 文件、不含 boji/pageTrace，上传开发版 2026.10.23.0053（✔ upload，总包 9,971,930 / 主包 1,966,439），覆盖 2026.10.22.2338，未提审。

## 全量合并发布：1RM/自重、UI 改版第二批、教练聚合接口提速、任意动作分析（2026-10-21）

- 合并到 dev 并直推 GitHub dev/main（05d8cf56）：主检出未提交的小程序 1RM/自重记录改动（a0dd541f）、claude/funny-lovelace-e83abf（Web/APP 1RM 判定）、perf/aggregated-info-speed（get-aggregated-info 约 11s→0.7s）、feat/ui-refresh 第二批 8 个提交；唯一冲突 plan-detail/index.scss 取已用 v1 tokens 的本地版。推送需 `-c credential.username=SmallHorseBrother`（Zhu-Pengming 无权限，默认会弹 GCM 选账号窗口卡住）。
- 门禁：typecheck 通过；vitest 113 文件 833/834 通过，唯一失败 `src/lib/streetliftingLocationOverview.test.ts` recentMonths 断言为 main 上既有问题（1f9ecf1b 起，与本次无关，未改测试）；e2e 会写正式库未跑。
- 数据库：无需改动（20261018180000、20261021120000 用户此前已在 SQL Editor 执行）。
- 镜像从干净 worktree D:/CodexWork/coachlink-release-2026-10-20/src（05d8cf56）本机构建，Next 550 页；Web `coachlink@sha256:a381b812…`（05d8cf5/dev/main/latest 四标签同摘要）。main/dev 是 digest 固定、Keel 不跟标签，已核对旧 digest（main 6491b6b8、dev 314c0149）后 `kubectl set image` 切换，两套 3/3 rollout 成功；两域 healthy/login/功率分析页 200，buildTime 2026-10-21T01:44:47Z。
- 小程序：本机 release 构建 2929 模块/972 文件，仅含 coachlink.fit/dev.coachlink.fit；DevTools CLI 上传开发版 2026.10.21.0946（总包 9,968,074 / 主包 1,965,556 字节，描述 release-05d8cf5-1rm-ui-refresh-power）。DevTools 服务端口当时是 43678，不是脚本默认 28264；CLI 在端口不对时打印 × 但退出码 0，脚本会误报 upload done，须看日志里的 √ upload。未提审、未发布。
- 本机 Docker Desktop 在推送中 WSL 引擎崩溃（0xc00000fd），`docker desktop restart` 后镜像仍在；Web 镜像重试后推送成功。本机构建的 Worker（4.6GB）大层连续 3 次 CCR timeout，放弃本机推送。
- Worker 改为服务器构建：服务器 git clone GitHub 卡死 30 分钟，改为本机 `git -c core.autocrlf=false archive`（否则 CRLF 导致 package-lock 哈希不符）只打包 scripts/src/packages/tsconfig/package-lock，scp 到服务器，以线上 155e1c02 为基础叠加代码（~/coachlink-rel20261021-worker.sh，须 setsid nohup 启动）。新镜像 `coachlink-power-worker@sha256:a67a5384…`（标签 power-20261021-05d8cf56），镜像内 50 项 Python 测试通过（`PYTHONPATH=.:tests python -m unittest discover -s tests -p "test_*.py"`，tests 无 __init__ 不能用 -t）。worker-dev 8c8220a4 → a67a5384、worker-main 155e1c02 → a67a5384，均 rollout 成功并加入 Kafka 消费组。CCR 上 coachlink-power-worker 的 :latest/:main 标签未更新（部署用 digest，不受影响）。

- 用户在体验版验收通过后，main 也已切换：网页 coachlink-main a7e758c2 → 6491b6b8（3/3 就绪，coachlink.fit healthy/功率分析页/login 200，新代码已在页面中，未登录上传 401）；分析程序 coachlink-power-worker-main :latest(90933f41) → 155e1c02（已加入 coachlink-power-workers 消费组）。dev → main 的合并 PR 已开，待两个审批。

- dev b44b11a0 已推送：功率分析 69e23bde（三大项杠铃片追踪、8 个动作姿态评估、卡片样式结果视频）+ feat/ui-refresh 合并（含选动作页 74f73510、俯卧撑突围样式 ad4cbbf9）。5505ac48、af2d1fc4 留到下一版。
- 正式库：用户在 SQL Editor 执行 20261018180000（任务表 mode 约束扩到 8 个动作），返回约束含 8 个动作；执行前只读核对 1342 条旧任务全部符合。
- dev 已上线：分析程序 coachlink-power-worker@sha256:155e1c02…（以线上 90933f41 为基础只替换 scripts/src，镜像内 19 项测试通过）；网页 coachlink@sha256:6491b6b8…（a32dc5b2 源码，550 页）。两者都改为不可变 digest，原 dev 标签镜像不再被 Keel 跟踪。
- main 未动：网页仍 a7e758c2，分析程序仍 90933f41（:latest）。用户在体验版验收后再切 main（同样先核对旧 digest 再 patch）。
- 小程序体验版 2026.10.20.1917 已上传（官方 CLI，显式 appid，总包 10,032,745 / 主包 1,960,815 字节），包来自 b44b11a0 付费版构建。
- 服务器构建注意：coachlink 依赖缓存镜像 be769081 已被清理，新缓存为 coachlink-deps:lock-c5e86f3b6d1b（Alpine/npm 用腾讯云和 npmmirror）；Debian 源从服务器下载极慢，分析程序依赖不变时应以线上镜像为基础只换代码。服务器上还有 18 天前磁盘不足时被驱逐的 power-worker Pod 残留记录（不影响运行）。

## 订阅修复上线与 anon key 收口（2026-10-18）

- 2026-10-18 用户在 Supabase SQL Editor 执行 20261018120000 迁移（选 Run and enable RLS）。实测：anon key 读 users/user_profiles/coaches/订阅/计划/训练/chat 等全部 401，service key 正常（users 5282 行）；两域 healthy/login 200，公开教练列表 POST 200 返回 10 位；生产日志 20 分钟内无权限错误。第三个镜像 a7e758c2（9d62d437）已上线 main/dev；main、dev 已直推同步到 4f4e4925，PR #46 自动标记已合并。
- 2026-10-18 续：剩余额度统一为 `src/lib/subscriptionBalance.ts`（当前计划：进行中 > 已排期 > 已完成，取最新；历史版本按接续汇总 + 当前计划按自身完成扣），过期任务、下一阶段提醒、额度快照、教练订阅列表改用它；102 个进行中订阅各路径结果一致（此前 6 个不一致，其中过期任务把旧完成计划当当前，例如 23 周算成 36 周）。续费/订阅到账加订单级幂等（payment_data.applied_subscription_order_ids）与按读取周数的条件写，进行中订阅再次订阅改为累加不覆盖；支付宝旧续费路径同样条件写。第三个镜像（9d62d437 的 7 个文件，不含另一会话的 e7b71613/620280d3）构建中。
- 用户授权最高权限后上线：镜像 `coachlink@sha256:1507a5f3…`（源码 be98b37d，含订阅修复与远端 13 个新提交的合并），main/dev 各 3/3；两域 healthy/login 200，匿名调过期接口 401，进程内过期任务 interval=3600000 已启动，首轮取消热身研究员8254（10/14 列出的 8 个全部已取消）。main 受“需 PR + 2 个审批”保护，PR https://github.com/IntelliFit/coachlink/pull/46 待用户审批合并；镜像由服务器按 10/14 方式从覆盖后的源码构建，未传 NEXT_PUBLIC_SUPABASE_ANON_KEY。
- 引体练习生第二阶段已发：4 周 12 练，外挂 1RM 67.5kg、体重 74kg，负重引体用固定重量（fixedLoadOverride），已同步动作库并私信通知。
- anon key 泄露：10/06、10/14 构建把 anon key 打进前端 JS；用 anon key 可读 users（手机号、密码哈希、openid）等核心表，核心表多数未开 RLS。已改：前端不再引用 supabaseClient；服务端默认客户端改用 service key（4cd3c227，第二个镜像构建中）；迁移 `20261018120000_lock_down_public_tables_from_client_roles.sql` 待 4cd3c227 上线后执行（本机与服务器都没有 Supabase 管理令牌，需用户在 SQL Editor 执行或提供令牌）。
- 剩余：唐、轻训大王的新计划待起草确认；小程序端改动需单独上传体验版。

## 订阅链路代码修复批次（2026-10-13，本地完成，未提交未部署）

- 2026-10-18 用户确认后已执行方案 A：9 个 8/20 前被接续替换的旧版本改为 no_charge（备份 artifacts/subscription-system-audit/2026-10-18/plan-a-backup.json），6 个订阅额度恢复（鞑靼 30 次可见满 84 天、力量观察员6380 12 次）。10/14 列出的 8 个待取消订阅中 7 个已于 10/15 被线上旧任务取消，剩热身研究员8254 待新任务取消（本机实跑被权限拦截）。新增：续费提醒跳过已有新计划的订阅；两个手动过期接口改为仅管理员。引体练习生 8 周计划 10/18 已结束、未发下一阶段（剩 12 次）；唐、轻训大王、引体练习生的新计划待起草后与用户确认。代码仍未提交未部署；用户已在 Apollo 加 SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS。
- 用户要求先做只改代码的一批。已改：计划完成条件迁移并在响应后提醒教练（默认只提醒、不生成草稿，提醒即记 succeeded；两端设置页文案改“提醒教练”）；订阅学员只能在训练日全部完成或跳过后标记教练计划完成；过期任务全量分页、进程内调度且须设 `SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS` 才运行、单飞、逐条条件取消防续费并发、重复扣费订阅暂不自动取消、页面不再触发；update/archive/activate/complete-instance 权限收紧；训练日结构锁（服务端 409 + Web/小程序编辑器拦截与合并，含小程序分配模板；同一动作按 id、缺 id 按名称判定）；原地修订不再移动起始日。日历按用户选择维持 9/28 推算方案。
- 代码审查（opus）后已修：锁判定过严、Web 编辑器保存基线浅拷贝、409 后不刷新锁、分配模板绕过合并、续费与取消竞态、本地生产构建会跑过期任务、下一阶段文案仍写“生成草稿”、学员可提前完成教练计划。新测试 5 个文件 70 项；vitest 83 文件 590 项全过，既有测试未改；根 typecheck 通过；改动文件定向 tsc 仅剩未改动行的历史错误；小程序 4 个改动页 tsc 错误均在未改动行。未跑 next build（会清空开发服务器在用的 .next）、未跑 e2e（会写正式库）、未做 Web/小程序界面实操（需登录正式账号）；3001 未登录请求被代理 401 拦截，路由编译只由 vitest 覆盖；3000 当前无响应。
- 部署须在生产配置加 `SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS=3600000`，否则过期任务不运行。修复记录写入 docs/done/engineering 两份清单与 DECISIONS.md。待用户确认：修正 6 个订阅余额、处理两名无计划学员、7 个已完成计划是否补发提醒、过期入口是否改为管理员专用（需改测试）、RLS/anon key 暴露问题；未提交未部署。

## 订阅体系只读审计（2026-10-13）

- 生产快照：订阅 160（active 108）、计划 203、完成训练 1,407、自动化任务 88 且 next_phase 为 0。确认六个缺陷：完成事件不触发下一阶段（R1）、接续日重复扣费 6 个订阅共 16.3 周（R2）、日历倒推日期（R3）、原地改计划按 day_index 错位风险（R4）、余额口径不一（R5）、过期任务 1000 行截断且由前端触发（R6）。
- 未改代码/数据；修复顺序与证据见 https://claude.ai/artifact/9RoCfgrjrEWQ19x4V4ESb8 及本机 artifacts/subscription-system-audit/2026-10-13/。

## Web及小程序体验版已同步（2026-10-15）

- 小程序2026.10.15.2313官方上传成功，总10002944/主1931638字节，用户已确认后台体验版指向新版本。固定48561dcc生产包，付费/HTTPS域名配置通过；未提审、正式发布或构建App。
- Web/后端运行源码无新差异，main130/dev91各3/3Ready，复用929921598b70镜像；两域首页/健康200，各9后端只读检查通过。最后新增已线上生效的cancelled状态迁移20261015151937及其回执一并纳入Git同步，无需再次部署。
- typecheck与25定向测试通过，lint未配ESLint；mini自动化超时未得UI证据。已官方关闭本任务项目并释放9420，保留原IDE。D任务约26MiB保留可在验收后清理；详见docs/work/web-wechat-release-2026-10-15.md。

## BlessingLSH 旧订阅已提前结束（2026-10-15）

- 按用户要求，3a71d6a5于北京时间23:20:20改cancelled/end_date=当时，正式API已回读确认；现有小程序可进入不同套餐重新购买。5计划/36执行/订单及其他159订阅保留，无代扣款或手机支付验收。
- 线上旧状态约束拒绝cancelled，CLI迁移20261015151937在同一事务补状态、结束目标订阅并登记history，ROLLBACK预演与COMMIT后验证通过。数据库已生效，迁移源码纳入同日发布收尾提交；无需重建镜像/重放操作。回执docs/work/blessing-subscription-early-end-2026-10-15.md。

## main/dev 全后端与迁移已上线（2026-10-14）

- 用户追加授权后，应用27ee1a99/业务79333c49已构建550页并同步不可变镜像929921598b70...；main130/dev91各3/3新PodReady/0重启，六个实际imageID一致，CCR main/dev/latest/27ee1a9同步。
- 套餐接续20261013142403已正式应用；081211/084632/143926原已生效迁移经结构/权限校验补history。生产last_payment_order_id=text、order_id=uuid，回滚验证捕获同SKU续费类型错误，CLI新建20261014092030以%TYPE修复，两次字段/幂等回归全通过，五项history最终存在。
- main/dev各26线上检查通过，包括实际不同SKU预览200与越权/伪造/匿名拒绝、私有队列/RPC、付款权限/归属/通知/健康。真实DB接续/退款/幂等/历史保护全部ROLLBACK/0探针，最终379付款/27会员/0队列，未现金支付或修改原学员权益/历史。
- 仅后端/数据库配套完成，未更新小程序/App包或微信提审发布。回执docs/work/backend-full-release-2026-10-14.md，永久小证据artifacts/backend-release/2026-10-14；D临时目录115.35MiB因自动审批blocked by policy拒删保留，可手动清本任务目录。远端余56GiB，旧镜像留回退。

## 全部本地代码已同步 dev/main（2026-10-14）

- 用户授权当前工作区全部代码与文档提交并合并主分支，业务提交79333c49包含33文件/1227新增/57删除，含套餐接续、SQL迁移及近期核查文档，已推送GitHub/Gitee dev/main，四远端回读一致。
- root typecheck通过，17定向测试文件111项通过；lint脚本未配置ESLint。未重复全量构建/测试、UI验收或修改既有测试；此前针对业务变更的类型对照和mini验收记录保留。
- 当前dev干净；另一个main worktree的历史暂存现场与旧本地main指针保留。仅Git远端同步完成，套餐接续线上迁移/镜像部署/小程序上传尚未执行。
- 本轮D任务临时缓存/日志约1.535MiB，现有Vitest报告目录约0.959MiB；缓存清理被自动审批blocked by policy拒绝，无绕过，任务目录可由用户手动清理。


## 付款表权限治理与正式收费同步完成（2026-10-13）

- 用户授权两支付表权限兼容修复及main/local收费同步，本人提审。业务32eef79f已同步GitHub/Gitee dev/main，只有本次安全补丁；换套餐等未授权发布WIP保留本地，未纳入镜像。
- main129/dev90各3/3新镜像9b696b9d...Ready；先更新服务再应用20261013143926迁移，两表RLS=true、PUBLIC/anon/authenticated无直接CRUD，service_role可CRUD，旧策略0。正常登录建单/查单、游客建单/清理经服务端，普通订单有归属校验；汇付金额/分账/结算不变。
- 隔离快照类型/91文件648测试通过，真实数据库角色/旧渠道/XPay幂等ROLLBACK通过。main/dev各17线上检查通过；公开REST401、本人查单200/越权403、正式通知验签200/无签403。原ERROR告警消除，378付款/26会员行/探针0/旧AI余额5，未现金支付或分账转账。二次管理SQL超时未冒充成功，最终实际REST/API/数据回读正常。
- Apollo main215/local216收费开关true/env0已发布，其余设置未动；本机local bootstrap实际回读通过，现网Key微信env0查询验签errcode0。沿用已上传1703付费包，无新UI/重复上传/代提审或正式发布；原env1沙箱手机记录不证明现金闭环。回执docs/work/payment-order-permissions-2026-10-13.md；D盘任务压缩包可清理，保留小型核验脚本/结果。

## 鞑靼余额逐笔核查（2026-10-13 23:03回读，只读完成、最早事实待确认）

- 用户要求核剩周与重复明细、先不改数据。5次数据库GET：累计已确认40周/prior_training_weeks0/pending_renew null，5月28日manual adjustment明确40；旧pending/1分占位订单不再次加权益。
- 7实例124执行，121 completed/3 timed_out。历史99完成、原每周4练，按现存完成记录扣24.75周；当前22完成、每周3练扣22/3。账面剩40−24.75−22/3＝7又11/12周约7.916667；这不是已经核实所有线下训练的最终实际结论。现算法历史扣30，当前实际显示余额2又2/3；上一轮10是阶段初始放行范围而非现在余额。
- 确认两D27接续版448cb43f/5343ed21各重复前15课3.75周，共7.5；两个D27完成北京时间7/19与7/20，14/14及12/12组各保留计一次，未找到相同day/start/completed签名复制行。
- 815e50ee32完成且每原周4条，后来日定义把D6/13/20/27/30/34/37/41/44/48/51/55认作休息而漏算12课＝3周；因此不能只把7.5直接加余额。
- 最早14f31192起点D10隐含5课，只有D1/D8两completed且各0/15组；D3/D4/D6无completed（D4超时）。按现存completed保留0.5，额外0.75待事实确认，已异步问用户。若确实前5课都做了余额7又1/6约7.166667；若两completed亦误操作且无其它训练则8又5/12约8.416667。未经确认不删除记录/赠周或宣称唯一实际余额。
- 当前剩14课＝4又2/3服务周，三口径均足覆盖全12周；按两completed口径全部练完还剩3.25周。逐笔124行报告docs/work/dada-entitlement-ledger-2026-10-13.md及证据artifacts/student-dada/2026-10-13/entitlement-ledger-*。
- 没有业务源码/测试、UI/正式业务接口、数据库/付款/权益/计划/历史/已读变更或发布；计算断言通过。新增证据/报告约0.71MiB加小状态文字；D:/cache/agent-tests/coachlink-dada-ledger-20261013只见tsx IPC目录，未删除，后续只清该任务临时目录。


## 鞑靼第11/12周缺失核查（2026-10-13，只分析已完成）

- 用户明确先不修复，只分析。GET核当前47457535计划完整84天/36训练日/94块，第11周D71/73/75、第12周D78/80/84处方均存在；完成22次。
- 现有函数精确重现40累计周−30历史扣算=10阶段周，maxAccessibleDayIndex70，接口过滤后70天/30训练日，吻合两端D70及22/30。
- 历史dcbaaa25→448cb43f→5343ed21接续版本都count_service且后两版start_execution_day27，旧前15课3.75周在后两版重复计入，共重复前缀7.5周。两个D27真实完成时间不同，不可擅合并/删除；初期另有计划日定义与执行dayIndex不匹配，未宣布正确全账户余额。
- 没有线上写、计划/权益/历史修改、正式业务接口或UI操作、业务代码修改、测试构建、提交发布。报告docs/work/dada-missing-weeks-audit-2026-10-13.md；小型证据artifacts/student-dada/2026-10-13。后续任何修复须用户重新明确授权；其它正在进行的任务保持。

## 教练换套餐入口缺失已定位（2026-10-13）

> 后续用户已确认旧权益耗尽后接续；本地实现已完成，见下面最新结果。初次诊断的未选择状态为历史。

- 新套餐订单快照/待生效队列与同套餐续费共用行锁，旧额度耗尽后按序激活，保旧历史、不拿新额度续旧计划。新服务待教练安排；迁移仅临时PG验证，未上线。
- 56定向单测/11实际SQL与服务周/并发检查通过，无新增类型错误；获准独立mini编译2899模块/9.9MiB，价格页PNG及新SKU mock支付入口核验。返回主页标签automator超时未验收，Web/App未UI核验；所有mock恢复/原storage不变/own窗口关闭。
- 临时PG三库fixture0行、服务停止/原5432保留；pgdata+wechat-dist删除被自动审批blocked by policy拒绝，无绕过。D任务目录约84.7MiB暂留，证据约0.16MiB；实施报告docs/work/coach-package-switch-implementation-2026-10-13.md。无提交推送上传部署/真实支付/线上权益写，其他WIP不归本任务。

- 截图699元旧套餐→329元引体套餐：小程序已订阅用户新购被导向续费，续费又拒绝不同产品；原套餐续费成功与代码一致。微信支付旧链路及业务订单 applyRenewOrder 只增加原服务周数，不切换产品字段。仅删客户端拦截会使新商品付款与旧权益混用。
- 过期状态仍受客户端限制；现有B1 end_date是预计完成日，不能承诺等一天解除。App同样限制，Web任选续费文案与后端不切套餐不一致。仅本地代码/迁移定义核查，未读取该学员实际线上记录或确认部署版本。
- 已询问旧权益耗尽后接续或立即切换，推荐前者但尚未批准。报告 docs/work/coach-package-switch-audit-2026-10-13.md；本轮只诊断与小型文档，无业务修改、支付、线上写、测试构建或发布。

## kk 倒立替实力推已保存（2026-10-13 17:18北京时间，正式回读通过）

- 用户核实实力推60kg资料基准后明确“OK，那就按照这个我们修改计划吧”，授权落实已列方案。本轮同active实例134f2c8c-4577-4586-b787-8a89f43fe427仅CAS更新training_days/updated_at；没有新建计划、动作、PR或重启进度。此前待确认状态现为历史，本次不再反复请求批准。
- D1/3/4/6真实已完成及全部9行执行快照/组数/视频/反馈逐字段不变，历史日定义原样。未来21倒立块处理：周四删除倒立、已有实力推处方不加量；周六W2–4/6–9新增2×6@9RM/180秒，W5/10为1×6@12RM/180秒，W11为1×6@10RM/180秒；W12删除倒立、不加推举保评估。共10个新周六实力推块放原动作最后，其它顺序原样，未来11个现有推举标题统一实力推。
- 清除仅相关未来日的失效“技能在热身后、力量前完成”行及倒立块，不清空其它必要备注。静态秒数/RPE逐组配置没有带入新实力推，新块为组数/6次/RM/180秒；个人实力推reference_1rm仍60，自动算重未固定公斤数。其它主辅项所有参数/备注不动，低杠脚辅助翻杠、固定硬拉机等保留。
- 实际核心逐组预览、模板有效性、60→65基准重算、DB全字段比对与正式kk API200通过；84天48训练日230动作块，48权益/已用4/剩44、已用1服务周/剩11周，训练day84可达。付款/订阅/资料/两动作库全部原样；API读取前核对无进行中训练/排队修订，读取后确认历史全行未变，实际UI未验收。无业务源码/测试修改、全量测试构建/安装/提交部署或发消息。
- 最新权威回读artifacts/kk-plan/2026-10-13/current-plan-readback.json/current-result.json；press-save-receipt为结果，press-student-api-receipt为精简正式接口核验，press-before-manifest记录保护哈希并复用已有10-08/machine-after.json完整备份，未重复生成大副本。旧10-07/08current仅当时快照，不得回滚覆盖当前。
- 子进程TEMP/TMP/TMPDIR=D:/cache/agent-tests/coachlink-kk-press-20261013，使用本地既有tsx、TSX_DISABLE_CACHE=1，未写C盘测试缓存。临时目录为空，无需清理；D余量46.12GiB，产物仅小型脚本/当前计划回读与摘要。详情docs/work/kk-strict-press-adjustment-2026-10-13.md。

## kk 实力推基准来源已核对（2026-10-13，后续已获准保存，以下为确认历史）

- 用户认可替换成实力推，并追问是否有实力推数据或能否推断。此次仅只读核对资料和正式个人动作库/已完成执行，未保存计划调整或写1RM。原资料明确1rm实力推60kg；当前学员实力推bb968ebe/canonical auto_1ad3a42904e5efc361682e90的reference_1rm=60（10-07录入），是提供资料基准，不是本轮推算或新测PR。
- 10-10已完成D4实力推记录为40×5、47.5×5、47.5×5；首组备注“出差，无自由器械，史密斯推举”，RPE为空，该次为器械替代而非自由杠铃1RM测试，不能拿执行e1rm54.9直接确认/否定或覆盖自由杠铃60kg基准。
- 可以沿现有60kg供此次自由杠铃实力推RM计算，无须从倒立/双杠推断。替换动作选择已认可，仍先向用户说明数据来源，未把本次询问当保存具体组次/强度方案的命令。待确认JSON已补来源，线上writes=0；不造PR、不改既有历史/基准。

## kk 暂停倒立的微调方案（2026-10-13，已获确认并保存，以下为提案历史）

- 用户转述kk暂不攻克倒立，拟替实力推或器械推力，并明确“改之前跟我确认一下”。此次先提供具体方案，确认前不写线上计划/动作库/执行/订阅，不沿用过去替换动作的写入授权。
- 只读正式最新实例134f2c8c，名称kk计划，updated_at=2026-10-07T21:57:45.636766+00:00；实际D1/3/4/6完成，其余有历史timeout行，不更改或重启。周四已有实力推，常规3×5@8RM/180秒；现有动作bd4fde76、学员reference_1rm60，直接复用而非再建动作。未来约21块倒立。
- 待确认建议：未来周四删除倒立、原实力推处方不加量；未来周六倒立替实力推，放原主项之后，W2–4/6–9为2×6@9RM/180秒，W5/10为1×6@12RM/180秒，W11为1×6@10RM/180秒，W12删除倒立不补推举保评估。同一动作未来标题统一实力推；只清除失效倒立/技能前置文字，保必要备注与其它计划进阶。
- 上述具体量是拟议微调，尚未获教练认可，不能当已保存结果。仅保存小型待确认JSON artifacts/kk-plan/2026-10-13/handstand-replacement-proposal.json，未复制大备份、未测试/构建/发布或发消息。D盘只读余量45.67GiB，新增仅小型方案与状态文字。下一步收取本方案确认或器械推肩偏好；获准后重新读实时计划/执行，保护任何新进度，再作单实例条件更新与回读。

## 正式收费切换条件预检（2026-10-13）

- 用户已允许安全确认后main/local一起配置、本人提审，覆盖前序仅dev范围；当前只读复查发现两付款表匿名全部读写且RLS关闭，main旧镜像还未同步原子发货/官方字段回调。
- 收紧权限前需兼容仍用anon的历史会员/支付宝/游客接口，待用户明确两支付表权限修复范围；不擅全局service-role或全库RLS，不更改汇付资金路由。本轮未改正式配置/镜像/Git main/DB权限，见wechat-paid-main-preflight-2026-10-13.md。

## 收费体验恢复执行（2026-10-13）

- 用户授权本地所有改动提交及新完整收费体验/dev后端，未授权正式小程序发布；汇付教练分账/main免费不变。
- 成功AI订单实际env1沙箱，余额2→5/paid/发货确认回读通过。新增原子会员商品发货与service-only回执SQL已执行/回滚探针通过，4类权益与同档续期/重复请求/失败不丢回执验证。
- 收费包编译COACHLINK_WECHAT_PAID_RELEASE=true；用户已发布dev同名true/env0+现网Key，实际微信验签通过。c51b4d13与当时全部本地改动已推两远端，完整1703包CLI成功（10001683B/main1931294B）、Next549页通过，仅dev89/3Ready固定8c01c933...，main128原免费/3Ready未改。11线上检查通过，0代理现金支付；自动化超时未视觉验收、资源收尾完毕。待后台核对1703体验标记、保存dev通知URL、手机正常购买现网复验；不能把上传或env0签名当现金闭环。见docs/work/wechat-paid-experience-2026-10-13.md。

## XPay 体验建单约束故障（2026-10-13，修复已生效）

- 0955手机报payment_provider CHECK，订单未创建导致查询disabled。真实云库uhlqribpagvklpqmcqvo旧约束仅alipay/wechat/null，原XPay迁移漏扩展；失败补偿的membership failed也被拒。
- 已事务扩展两个CHECK，保留原值/NULL，只追加wechat_xpay/failed；真实插入、失败态补偿、重复交易号拒绝、旧渠道/非法值验证通过且全部回滚，0探针残留/原376支付行25会员行不变。没有付款/发权益/改历史或角色，main128/dev88部署不动，无须新包。
- 用户原体验页重新支付，有订单号后再查询；未证明native支付和权益闭环已通过。迁移20261013081211_allow_xpay_payment_provider_and_failed_membership_orders.sql已执行，文件本地未提交；其他计划WIP保留。
- 单独发现原支付表RLS关闭与anon读写过宽，安全advisors3条ERROR，未擅改权限以免破坏旧购买/分账；需另做依赖审查/最小权限治理。报告docs/work/xpay-order-constraint-fix-2026-10-13.md。

## 华子计划最新状态（2026-10-12，最终要求已保存）

- 用户明确授权落地，05:04:13同12d58d20实例已保存回读核验。正/反底40、正/反顶38，撤销通用错误40；原主项进阶与各块辅项量保留、反手辅助逐块替弯举、高位保留、无器材划船删除，C5–8底停/W8 B各3×6落实。当前D1/D3定义清理旧引用，实际两份训练快照/14完成组/未知历史kg/私信反馈原样；8购买周/.25已用/7.75剩余不变，下一课D4 B。不新增计划/PR、不重启进度、不发消息。实际源码55动态块/35主项块及顺序/权益通过，最终报告huazi-aligned-plan-2026-10-12.md；以下未保存状态均历史。

- 最新W8 B已按教练“参考A”补齐原模板两块辅项：二头/锤式各3×6，180秒，清除缺值备注；单行CAS及回读核验通过，其他日/字段/C底停修复保持。学员整体计划未重存、历史记录未修改。证据source-template-w8-b-receipt.json。
- 用户最新确认保留两块弯举替换辅助（首周A3×8+3×8），W5–8 C仅底部暂停、华子参考40kg，模板“双暂停”备注错。已按其单独授权修正原模板e03c8c6a四个C日共8处备注并回读核验，其他组次/RM/休息/字段未改，未批量同步实例。华子整体计划未重新保存，训练历史/反馈/订阅未触碰。证据source-template-c-pause-receipt.json。
- 下方04:20保存版本已被用户否定，不能当认可成品。当前仅方案讨论，确认前不线上查询/写入或覆盖用户手动模板。普通负重引体即底部暂停；正/反底停40kg、正/反顶停38kg；反手是弯举替换辅助，高位按原模板保留，配片2.5kg倍数。辅助具体量及W5–8 C双暂停动作口径尚未定，不擅自减量/删高位；原执行、反馈与已用服务周须保护。

## 华子计划原位调整（2026-10-12，历史保存版本，已被否定）

- 按教练最新明确假设，标准正手外挂极限参考40kg，可后调、非实测PR；现有12d58d20实例改为56天引体专项，首周衔接历史，后七周每周三练。具体kg/组次/休息/校准见docs/work/huazi-8-week-plan-40kg-2026-10-12.md。本人e03c8c6a三练模板为真实参考，统一标准正手/W4减量/W8收尾与辅助降量为华子适配。
- 保D1记录/定义/反馈原样；D3零组超时仅按正常跳过流程改生命周期字段，动作快照等保留。25槽位/24意图训练/剩23，完成仍1，显示分母变化到4%。原购买8周及订阅整行不变，已用0.25/剩7.75服务周，没有重算1/3或重启D1。独立GET与实际源码负荷/顺序定向核验通过，无业务代码/发布或私信发送。

## 玄米指定教练计划库核对（2026-10-12）

- 最新交付改为docs/work/xuanmi-training-plan-2026-10-12.md，按用户参考案例W1D1排版、动作名藏链接；删三处高位及一处正握弯举，现32课106块，划船高级替代选项同步删。末段两项弯举源3×1沿用同模板前课3×6并明确披露。保玄米4次引体/双杠暂6次/负数辅助kg与三练轮转，未改成另一参考学员数据。旧V2首部已标历史。
- 后续用户确认引体4次，允许双杠默认6/8次（采用6），要求辅助机按负数公斤；问卷已写引体无不适/弹响、远期俄挺，不再重复问。完成可转发V2 txt，取枭双主项改良版本体32课，每周三课轮转约11周，保每课110块/36备注。原四练日历已调整，不称原八周原样。
- 现有小程序公式估算9RM引体-8.07/8RM双杠-3.31kg，首课按5kg辅助档用-10/-5kg；假设/普通与暂停反手变式首课校准/后续动态更新明确。V2在docs/work/xuanmi-training-plan-v2-2026-10-12.txt，数据转写核对无遗漏；未建档写库或业务代码/构建发布。
- 用户明确不得自编处方替代刘三乐、枭马葛模板；首版两周恢复+四周增力已撤回，旧文本/依据标记历史。原需求每周三练、健身房、恢复后增力、离线文本交付，不建档/写库。
- 已只读刘17/枭13完整教练模板、84动作、两位active问卷及枭训练知识；报告docs/work/xuanmi-coach-template-review-2026-10-12.md。完整两母版原文对照txt保留140日/210块及全部备注，未合并给玄米执行。
- 刘低次数耐力版前5周增加自重容量、第6周加负重；枭三练改良版首日5×7@9RM、双主项成品四练。此前尚缺入口的信息已按用户确认推进V2；刘版力竭/RPE9与导入歧义仍保留审查，不使用其争议块拼入V2。
- 视频约6次可见上拉，首下缺起点，不能据此判严格极限或动员不足。匿名暂停视频HEAD200但未完整观看。无业务代码/数据库变更、构建测试或发布；D单任务小型证据可单独清理，原附件保留。

## 体验者直接测试 XPay（2026-10-11，0955已上传、dev已部署）

- 用户纠正“仅管理员/平台白名单”增加负担，要求体验版所有正常登录体验者直接测试。已取消正常联调路由的is_admin限制，未绑定微信可进入并在支付时走现有绑定流程；不修改角色、不索取测试账号，不放开main或现网联调。
- 正式免费/汇付不动。源码3dbe2d2c同步GitHub/Gitee dev，89文件637项测试与mini2899模块/125页通过；官方CLI upload2026.10.11.0955成功9943271B/主包1934107B。dev88/3新摘要1657c0410d4a…Ready，main128/3原摘要未动。
- 公开dev普通非管理员JWT联调GET200，连同免费保护/认证/消息签名共8检查通过，无订单/付款/角色或权益写入。用户后台确认0955体验版后安卓正常微信登录→“我的→支付测试（沙箱）”，不用提供账号或测试目录；真实支付/权益待本人验证，未取得新UI截图。D任务约12.6MiB，119.7MB可恢复压缩源码副本已清理，远端/Git保留。

## 最新正常体验版与 XPay 沙箱（2026-10-11，历史0905；覆盖旧独立小包）

- 用户授权所有本地改动提交与最新完整体验版支付测试，允许沙箱/现网。618文件提交1f9ecf1b及构建目录修复aae107b6已同步GitHub/Gitee dev。官方CLI正常包2026.10.11.0905 upload成功，主包1934113/总5757294B；不是独立现金小包。
- 体验包新增仅dev/env1、真实微信绑定管理员可用的AI200分联调，支付后额度CAS+3及微信发货确认。普通免费/汇付购买分账和main不动。全量88文件633项通过；独立D构建完成，DevTools读取/截图超时无UI证据，任务窗已精确close/释放。
- 远程全源后端首次打包遗漏config/motion-effects-presets.json已补；Next编译与549页生成完成。dev87/3新摘要521a63213cf0…Ready，main128/3原3e446dd3d8e7…未变。8项上线只读/负向检查通过，dev公开通知真实Token签名GET200/echo一致；无订单、付款或权益写入。
- 唯一管理员账号尚未绑定微信，联调入口实际403；已请求测试账号昵称/编号，未擅自提高权限。微信后台需确认体验版指向0905，安卓真机支付/额度+3/重复查单发货确认仍未验证；UI截图超时不当作通过。

## XPay 受控现网切换（2026-10-11，历史独立现金小包）

- 按用户明确要求，管理员专用测试接口已读取 main 现网密钥/env0，现网凭据只读验证成功。仅首笔AI道具200分，明确现金收款/查单测试、不发实际权益；19离线切换检查+6线上只读检查通过，未真实建单/付款。
- 原 D:/cache/agent-tests/coachlink-xpay-20261011/miniapp 已为现网验证包；正常免费版/汇付不动，main128/dev86不变。测试服务 legacy 名 coachlink-xpay-sandbox-20261011 generation4、1Ready，dev /api/payment/wechat/xpay/live-test/ 返回env0；原sandbox端点失败关闭。
- 现金证据改远程700权限hostPath原子/fsync落盘，不TTL删除、不删除已付款记录；全局正式通知与权益商业闭环仍未完成。DevTools9421连接失败，无有效截图/扫码二维码，本轮未开新窗；等待用户原项目重新编译预览安卓本人确认真实2元付款与查单。

## XPay 安卓隔离联调（2026-10-11，历史）

- 用户构建测试授权已获得、安卓已确认。独立小包D:/cache/agent-tests/coachlink-xpay-20261011（构建162KB，含任务临时Node编译缓存共1487673字节约1.5MB），41+13代码回归及6线上接口实查通过；不是实际支付/业务权益验收。
- 临时管理员专用沙箱API在dev.coachlink.fit/api/payment/wechat/xpay/sandbox/，独立K8s coachlink-xpay-sandbox-20261011、NodePort30019、有限本地状态文件。main128/dev86应用镜像/正式免费版/汇付不变，未创建真实订单或发放权益。
- 原通知官方Env/WeChatPayInfo兼容和stable_token已修源码，未发布到普通main/dev应用；数据库约束/真实发货与退款未验完。独立测试查询只记录沙箱回执，正式通知未路由给此测试API，轮询notify_provide_goods尚需补足。
- DevTools连接/预览超时，无QR/有效页面截图；自己新开的fixture已close并核无watcher/9421，未改用户storage/mock。Windows截图非目标，不能当UI通过。须手动导入测试目录预览并安卓本人支付，再继续闭环联调；未上传体验包/提审/恢复收费。

## 自重与按秒训练记录修复（2026-10-11，本地，未发布）

- 三端自重存0外加kg，时间存actual_duration秒，新增组/快速完成保留目标，容量/海报/分享/e1RM排除时间组。
- 用户不清楚kk历史含义，只要求逻辑正确。未猜测/改历史，缺秒数显示未记录，公斤PR只读过滤明确时间动作；真实库零写入。
- 74代码回归通过，新增Web/App文件类型通过；扩大API/mini有既有类型问题，UI未验收。复查全局mrc/automator已安装，前次缺失判断错误；9420子进程监听FoodLink路径，3002是图片审查服务。旧mini构建不含本次修复，需新构建与正确CoachLink运行项目，无自动全量构建/发布。
- 报告docs/work/bodyweight-and-timed-training-fix-2026-10-11.md，AI指引tests/ai/bodyweight-timed-recording-regression.md；其他WIP保留。后续需新构建UI与配套发布授权。

## 单杠分享后端dev/main已更新（2026-10-10 JST）

- 用户授权先发布后端，前端稍后。两环境已更新OG的data.location读取与HTTPS代理下内部HTTP origin；小程序包未上传、无数据库写、其他WIP保留。
- dev generation86/3新摘要94d62a4d38ae…Ready，main128/3新摘要3e446dd3d8e7…Ready，各应用/sidecar0重启。main沿0f0c45d491e7…基线保留支付回调热修；节点无内存/磁盘压力。
- 正式/体验health/get/OG均200，国际丽都3图完整，两实际封面PNG均1742525字节且同SHA，现场图已查看。生成观测6.7～10.5秒，手机微信卡片仍需重新分享确认，不声称取图超时已根除。正式回调unsigned403、真实签名GET200/echo吻合。
- 首轮dev仅改层级仍无图，未推进main；进一步以HTTP/HTTPS转发对照定位协议问题。dev v2 registry首推后不可查，重推同一镜像并仅回收本任务未就绪pod，最终3/3正常；main随后完成。
- 仅对现有不可变镜像的唯一OG编译chunk制作小补丁，各原层/runtime配置保留，无本机全量构建/依赖安装/全量测试/已有测试修改。源码仍本地未提交；没有Git dev/main推送、没有移动latest/main/dev镜像标签。常规发布须包含OG与此前main支付回调源修复，并有意恢复部署标签策略。
- 发布记录docs/work/streetlifting-share-backend-release-2026-10-10.md；本轮D盘证据约3.6MB，deployment两张验证图可回收约3.5MB；远端小型审计约207KB保留，HTTP临时对照图及验证容器已清理，本机仅停止本任务卡住的只读Docker客户端。

## 工具可发现性与模块使用调查（2026-10-10 JST，方案建议）

- 微信计算器近30完整日1594保存/220账号，地图252新增点位/93贡献账号（跨端）；有实际业务使用，但小程序访问与游客采集缺失，不据此称地图最热门。410行为事件全web、feature_usage_stats0行；原表分页计数核验，未排历史测试账号。
- 建议地图/计算器快捷入口、最近使用与宣传直接落地；不隐藏训练处方/周历，名称与布局仍待定。抖音Taro基础存在，登录/地图/分享/独立输出需适配，主体/类目/地理权限/挂载未确认。
- 仅只读与小型文档/汇总证据，未改业务、构建或发布，未做UI截图验收。详情docs/work/tool-discovery-usage-and-douyin-2026-10-10.md。

## 单杠分享关闭符号与封面（2026-10-10 JST，本地已修，未发布）

- 用户反馈分享弹窗右上角“脑”字及聊天卡片无图。源码关闭符号实际为“脳”，已恢复“×”。国际丽都点位4ecf1463-3da2-4d20-8734-6f3089433378正式API有3张图，首图CDN200/JPEG，约0.5秒；不是照片丢失。
- 原分享走动态OG，正式/体验图片200但生成约4～8秒。OG把get接口data.location误读为data，因此当前真实封面“暂无现场图片”；带image的对照封面可显示真实现场图。微信灰卡究竟是超时或其他客户端取图失败，没有真机日志，不能把它全部归为此层级错误或用户网络。
- 本地最小修改3文件：关闭符号×；有图分享直接用已有现场图（列表/详情复用同一helper）；OG读取data.location，无图继续品牌封面。3文件语法检查、7项定向逻辑检查、diff检查通过；不称完整类型/构建/UI通过。
- weapp-devtools环境检查：本机无运行的微信开发者工具进程，无9420～9429自动化监听，mrc不在PATH；CLI在D:/software/微信web开发者工具/cli.bat。未占用/新建窗口、改storage或mock。按最新磁盘保护未自动全量构建，当前包实际UI/微信聊天分享未验收。
- 未提交/推送/部署/上传，线上仍旧版。需后续本地构建和DevTools/手机重新分享验收，再经发布授权同步后端及小程序。报告docs/work/streetlifting-share-diagnosis-2026-10-10.md，证据artifacts/streetlifting-share/2026-10-10约1.8MB；本任务临时目录仅verification.json，转存后清理。

## kk 自重与静态训练记录核查（2026-10-10 JST，只读完成）

- 正式库确认kk与枭马葛有效订阅、kk计划归属一致；实例134f2c8c-4577-4586-b787-8a89f43fe427。D4面墙倒立处方2×20秒/无公斤负荷，实际10-10完成记录保存3×50kg×20次，缺actual_duration，与用户海报16组/89分钟/5338kg吻合。
- 两端空计划重量被视作必填，没有明确自重入口；0公斤外加负荷底层可存，小程序摘要可显示自重。时间目标未驱动执行表单，20秒被抽成20次。倒立误计3000kg，排除该项剩2337.5kg；还写入e1RM85.5及AUTO_STATE，学员reference_1rm仍null。不能把50kg当真实负重或73kg体重；非教练/学员归属问题。
- 本轮仅核实，正式DB客户端强制GET，未修改代码、计划、执行/极限、登录态，无UI接管/构建/测试/提交发布。后续修复应覆盖自重入口、静态秒数、两端表单、容量/海报与e1RM；历史更正需确认真实组数/秒数，不擅自回滚。
- 报告docs/work/kk-bodyweight-recording-diagnosis-2026-10-10.md；小型证据artifacts/kk-training-diagnosis/2026-10-10。已有其他WIP保留。

## 器材点位统计1000上限（2026-10-10 JST，本地已修，未发布）

- 正式只读查询：列表全部1126，地图有坐标1107，stats仅1000。根因stats未分页，图片/描述/区域等点位统计连带漏算；19个无完整坐标点位不显示地图是正常口径差异。
- 本地stats已每500条完整读取、稳定id排序、批次失败返回错误；4项定向回归及类型检查通过。没有小程序文案/布局改动、数据库写、全量构建/测试或部署。入口保留“单杠地图”、上传按“器材点位”建议待用户选择。
- 详情docs/work/streetlifting-count-and-copy-audit-2026-10-10.md。正式版数字需后端发布后更新。

## 本地用户 ID 模拟工具（2026-10-08 JST，未发布）

- dev:debug-login 启动 loopback3003 独立后端，weapp:debug-login 生成 dist-local-debug；UUID+一次启动配对码，本地专属一小时凭证，正常/生产服务拒绝。登录只读，训练操作仍写真实数据，禁止支付/管理/绑定与调试后台任务。
- 真实 DevTools 登录6196/首页D78/刷新保持/退出恢复已验证，借用窗口原配置和storage恢复。截图超时，无视觉截图证据；没有训练填写/完成/取消、上传或部署。
- 83文件588测试、Web548页、mini2906模块构建通过；详情 docs/work/local-user-id-debug-login-2026-10-08.md。临时3003后端已停止，使用时重新启动取配对码。

## 训练入口统一修复（2026-10-08 JST，本地未发布）

- core规则接入Web/mini/App当前实例主链；明确预览/开练/记录意图，云端确认后按状态开放能力。纯休息可跨到D78，有任务休息不可跨；旧next-day归并，完成事实优先，失败可重试。
- 缓存回写同步进度和实际完成日期，旧响应/快照不得覆盖新确认结果。38项新增回归、总558测试通过，Web547页/mini2903模块及124页构建通过；标准/App typecheck通过，扩展历史类型问题另列，不称全库全绿。
- 按用户安排留本地UI手测，无6196真实数据改写/提交推送/发布；独立产物apps/wechat/dist-training-entry。报告docs/work/training-entry-unification-2026-10-08.md。

## kk 腿弯举替换为固定硬拉机（2026-10-08 JST，正式数据已完成）

- 用户确认学员kk健身房无腿弯举设备，提供挂片式固定硬拉机照片，要求替换。基于最新正式实例134f2c8c-4577-4586-b787-8a89f43fe427于03:35:54UTC的内容，原位将D4/11/18/25/32/39/46/53/60/67/74共11块坐姿腿弯举改为“固定硬拉机”。动作库无对应动作，新增明确器械独立身份并同步教练与kk库。
- 教练动作227ce878-67a9-44ff-89dd-b6f2a5f1b2cd、canonical custom_8664136c-022a-49bd-8e77-2ac8e0d22806；学员reference_1rm=null，不套用原杠铃硬拉140kg，不填未提供重量、不造PR。原腿弯举库项保留，仅换计划；未将设备照片当动作教学视频。
- 原组数/次数/RM/休息/排期/必要备注全保留，减量W5/10仍1组10次15RM，其余2组10次12RM，组休120秒。84天48训练次241块12动作。当前已开始训练：D1completed、D3in_progress，全执行行与保存前深比较一致，无重置或改历史。
- DB逐字段及正式kk计划API200回读通过，11处新动作/处方一致，器械未显示杠铃基准或虚构计算负荷；付款/订阅/资料/旧动作全保留。实际UI未验收，沿用户手测偏好，无业务源码/测试改动、提交或发布。
- 私有快照/条件写入日志/正式回读在artifacts/kk-plan/2026-10-08/machine-*；10-08和旧10-07的current-plan-readback.json/current-result.json指针均已刷新，不能用旧0执行状态覆盖当前。详情docs/work/kk-leg-curl-machine-replacement-2026-10-08.md。

## 训练运行复核结果（2026-10-07）

- 用户授权仅当前登录学员“计划执行者4215”与枭马葛的订阅关系及临时模板计划测试；实际身份已从正确小程序 runtime 核对。原 inactive 关系临时启用，复制现有模板做两轮检查；首次加载超时已回滚，第二轮首页/讲解/逐组展开/月历/恢复无计划通过。
- 两次临时计划均删除、0 execution，订阅全字段恢复；教练资料与其模板、学员动作库逐字段未变，无其他账号/订单/支付/消息变更。测试缓存恢复且云端复读回无计划；临时 s1 窗口官方关闭成功。9420是FoodLink，不再使用。
- 复查补修 Web 普通完成后状态未更新、快速完成后逐组未回填，以及缓存清理异常误报服务端操作失败。root typecheck、520测试与Next547页构建通过；lint仍只有未配置提示。
- 已验证小程序真实有/无计划首页、预览讲解无新 execution、逐组安排、月历。Web CUA连接超时且web-devtools skill缺失；取消/完成实际UI、PR/上传持久化、真实视频播放、多教练并存均未完成验收，不称双端全部通过。
- 本地未提交/发布。详情 docs/work/training-runtime-review-2026-10-07.md；证据 artifacts/today-training-redesign/2026-10-07/runtime-review。后续先解决Web浏览器连接，再按限定数据范围补其执行流程验收。
## 训练首页与执行页双端对齐（2026-10-07，本地实现完成，待用户手测）

- 用户发现 Web 实时执行缺取消入口，要求全面核对、完善方案并开始执行；本轮已修改本地源码，未提交、部署或上传小程序。先前用户自行本地测试的安排继续有效，本轮没有接管/新开验收窗口。
- Web 与 mini 及取消 API 共用空训练判断：仅无组数/数值/备注/PR/视频的进行中计划训练可取消；保留后端关联数据检查与条件删除。成功后才清相关缓存/计时；Web 增取消与保留记录返回入口。即兴训练不复用计划删除接口。
- 小程序首页恢复常驻周历、明确月历、处方/必要备注/逐组安排；预览与执行用同一只读讲解入口，传当前动作和当次要求，缺上下文时按计划只读兜底；Web 预览也可读说明和视频。旧 V3 位图未重绘，不是完整执行页依据。
- 原执行表单全部保留，显露本组上传视频入口和备注标志；完成组在原可更正权限下补视频，强制只读不可写。两端即兴视频改接既有即兴持久化；补齐即兴 RPE/进步组云端字段及清空备注。Web 休息计时补 +/-10 秒和最小化。异步保存/上传期间保护组选择，讲解按实际被点动作取要求。
- root typecheck、既有 78 文件/520 测试与最终 Next 547 页构建通过；20 个无网络取消场景通过。lint 脚本仅提示未配置。mini 2898 模块编译和串行补文件通过，独立输出 apps/wechat/dist-training-v3，124 页 JS/JSON/WXML 完整；mini 原有428类型问题未消除。构建不代表实际界面/视频/跨端回读验收。
- 详细方案及用户验收步骤 docs/work/training-home-and-execution-parity-2026-10-07.md；证据 artifacts/today-training-redesign/2026-10-07。用户在根目录 npm run dev，另终端 npm --workspace apps/wechat run dev:weapp 更新常规 dist，开发 API 地址应对应本地 Web 端口。
- 其他 WIP、既有测试、线上数据保留。下一步用户手测取消双端回显、预览不误开练、组 PR/视频保存后回读、完成后更正/只读权限；实际上传/播放/数据库回读未验证，不能声称全部链路已经验收。
## 训练首页 V3 重设计（2026-10-07，新稿待评价）

- 用户提供群聊三张和 Web 训练页截图，否定 V2 过度精简：周历难发现、开练前看不到完整动作处方/教练要求和讲解，用户因此转 Web。不得继续把 V2 极简呈现记为已接受目标；减少重复层级的原目标仍保留。
- 源码确认 mini compact 力量行仅名称/组数且整行进执行；模型已有处方/note/detail/demoVideoUrl。Web 显示处方/备注/视频；mini 执行有动作要点/演示但只读 url，而两端预览模型允许 url/video_url；详情只靠临时缓存。属于展示/入口/字段口径问题，未验证真实视频或断言所有用户数据缺失。
- V3 同一方向三状态：常驻周历与明确月历入口、完整处方与必要教练备注、明确动作讲解；预览看讲解不创建执行/启动计时，执行中同入口返回保留当前组。多计划与完成后执行页生成打卡图、无计划即兴/找教练等已确认规则保留。
- 新稿 artifacts/today-training-redesign/2026-10-07/home-v3-flow.png，说明 docs/work/today-training-home-v3-redesign-2026-10-07.md。封面生成示意不能作真实教学素材，日期/训练数据非实时账号安排。
- 本轮仅用户截图/源码对照、设计图片与文档；无业务或测试改动、构建、UI操作、数据库写入、提交推送或发布。用户尚未评价 V3。下一步先收取对首页信息密度与预览→讲解→执行路径的反馈，再按确定方案落地并由用户手测；其他 WIP 保留。
## kk 备注清理纠错：保留必要内容（2026-10-07，已恢复并回读）

- 用户更正“只把废话去掉，不是把全部备注清空”。此前清空566个note是代理误解，不能作为长期偏好。已从删除前最新线上备份恢复训练日/休息日/减量评估安排、可选有氧及具体暂停/余力/特殊末组休息/技能执行要求；84每日备注、155动作块保留简洁必要备注。
- 教练已手改的首日4项params备注逐字恢复，两层note统一，避免顶层旧重量说明残留。其余备注去参考公斤数、重量校准解释、重复教学、记录提醒、套话和字段已写明的重复数值。此前由教练手动删除的description/execution_notice继续为空，未擅自恢复。
- 只在当前最新实例134f2c8c-4577-4586-b787-8a89f43fe427补必要note，无整份旧计划回滚；动作/顺序/正式处方/线上动态重量/用户最新修改、反手外挂1RM30与海豹划船60、订阅付款资料保持。数据库逐字段比较与正式kk API200回读通过，仍84天48次241块12动作0执行。实际UI未验收。
- 权威回读current-plan-readback.json/current-result.json已更新；证据essential-notes-before/patch/review/journal/after/student-api-readback/result，位于artifacts/kk-plan/2026-10-07。详情docs/work/kk-essential-notes-restored-2026-10-07.md。无业务源码/测试变更、提交或发布。

## kk 计划备注全部清空（2026-10-07，误删已纠正，参见最新条目）

- 用户明确否定面向有训练基础学员的多余动作说明和备注重量，要求不写备注。按最新线上02:39:38实例134f2c8c-4577-4586-b787-8a89f43fe427原位删除全部566个note字段：每日说明、动作组顶层备注、params备注与嵌套备注；description/execution_notice为空。保留用户已有第1天修改，未用旧载荷覆盖。
- 正式处方动作/顺序/组数/次数/RM/休息/秒数/逐组配置/在线动态重量完整保留；84天、48训练日、241块、12动作，0执行。个人动作库极限、订阅付款问卷资料不变，不改全局动作详情。
- DB逐字段回读与正式kk计划API200验证通过，学员接口无note字段，反手外挂1RM30kg/海豹划船60kg仍正确。实际UI未验收，依用户默认手测。备份日志/正式回读在artifacts/kk-plan/2026-10-07/no-notes-*；current-plan-readback.json/current-result.json更新。无业务源码/测试改动、提交或发布。
- 后续未经教练明确要求，不为kk计划补动作教学、参考公斤数、恢复/记录/校准等自由文本备注。详情docs/work/kk-plan-no-notes-2026-10-07.md。

## kk 深蹲动作与两项1RM已纠正（2026-10-07）

- 用户明确要求删除重复的“杠铃背蹲”，改用教练既有正常深蹲，并补反手负重引体外挂1RM30kg、海豹划船1RM60kg。唯一active实例134f2c8c-4577-4586-b787-8a89f43fe427原位替换29块为既有“负重深蹲”（e44ef1d2-374c-4b57-aacb-b1538258f1b9），标题后缀保留；原位只改动作身份/名称。
- KK个人动作库反手负重引体（底部暂停）reference_1rm=30、海豹划船reference_1rm=60；只写教练提供的基准，没有伪造PR/执行。同步既有负重深蹲canonical身份到KK库，深蹲1RM仍null。
- 替换后复查模板/计划/执行引用为0，精确删除本任务新建重复coach动作371b6474-9852-4a74-8882-04e6107d2eb7及KK副本3b7220d7-7d04-481c-9abe-8911157d9342；未删除共享canonical或其他动作/学员数据。
- 基于最新线上02:21:51版本，保留用户已改的第1天；力量处方、排序、84天/48次/12动作241块、动态线上算重与付款问卷不变。正式KK接口200、全部29处新身份及1RM30/60回读通过；0执行/48权益至day84。数据库逐字段比较确认其它资料/库项不变，实际UI未验收。
- 快照/条件写入日志/正式回读在artifacts/kk-plan/2026-10-07/normal-action-*；当前权威回读current-plan-readback.json/current-result.json已更新。无业务源码/测试修改、提交、发布。详情docs/work/kk-normal-actions-and-rm-2026-10-07.md。

## kk 十二周计划已简化（2026-10-07，已写入并验证）

- 用户明确删除仰卧中空支撑、哑铃旋后弯举，并授权其它合理调整。已原位更新唯一active实例134f2c8c-4577-4586-b787-8a89f43fe427；指定动作全期22+11块移除，前水平12块/俄挺11块暂缓。本阶段12动作/241块，84天48训练次/周一三四六与第5/10减量、第12评估保持。
- 保留力量主项的组数次数RM休息、重组/降重逻辑和线上动态算重。周三正手引体后先深蹲，再反手引体与划船；倒立与脚辅助翻杠移至热身后，各最多2组/RPE≤5，末组后3分钟进入力量。计划动作组标题改为“靠墙倒立（面朝墙）”“脚踩地辅助翻杠”，原动作库身份/名称保留，说明用直白执行语言。旧练后15分钟及已删除动作提醒已清理。
- 原处方比较/84天4次每周/模板与真实逐组预览检查通过；数据库逐日深比较、正式kk接口200/新顺序新字段一致，48权益可到day84，0执行。订阅/付款/问卷/资料/既有动作库全文不变，无永久动作删除/聊天发送/业务源码测试修改/提交部署。实际UI未验收，按用户默认手测。
- 完整变更前快照simplified-before.json、条件写入日志simplified-save-journal.json、正式回读simplified-student-api-readback.json；当前权威回读current-plan-readback.json/结果current-result.json（均在artifacts/kk-plan/2026-10-07）。旧plan-payload.json/saved-result.json是最初录入版本，不能拿旧脚本覆盖当前简化版。后续依据实际技能表现与训练反馈再决定是否恢复前水平/俄挺，不自动恢复。

## 汇付公司资金与资料核对（2026-10-07，只读完成，银行入账待证据）

- 用户随后截图证实官方资料的商户控台路径被网站安全防护“已阻断”。已说明此前只验证出处，未验证可登录；待原入网客服/官方管理员核查当前入口与请求ID，不绕过安全阻断。用户想提现公司卡并问可行性，尚无确定金额/申请，0资金动作；需保留教练未分与退款准备金，不能全额划空现金户。

- 用户找回资料并核实公司抽成，查到微信资料包/合同/完整原聊天及个人ZIP备份。真实汇付查询验签成功：平台现金户1,218.69元、基本户40.68元，绑定公司工商银行尾2085；本地平台收入35条967.80元，含不同支付通道，不能等同当前利润或银行到账。当前教练净额转出，公司份额留汇付；历史聊天自动提现关闭。另499元仍在7天退款保护期/10-11结算，不能全额取现现金户或自动划空。公司银行入账未验证，待商户控台结算记录与银行流水；0资金动作/0业务写/无发布。文档docs/work/huifu-company-funds-check-2026-10-07.md。

## kk 计划重量按线上计算（2026-10-07，最终纠正已完成）

- 用户最新明确“数量变化没事，就按照线上来”，此处承接首周参考重量自动计算差异，授权重量采用线上RM规则，不改变原计划组数、次数、RM、休息与排期。
- 已在同一active实例134f2c8c-4577-4586-b787-8a89f43fe427原位取消首周9块fixedLoadOverride/fixedWeight/固定逐组重量，恢复动态RM；初始公斤数仅备选参考，W2-W12不变。原付款问卷不变、0执行。
- 独立原文数值/静态预览检查通过；正式kk身份读取HTTP200，所有84天/48次/字段/顺序一致，首周9块结果与线上实际1RM+体重的计算公式一致。前面“首周必须精确锁重/需发布固定重量保护才能交付kk”的判断已被本用户明确选择覆盖；不能擅自再锁公斤数或为本任务发布既有编辑器改动。实际UI未验收。
- 最终载荷与回读在artifacts/kk-plan/2026-10-07，修改前备份online-calculation-plan-backup.json、条件修改日志online-calculation-journal.json、结果saved-result.json；没有业务源码/测试改动、消息、提交或发布。

## kk 十二周原计划已录入（2026-10-07，数据和正式学员接口核验完成）

- kk（06de1d96-7c42-4291-817a-42d8720ca0b7）新增唯一active计划134f2c8c-4577-4586-b787-8a89f43fe427；沿用枭马葛的12周线下订阅9d156e8c-3383-4442-8b38-404ae7e93784。84天/48力量训练/36休息日/297动作块/16动作，周一三四六；技能同日，周二五有氧可选，周日休息，第5/10周减量、第12周评估按原文。
- 用户强调结构化格式与自然教练文字。全源数字独立逐项检查、实际逐组预览函数、数据库逐日深比较通过；清理complete_plan等来源标记和代理套话。68静态块持续时间+time逐组处方，不误作次数/RM。必要9教练动作、16学员动作同步，给定参考1RM仅引体30/双杠30/实力推60/硬拉140；深蹲/反手/辅助为null，不制造PR。
- 正式学员身份读取HTTP200，84天/48次/所有源字段与顺序一致。初查旧API忽略fixedLoadOverride把7.2重算7.65；已对首周9参考块用fixedWeight配置+逐组RM标记兼容，再次正式读取9项公斤数精确一致，W2-W12原样。权益48次/可访问dayIndex84，0执行；付款/原问卷/个人资料/原个人动作全部不变；无消息发送、业务源码/测试改动、提交推送或部署。
- 实际UI未验收（依用户默认手测偏好）。已有Web编辑器保留指定重量的源码修复仍未发布；旧编辑器打开编辑仍有自动重算风险，不能把本次数据与正式读取核验等同旧编辑器交互已修。源/载荷/写入前备份/幂等日志/兼容修正/正式回读在artifacts/kk-plan/2026-10-07，文档docs/work/kk-twelve-week-plan-2026-10-07.md。

## 热身研究员3510的8周引体计划（2026-10-06，纠错后已回读，Web修复待发布）

- 枭马葛提供完整8周计划并要求写入截图学员。匹配唯一学员91e98307-e215-4e6e-afea-8f2aa9f1e2f0、有效8周订阅6daead39-f2d9-4405-b607-b53dc19ea77e；原当前计划71e14c09-7421-4f45-b738-1d64c08a3486未执行。
- 首次录入把教练固定外挂重量误交给RM自动换算、自重逐组次数未落数字字段、休息备注重复，用户明确否定。已按原表重写18个负重块的RM/外挂重量，并加`fixedLoadOverride`；自重长组拆为逐组数字，常规自重次数全部明确，组休只用字段。唯一active/0执行/订阅及付款不变，逐日回读深比较通过，权益可到dayIndex56。
- 学员动作库现有负重引体`reference_1rm=50kg`已核验保留，是教练计划基准而非系统实测PR；体重71kg。Web编辑器、实例读取、执行启动本地代码已修以保留精确重量；独立浏览器真实组件截图与改次数交互通过，正式站尚未发布此代码。W5–W7容量适配仍需教练结合训练复核。详情docs/work/student-3510-eight-week-plan-2026-10-06.md。
## 全量发布（2026-10-06）

- 用户授权当前本地改动提交、Web/API 前后端更新与微信体验版上传。源码 `b94f8e07` 已推 GitHub/Gitee main/dev；CoachLink Supabase 器材列迁移单独应用，实际 REST 字段读取通过；Nginx SSE 配置已重载并在部署仓库提交 `f718b10`。
- CCR `b94f8e0`、`dev`、`main`、`latest` 摘要一致：`sha256:29b98d04770c7e1c25bbafc63c7fd6dba432c70d54d9f81c31b28eabd157d11c`。K8s main/dev 各 3/3 新镜像 Ready；两域健康、登录、器材双杠筛选均 200，筛选数各 240。
- 小程序体验版 `2026.10.06.0614` 官方 CLI 上传成功，未提审或正式发布。新包整体 DevTools/手机交互未验收：9420 无自动化连接、9422 窗口归属不明，未抢窗口；此前分项局部验收见各自文档。
- 网页微信托管支付项目号 `HUIFU_WEB_PAY_PROJECT_ID` 在已检查的本机 Apollo 配置缺失，真实付款仍待项目号、商户授权、回调/到账验收。详情 `docs/work/release-2026-10-06.md`。

## BlessingLSH 新四周阶段（2026-10-06，标准极限确认，V2建议待评价）

- 用户确认自己主动换过旧计划，并要求再做一个月、动作极限约40–45kg。按标准负重引体额外挂重40kg下限准备4周12次/D1-D4-D6，三周逐步推进、末周减量复测；估计没有写成已完成PR，动作口径待澄清。
- 最新用户确认标准引体极限，否定V1技术/辅助编排过简。已读完整原计划与模板，原阶段有高位引体及首组/回退；V2完整建议补成D1负荷、D4容量、D6自重高拉质量/轻顶端控制，辅助动作各定职责/递进，三周34组/第四周20组回收疲劳，不自动极限复测。docs/work/blessing-four-week-plan-v2-2026-10-06.md。动作口径待澄清已解决；V2未获评价/未覆盖账号V1，本轮只读、新实例仍0执行，原权益保持。
- 用户追问来源与合理性；这是代理自行编排，并非选用《常用引体8周计划》等现有模板或ACSM成套处方。原主项为底部/顶端暂停，转标准主项及40–45kg动作含义未确认、实际RPE缺失，适配待复核。只读确认新阶段仍active/0执行，没有因疑问擅改/撤销账号。
- 账号已建立唯一active计划864348f6-9541-4735-bfe5-98e856a38ef7，start_execution_day1/start_date=null/0执行；固定重量与逐日数据回读深比较通过。历史四版内容与状态、30次完成ID保留；两条缺失动作库同步，reference_1rm=null。
- 原订阅12周/金额套餐支付数据保持。现有算法约剩1又1/3周，只开放新计划前4次，完整4周权益未补足；按实际记录约剩2周，既有接续重复计数未修。异步问赠送补足或保持权益待回复，不把计划内容保存当作服务赠送授权。
- 文档docs/work/blessing-four-week-plan-2026-10-06.md、证据artifacts/blessing-next-plan/2026-10-06。仅训练数据与规划审计，无业务源码/测试/消息/提交发布或UI验收，其他WIP保持。

## 器材筛选本地完成（2026-10-06）

- 单杠/双杠/云梯多标签、AND筛选和旧描述“据描述”候选已实现；上传人工标签/清空优先，不改旧文本。列表/附近/地图筛选相同，复用60天缓存和已有附近照片。
- nullable equipment_types text[]迁移未执行。507测试、root typecheck、Next547页、mini2900模块通过，mini新增类型错误0；实际只读API分页/map一致与独立DevTools多选/地图往返/表单/草稿验收完成，storage恢复，DB写0。
- 未提交推送、部署、上传或提审；后续必须迁移/后端/小程序配套发布，真实保存与手机未验收。详情docs/work/streetlifting-equipment-design-2026-10-05.md。

## BlessingLSH 订阅与训练核查（2026-10-05，已完成，只读）

- 用户要求查计划为什么完成、订阅时长/到期、何时购买和累计训练；没有要求改数据。精准匹配学员b5380575-a083-42d8-8db1-497fd81b1066/订阅3a71d6a5-924b-4ffb-95c1-c4be34e5b625/枭马葛。7/17微信paid699元，12服务周，订阅仍active。
- 最新8周24训练日计划10/3完成，无后续active计划。截图24/24=本版23真实执行+1接续；历史实际累计30次/310组，休息日timed_out不计完成。
- 存储预计end_date12/12；当前模型displayEndDate=null，Web列表回退旧快照，不能视为固定到期日。现有算法剩4次/1又1/3周；两个历史接续重复计2次份额，按真实30次和原每周3练应剩6次/2服务周。已诊断，未修改权益/计划/源码。若后续要求修复，应精准核对接续来源并避免重复扣减，不沿用本次只读请求作改库授权。
- 文档docs/work/blessing-subscription-audit-2026-10-05.md，脱敏证据artifacts/blessing-subscription-audit/2026-10-05/evidence.json；既有支付/onboarding WIP及pending上传保持。
## 附近结果现场照片本地完成（2026-10-05）

- 用户纠正了代理误读：上方附近结果缺照片是本次问题，下方河北等属于其他地区，不作为附近排序错误证据。
- 本地附近结果已增加真实照片封面/数量/全相册，复用公开详情与60天缓存、失败重试；仅修改该页tsx/scss，不改下方其他地区/距离排序/筛选/半径。typecheck/477测试/Next547页/mini2897模块通过，mini历史435新增0。
- 官方工具清编译缓存后实际“2 张图 · 点击查看”已读取、附近照片点击成功，真实五个详情照片数据入缓存；定位模拟已恢复、无接口mock/DB写。新截图ETIMEDOUT，不能声称照片像素或原生相册视觉已验收；证据artifacts/streetlifting-nearby-photos/2026-10-05。
- 无本次提交推送/上传/部署授权；此前合并列表方案撤回。既有支付/onboarding修改与照片上传pending保持。

## 附近列表和照片分离已确认（2026-10-05，初步诊断已由上方用户纠正收口）

- 两张截图反馈核查：附近仅地图点位最近五条，照片分页独立按上传时间/图片排序，定位未影响照片列表；地图入口未接完整点位照片，附近无距离上限。
- 正式公开API只读核验截图九峰公园1图、儿童运动乐园1图、檀香新村2图。照片已存在，缺展示入口；未复现手机或核验图片URL。
- 已询问直接修改还是先给方案，未收到选择；本轮仅诊断与记录，无业务改动/发布。建议附近完整卡片、距离优先、范围及全部浏览切换，尚未作为确认设计。docs/work/streetlifting-nearby-feedback-2026-10-05.md。

## 小程序登录引导取消已本地修复（2026-10-05）

- 审核截图标记完善基础档案左上角，根因是登录reLaunch无返回栈、首页未完成档案守卫又重定向回表单。仅改该页面三个文件，首次取消/首页先清本地登录态到游客首页，编辑返回保留登录/有个人资料fallback；取消不校验、不保存档案，忽略退出后的bootstrap回调。
- root类型检查/477测试/Next547页与最终mini2897模块构建通过；mini435历史错误、无新增，退出函数8隔离检查通过。实际DevTools已验证首次取消/首页与刷新无循环，Mock及storage恢复；最新状态栏布局/编辑原生路径因WXSS编译/官方p is not defined、9420自动化timeout未验收。未提交推送上传提审部署，docs/work/wechat-onboarding-cancel-2026-10-05.md。

## 精细器材筛选已核对现有数据（2026-10-05）

- 用户提出从描述提取单杠/双杠/云梯等器材并增加筛选，未来扩展。只读正式公开33页990唯一点位，有描述762/无描述228；当前无专用器材字段，名称/描述提及单杠501/双杠285/云梯98/肋木架124/吊环15，含否定或不确定语气，不能直接当器材存在事实。
- 已生成逐点候选与原文证据及docs/work/streetlifting-equipment-design-2026-10-05.md，无器材业务代码/DB写/上传部署。建议多标签、人工确认、后端先过滤再分页、地图列表缓存一致；新控件需新小程序包。Web支付WIP和照片上传待确认保持。

## Web 教练支付双渠道已本地实现（2026-10-05）

- 用户授权参考 jianwen-community/tokenhub：网页教练新购/续费增加微信 Native 扫码，与支付宝同时可选；保留汇付收款、原订阅履约/结算和平台免费策略。
- typecheck/477测试/Next547页、15项隔离后端与5项真实组件模拟浏览器路径通过；无真实订单/扣款。Apollo必要汇付配置和教练开户就绪，商户Native权限与真实支付未验收。
- 尚未提交推送/部署，不改变小程序或已有测试。E2E缺隔离数据库，仅列举不视为通过。详见 docs/work/web-coach-wechat-payment-2026-10-05.md。

## kk微信线下收款订阅补录（2026-10-05，已完成）

- 用户确认微信线下转账1399元、3个月全能项目并授权补录。精准匹配kk用户06de1d96-7c42-4291-817a-42d8720ca0b7、枭马葛02db8c38-dc64-490b-9b78-e002a13811df及原订单9fc414d4-ddac-4ccd-91fb-b08708e31e7c。原订单金额139900分/tier3/vip/12周与要求一致，无原订阅。
- 已建立唯一active订阅9d156e8c-3383-4442-8b38-404ae7e93784；原订单paid并关联该订阅，payment_method=offline、payment_confirmed_by=coach，payment_data.manual_receipt明确channel=wechat_transfer/139900分/3月/12周/coach_statement及固定操作ID。未创建平台支付流水/资金划转/钱包余额或消息。
- 10题问卷从原订单原样迁移到订阅，两份hash与修改前一致。首次训练前start_date/end_date保持null，3个月沿用原购买换算为12服务周，不凭当前日期预扣自然月。真实训练计划暂无（0条），下一步教练在我的学员/kk详情制定训练内容和排期。
- 修改后权威数据库读取核验：对应双方唯一订阅、active/paid关联、12周/139900分、VIP、教练确认、问卷hash一致、无训练计划。仅业务数据补录，无页面/源码改动；未执行UI验收，前端可刷新我的学员复看。脚本语法检查通过；操作journal脱敏保留于artifacts/questionnaire-audit/2026-10-05/kk-offline-activation.json，完整记录docs/work/kk-offline-subscription-2026-10-05.md。

## Web 教练套餐支付渠道核查（2026-10-05）

- 只读源码确认：Web PaymentDialog 仅接平台支付宝，教练订阅页默认 alipay_api 并关闭个人码/线下方式；没有平台微信支付选项。
- 现有教练微信接口为汇付 T_MINIAPP，依赖小程序 openid 并返回原生支付参数，尚未接 Web 微信扫码/H5。本轮没有业务修改、真实下单或发布，也没有实测网页与商户渠道配置。

## 单杠照片新版体验上传待确认（2026-10-05）

- 用户授权新体验版；图片点击预览修复48e3d411已推GitHub/Gitee dev。root typecheck/477测试、生产2884模块124页、独立dist-release包及resolver四env通过；无后端部署或正式小程序发布。
- 用户截图标题coachlink-wechat-app属于CoachLink，原app.json报错来自构建未结束先开上传目录；完成构建并重新编译已恢复实际单杠页/AppID wx316e39eb71c0e834/正式API，读取新点击角标并tap成功。截图工具超时，本轮没有生产相册PNG，10/4真实本地1/3相册证据仍有效。
- 2026.10.05.0653官方upload返回pendingTask confirmation_upload_ea02d371-c9be-4eaa-bdf6-c628ad24689c，待开发者工具内确认，不主动轮询/重发；用户继续再查原任务。未更新最后成功元信息，不能声称上传完成。旧1200任务查询Task not found，结果未知；本次是新增照片修复的新授权版本。记录docs/work/streetlifting-image-trial-release-2026-10-05.md。

## 单杠照片浏览预览已本地修复（2026-10-04）

- 列表图区域漏绑定点击；已在locations/index.tsx接入Taro.previewImage完整点位相册，无需编辑或登录，支持旧image_url与新image_urls，图片数量提示可点击，分享按钮阻止冒泡。只改该页源码，无后端/图片数据写入。
- root类型检查/477测试、Next546页及mini2897模块通过；官方DevTools使用真实公开点位点击图片，实际原生预览显示1/3，列表/相册PNG已查看。没有mock、上传或提交推送；当前正式客户端未更新，图片修复不在既有1200pending上传包中。记录docs/work/streetlifting-image-preview-2026-10-04.md。

## 教练销售恢复dev已发布，体验上传待确认（2026-10-04）

- 用户明确授权新体验版及前后端更新。源码c1a3d818已推GitHub/Gitee dev；477测试/root typecheck、独立生产mini2884模块124页与compiled resolver四env通过。dev Web/API已完成generation82/3新副本Ready、摘要1787f827d2e9500d6bac1dce0e1095a22750bd11f1e151b394765763b2cbe006/health200；国内备用Webpack546页通过，长传输CI已取消并确认终态，构建器已停止。真实既有JWT探针新版教练400缺参数、旧免费教练403、平台会员403，无有效订单/扣款。main124/3副本原f8b60be6摘要及health200不动。体验2026.10.04.1200 upload任务confirmation_upload_6b04bd45-fc4a-4c70-ab85-10b1fba97012待工具确认，不主动轮询；独立生产包dev域名拦截刷新后仍存在，后台只读访问被安全策略阻止，已请用户核对request域名。截图超时，实付/分账及正式发布未做。

## 教练销售独立策略已本地恢复（2026-10-04）

- 用户已要求立即恢复教练付费通道。实施边界：平台会员继续免费，恢复教练价格/新购/续费/购物车与汇付订单；汇付分账、提现、历史订单和服务权益保持。
- 本地实现完成：教练套餐/新购/续费/市场购物车/预购问卷独立恢复；新版标识只控制产品策略，原身份和订单所有权保持。新建订阅只创建inactive，续费仍通过汇付订单与成功通知，非直接加周数。
- 477测试、root typecheck、Next546页与mini124页构建通过；mini435历史类型错误与HEAD基线一致、无新增。官方工具真实本地API验证教练CTA→套餐价格，平台用量无充值，PNG已查看。实付/结算及真库seed E2E未运行，不声称端到端资金验收。
- 尚无本次配套API部署或新客户端上传。当前线上仍是旧包，不能声称已恢复线上。待另行发布授权，证据docs/work/wechat-coach-purchase-restore-2026-10-04.md。

## 教练销售通道关闭已确认（2026-10-04）

- 用户反馈多人找不到教练计划购买入口。只读确认当前免费策略同时隐藏教练价格/新购/续费，并在客户端支付服务及后端订单链路拦截；免费提交包含在10/3上传源码中。汇付接入、历史履约/订单、分账和提现仍在，并非删除支付接口。
- 用户反对平台会员免费连带暂停教练销售；代理承认业务范围影响未单独确认到位。诊断后用户授权恢复，本地已按上方状态完成；配套新小程序/API发布仍待授权，不能靠后端开关让现有客户端出现入口。审核分类/结算风险另行核清。

## 正式单杠后端热修已上线（2026-10-03）

- 用户已正式发布客户端，本轮严格只改后端；没有小程序源码/包更新。国家筛选根因是main旧镜像未同步历史country兼容；用户两条测试实际已入库，客户端照片优先排序解释全部列表开头旧图，排序遵要求不改。
- 后端88b8c7ae已推GitHub/Gitee dev/main，Next after使保存确认不等贡献榜，list/stats移除无用session查询。lint/typecheck/457测试、Docker内Next编译与546页生成通过。镜像f8b60be658e1b825f2e5ef813d65a7d2323b792cb790cc4325445aae35d40855，main generation124/dev80，各3/3新镜像Ready，Node无压力/41.85GiB可用。
- 真实微信登录正式API：新增美国940ms、中国1610ms，均提交成功/返回ID落库；编辑15039ms成功，不能声称所有操作1秒。探针精确清理0残留。正式stats匿名/登录200完整920点位；中国810、武荣公园搜索2条，旧记录恢复筛选。并发复验3个curl TLS超时/1个后端get瞬断，逐个重试均通过，外网偶发问题未宣称根除。
- 用户指定测试eed8e070-e812-47a6-988c-5d0c64c47d9d美国地图、341ee4a4-4ad6-4d17-9be9-64f06bd55f4f海淀区科育社区已核验署名/日期/名称并备份，于08:39:49UTC事务删除，同步其贡献统计。数据库0残留、两域读取两ID均404；其他用户新增保留。
- 发布包UI验证reLaunch报timeout waiting for automator response，未取得统计页面截图；手机原统计空白未当场复现。后端修复/发布/数据清理已完成，需用户返回上一页重新进入寻找单杠复看手机界面，若仍空白继续查实际请求/页面错误，不能宣称手机已验收。
- 记录docs/work/streetlifting-production-backend-hotfix-2026-10-03.md；证据artifacts/streetlifting-backend/2026-10-03。版本通告既有草稿未改内容、未对外发送。
## 正式版单杠后端紧急修复（2026-10-03，执行中）

- 用户已把体验版发布为正式版；明确只修后端，不再修改/上传小程序，并要求修复后删除两条测试点位。
- 实测正式API中国筛选仅1条，体验API810条，同DB共921条；正式main旧b4494f5d镜像缺历史country兼容。已将经验证3ce72794/d1d24099镜像同步main/latest，正式generation123与3/3新镜像Ready，中国筛选恢复810条。
- 两条用户测试实际已保存：美国地图eed8e070-e812-47a6-988c-5d0c64c47d9d；海淀区科育社区(中关村南一街东)341ee4a4-4ad6-4d17-9be9-64f06bd55f4f，计划执行者4215，08:11/08:12UTC。已准确备份，尚待最终修复验证后删除，不能误删其他新用户点位。
- 正式stats匿名及实际微信登录请求均200，后者3579ms/完整921点位数据；原手机统计空白暂无直接堆栈。实际微信登录新增美国8670ms、中国6209ms，HTTP200/提交成功/ID均落库；两条代理探针及前次工具超时探针已精确清理，零残留。
- 日志有一次认证读用户fetch failed；公开列表/统计原不使用session却等待三次用户查询。四个后端route最小修复：list/stats移除无用session读取，create/update使用Next after在成功响应后重算贡献榜。提交88b8c7ae，lint/typecheck与73文件457测试通过；首轮冷导入单测超时，未改测试，复跑全绿。Docker正式热修构建中，构建通过后同步main/dev API。
- 所有小程序前端源码/上传包保持不变。公告文案既有WIP保留，未将公告文件纳入此次业务提交。证据artifacts/streetlifting-backend/2026-10-03；后续完成镜像发布、正式API保存/统计/筛选复验、删除用户两测试、更新状态及同步远端。
## 手机登录网络故障已更正上传（2026-10-03）

- 用户手机截图同时有网络域名拦截提示及仅development显示的开发引导按钮；本地dist注入localhost:3001/有按钮，生产dist-release线上域名/无按钮。上一轮1543通过已打开的开发项目临时切root上传，实际产物与所检生产目录不一致。结合旧上传主包2095229/auth399526及独立生产上传主包1955537/auth398964，定位为上传流程拿到开发编译产物；此前“已检查包”等结论不能覆盖实际上传包。
- 新体验2026.10.03.1609已从独立D:/files/coachlink/apps/wechat/dist-release上传，官方upload result.success=true，无pending，9910125字节/主包1955537。根路径及srcRoot=./、urlCheck=true；当前原开发项目仍dist/，没有切其root。
- 独立生产项目真实打开登录页，PNG已查看，无开发按钮。实际common.API_BASE_URL=https://coachlink.fit，开启域名校验后通过应用request访问真实登录接口，空code返回后端“缺少code参数”，dev健康200；生产编译resolver四种env通过（trial→dev、release/develop安全回退→正式）。未执行真实手机手机号登录，未接受用户协议/改登录态或写账号/DB；手机完整登录需体验者复验。
- 业务源码沿用3ce72794，未改登录/地图源码或后端，不重建/部署不相关API。重新lint/typecheck通过，73文件457测试通过。元信息已更新为1609，发布包SHA256 0b437f819693c9f43f24cd19285b01a0a429119dbed45dbdec4d2b08b7ad7103；文档docs/work/wechat-trial-login-incident-2026-10-03.md，证据login-incident-*。

## 体验版手机登录故障正在修复（2026-10-03）

- 用户新截图登录报“当前版本网络配置异常”，显示仅NODE_ENV=development存在的dev-onboarding-btn。源码该错误只对应微信域名白名单拒绝；本地dist含localhost:3001并有该开发按钮，生产dist-release无local API及该按钮。因此当前手机运行的是开发产物；原体验入口/预览入口及1543实际上传目录仍核对中，不归因用户。
- 此前1543仅证明upload返回成功及磁盘生产包检查，不足以证明实际上传与所检包完全一致；上传曾临时改已打开开发项目root，存在编译缓存继续打包dist的可能。
- 当前已独立打开D:/files/coachlink/apps/wechat/dist-release，AppID核验wx316e39eb71c0e834，src/miniprogramRoot=./、urlCheck=true。实际运行common.API_BASE_URL=https://coachlink.fit，登录页PNG已查看、无开发按钮；真实应用request空code返回服务器“缺少code参数”，dev健康200，未写账号/DB/登录态。实际生产resolver四种env检查通过（trial→dev）。重新上传独立发布项目进行中，未修改业务源码/服务端，也不重复部署。

## 单杠地图新体验版已交付（2026-10-03）

- 用户授权全部本地修改提交推送及体验版更新；源码提交3ce7279409330332f95fc5a4a6abf0d5e0e25cdd已同步GitHub/Gitee dev。lint/typecheck通过、73文件457测试通过；生产mini2884模块124页/包检查通过，未含本机API或开发诊断。
- 官方微信upload任务confirmation_upload_b37b6373-fc14-4f21-98a0-cf9bee156324已实际返回success/execution_success：体验版2026.10.03.1543，上传10050668字节，主包2095229字节；配置已按原备份恢复dist/，deploy元信息已更新。此前pending记录仅为历史。
- dev API新摘要sha256:d1d24099eccb3e843a6db9879ff8d75bb8889380cf7a71ca1057f59f0ef344fe、generation79，3/3全部新镜像Ready；main仍generation122与旧b4494f5d摘要。线上两域health200，国内筛选包含中国/北京非空，反查未登录401。当前登录会话只读访问真实dev搜索北京大学200，返回北京大学/北京市/颐和园路5号中文，WGS同一点。未写点位/上传照片/改DB。
- 原生空回调具体根因仍未明确，本包具备异常恢复与备用中文选点；图片dev上传域名已在微信后台补好，手机实际图片上传仍需体验者复验。完整发布记录docs/work/streetlifting-trial-update-2026-10-03.md。

## 新体验版发布授权与执行（2026-10-03）

- 用户明确要求本地所有修改提交推送，并立即上传新体验版。本轮授权覆盖当前全部未提交代码/测试/文档，以及体验版所需 dev API 同步。发布门禁 lint/typecheck/单 worker 全量测试已通过；生产小程序构建进行中。正式 main API 与小程序提审/正式发布不在本次范围。
- 功能包括默认中国、地图优先和实时附近定位、可编辑自动回填、原生异常备用选点、旧数据国家筛选、中文备用搜索与缓存隔离；uploadFile dev 域名已在微信后台保存。原生空回调根因尚未明确，手机实际照片上传需新体验版复验。

## 备用搜索中文回填已在本地验证（2026-10-03 15:29）

- 原英文直接来自后端固定lang=en，不是用户日本所在地/梯子。已取消强制英文、升级两端搜索缓存标识。最终mini2897模块构建通过，4项相关测试通过。官方工具用实际local3001接口完成北京大学搜索/中文名称地区地址回填，2PNG已查看；searchResponseMocked=false，原草稿同一坐标且手改字段保留，未提交点位。
- 原生异常入口受控模拟，仅为进入备用地图；chooseLocation/showModal mock均restore，原真实诊断恢复。本用户原自动英文草稿已通过同一点实际重新选取更新成中文，备份可恢复，当前留在中文表单。真正原生空返回根因仍未定。
- 本轮只本地，未上传新体验版、未部署外部dev API。详见docs/work/streetlifting-search-language-2026-10-03.md。

## 备用搜索英文原因已确认并本地修正（2026-10-03）

- 用户北京大学回填截图对应Photon备用搜索。服务端硬编码lang=en是直接原因，不归因日本所在地/梯子。真实同机对比去掉lang后北京大学/北京市中文，坐标与英文同一点；已移除强制英文并隔离旧英文缓存。修后真实国内查询及London查询通过、4项相关测试通过；本地小程序最终构建/真实UI回填验证进行中，无新包上传/远程部署。微信原生空返回此前根因仍未定，此反馈不等于原生验收。见docs/work/streetlifting-search-language-2026-10-03.md。

## 单杠故障当前结论与交付（2026-10-03 15:10）

- 图片域名：CoachLink实际后台已保存uploadFile新增dev.coachlink.fit，管理员扫码确认，次数50→49；截图upload-domain-saved.png，手机真实上传未复验。
- 回填：真实native callback/Promise仍是空文字与原HK坐标，用户已确认操作，不能归因用户，具体原因未查明。已本地修复空返回误接受及备用地图同坐标丢POI名称；最终构建2897模块/语法0，官方工具模拟异常与POI事件验证通过，3张PNG实际查看；mock全部恢复且测试草稿按最新备份恢复。不能冒称真实原生完整回填已恢复。
- 当前本用户空草稿坐标与真实诊断initial/callback/promise完全一致，按严格匹配清除错误HK坐标，其他文字图片保留且旧草稿可恢复；没有改已保存点位。当前已打开本地新分享表单，未上传新包/图片/提交点位。独立无初始坐标比较没有有效结果，临时key已清除，不反复让用户重选。
- 详见docs/work/streetlifting-missing-native-text-2026-10-03.md和streetlifting-upload-domain-2026-10-03.md。

## 单杠上传域名已保存成功（2026-10-03）

- 用户管理员扫码后，实际后台截图确认 uploadFile 已含 coachlink.fit/dev.coachlink.fit/staging.coachlink.fit，月度次数50→49；缺少体验域名这一配置错误已修正。手机实际上传尚待复验，无新包发布。原生选择返回空文字/原香港坐标，不能归为用户操作问题；本地异常防护与相同坐标 POI 名称保留已改，构建验证中，真实地址根因尚未查明。详见 docs/work/streetlifting-upload-domain-2026-10-03.md。

## 单杠图片上传域名：根因确认，待微信管理员扫码（2026-10-03）

- 已核对启能教链 AppID wx316e39eb71c0e834，uploadFile 原缺 dev.coachlink.fit，request 已有；已补入表单，保存后出现微信管理员扫码，尚未生效。用户已获确认页面，选点文字回填独立继续调查。浏览器先前登录食探不等于操作 FoodLink 代码，本地始终 D:/files/coachlink/apps/wechat。详见 docs/work/streetlifting-upload-domain-2026-10-03.md。

## 单杠图片上传域名反馈（2026-10-03，配置待核对）

- 粉丝手机体验版报uploadFile域名未放行；实际上传目标体验dev.coachlink.fit、正式coachlink.fit，自有API再存COS。两接口HEAD401无重定向，本地urlCheck=false不覆盖真机白名单。应核对微信后台uploadFile合法域名；尚未读取/改配置、未上传图片/发布。详见docs/work/streetlifting-upload-domain-2026-10-03.md。

## 单杠真实原生选点反馈（2026-10-03，调查中）

- 本地诊断2897模块构建完成，实际页callback和Promise都返回空名称/地址、旧香港坐标，排除本次填表/Promise丢字；不能认定微信普遍无地址能力。用户最新纠正早先可能漏确认，现确认仍无回填；restore成功后开始不传起始坐标的单次原生对比。上一轮mock不代替真实验收，未发布/提交点位。详见docs/work/streetlifting-missing-native-text-2026-10-03.md。

## 单杠地图优先与实时附近定位（2026-10-03，已本地构建并验证）

- 新分享默认中国、先地图选点，原生完整中文名称/地址带回后可修改，缺失提示补充；重新选点保留手改文字。新点获取本次附近定位，已有标记回原点，失败明确告知搜索/重试。没有固定城市或旧缓存冒充当前定位。小程序2897模块构建成功、mini433历史新增0、14项相关回归通过。官方开发者工具真实操作及4张PNG已查看；两个不同模拟定位传给chooseLocation各自正确，中文地址回填/手改保留/缺地址提示通过。原草稿与定位缓存恢复一致，mock移除，未提交点位/上传图片。仅本地，手机体验仍1031。详见docs/work/streetlifting-map-first-native-2026-10-03.md。

## 单杠文字优先录入（2026-10-03，已本地运行并展示）

- 用户要求本地运行看效果，后端3001 healthy200；原项目新开s4及cli auto后实际页面恢复。官方打开点位页/点击分享成功，新表单PNG已查看：默认中国、中文手填文字/详细地址、明确地图分工；停留空白分享表单供用户操作，未提交点位/切换认证。完整选点返回与导航仍未验收，未上传。见docs/work/streetlifting-text-first-2026-10-03.md最新运行记录，下方超时为上一轮历史。

- 用户核对旧事实后选择“先手填精细文字地址，再地图标记对应位置”。本地新表单默认中国、海外再选国家，国内恢复微信chooseLocation；选点仅更新坐标，保留全部文字，海外点选删除自动反查地址等待。恢复文字-only可保存并说明无坐标只能列表展示/不能地图导航。完整本地mini2896模块/124页、根类型通过、mini433项历史无本页诊断、14项地图/定位回归通过；开发者工具基础库timeout/空页面，已查看官方空白截图，新表单尚未UI验收。无点位提交/认证变更，缓存只读核对draft=null/pickerKeys=[]；此新流程未上传，手机现有体验版仍1031。交付docs/work/streetlifting-text-first-2026-10-03.md。

## 单杠地图新体验包（2026-10-03，已上传）

- 用户授权上传并自行检查，新体验版2026.10.03.1031官方任务已success，9,905,262字节/主包1,953,799字节；两步位置选择、回填/手填失败提示、国家与缩放/权限修复已打包。配套dev API摘要d81498fd已3/3新副本Ready；中国筛选791与北京152、health只读核验通过。正式main generation122/原b4494f5d镜像前后不变，未提审或正式小程序发布，Git未提交推送。根类型0、457测试与生产mini/Next546页构建通过；手机显示、实际保存导航由用户验证。见docs/work/streetlifting-trial-2026-10-03.md。

## 单杠地图交互与定位声明（2026-10-03，本地修复）

- 用户最新明确：只需知道单杠位置、可导航，不要求道路背景细致。按位置搜索/选取/标记/回填/保存与导航入口收口；工具中海外背景空白不作为阻塞，不扩大地图服务接入范围。真实业务保存与手机外部导航本轮未执行，保留验证边界。

- 分享统一“搜索/地图选位置→自动带回附近地址→补名称/说明/照片”，不再要求经纬度；中国筛选、初始附近/最多点位地区和缩放反馈修复。定位统一已声明fuzzy，删除隐式精确定位调用，源码用途文案同步生成app.json。
- 最新SDK实际完整流程/6张PNG通过：连续两次定位缩放保持13且无声明弹窗，日本搜索回填、重新确认保留地址；草稿finally恢复，未提交点位。457测试、根类型0/mini历史433新增0、Next546页、本地mini2896模块/124页通过。未提交/推送/上传。东京/伦敦背景仅已知在工具中空白，未确认手机或根因，不能直接归为原生海外能力缺失或必须换地图服务；先诊断接入/模拟器/官方服务。详见docs/work/streetlifting-location-ux-2026-10-03.md。

## CoachLink 正式/体验版白屏（2026-10-03）

- 用户随后提供手机vConsole堆栈：`ReferenceError: Intl is not defined`，TodayTrainingScreen/useMemo。共享北京时间格式化的降级分支再次调用缺失Intl，是本次明确可复现的首页崩溃原因；清缓存无法解决。用户确认所有设备均异常，食探正常；未见前晚磁盘驱逐复发。
- 纯Date降级修复094440bd已推GitHub/Gitee dev/main；typecheck/443测试、19项Intl针对性断言、最终生产小程序2880模块/124路由通过。用户授权所有本地修改发布，海外地图迁移已精确应用且未改真实点位。Web/API已更新为CCR摘要b4494f5d，main/dev各3/3、6主容器新摘要Ready，公网health/login/公开教练200与免费新购403；根盘约44.1GiB且无压力。体验版2026.10.03.0534已查询原上传任务success，包体9.9MB/主包1.95MB，用户可真机复测。正式包审核发布由用户进行；尚未宣称手机已验收。详见docs/work/release-2026-10-03.md。

## UI/UX全软件审查（2026-10-03，进行中）

- 用户优先微信小程序，要求全自动真实浏览与截图，按大页面→小页面提出修改意见与设计稿；不能以截图流程跑通作为审查结束。
- 已有5个一级页面真实审查及3张独立首页方案，详见docs/work/uiux-redesign-roadmap-2026-10-03.md。全量124注册路由的深层页未完成，当前新会话仍出现自动化超时/页面销毁；新构建尚未完成本轮视觉验收。没有业务UI改版、提交或发布。


- Project: `coachlink`
- Workspace: `D:\projects\coachlink`
- Ownership: dedicated coding agent for `coachlink`
- Surface: monorepo（Web、微信小程序、Expo/React Native 移动 App）
- UI verification tool: `web-devtools`
- Memory rule: durable project facts must be written to `CURRENT_TASK.md`, `DECISIONS.md`, or `memory/YYYY-MM-DD.md` instead of living only in chat history

## 线上故障恢复 (`2026-10-02` 晚)

- **21:23当前复核正常**：两环境各3/3、配套全部Ready、Redis PONG、五Kafka组Stable/各1消费者；两域轻量公网验证均通过，恢复后无新增重启，剩35.25GiB，无磁盘/内存压力。证据artifacts/incident-2026-10-02/status-followup.json。
- **21:14–21:15已恢复并复验**：main/dev各3/3、Apollo/MySQL/Redis与五个处理worker全部Ready、Kafka五组消费者Stable；公网两域health/login/公开教练200、免费新购403，Redis PONG，分析任务queued/processing均0。原kubelet配置已恢复、imagefs15%与GC85/80实读一致，Node无压力/taint，可用约36GiB，没有遗留暂停实例或降低保护。
- 20:42正式health502、main/dev0/3；09:40起磁盘余量不足15%保护导致驱逐与NoSchedule，Apollo/Redis/任务队列连带故障。当天约82GiB模型备份与共用根盘占用时段吻合；本代理保留备份并清旧安装缓存6.08GB，另观察到备份外部变为约66GiB（来源未知，非本轮操作）。Kafka无持久卷导致CoachLink主题丢失，按既有配置补建五项并恢复处理服务。长期治理备份占用/队列持久化/独立告警待安排。详见docs/work/incident-2026-10-02.md。

## 全量免费体验版发布 (`2026-10-02`)

- 用户已授权全量提交、Web/API更新及新免费体验版上传（不含提审/正式发布）。代码8608e830已同步GitHub/Gitee dev/main；生产三项历史迁移已应用并核对service_role-only RPC。
- 65文件413测试、根typecheck、Next545页、生产小程序2877模块/124页、隔离E2E4项与真实Redis并发/故障均通过；隔离数据0残留。CCR摘要1ef19b88已推送latest/main/dev/8608e83，main/dev全部6个主容器该摘要且均Ready；线上health/login/公开教练200及免费新订单403。
- 免费体验版2026.10.02.0714已于北京时间07:16:48由官方DevTools CLI上传成功，9.4MB/主包1.9MB，源码8608e830；未提审/正式发布。新免费页本轮自动截图等待后terminated，视觉排版需真机验收。详见docs/work/release-2026-10-02.md。

## 微信小程序临时免费候选版 (`2026-10-02`)

- 最新文案（用户截图核验后）：免费版旧会员入口/深链源码与包标题均“功能与用量”，删除内部迁移与原会员记录展示，个人资料会员徽章仅收费策略显示；真实历史数据及订单/分账保留。typecheck/413测试、Next545页和小程序2890模块重新通过，124页产物完整。工具实读新版卡片并可从个人菜单点击进入，但个人菜单仍旧“免费权益”与新包不一致，正常刷新一次后仍在；不称新菜单/全部页面已验收。原截图已检查，自动截图仍超时，新排版待用户截图。当前本地包API3001，health200，免费额度因Redis主机redis无法解析而失败；未发布，不保证微信审核。
- 用户已授权先调查、写方案，再本地改造；docs/work/wechat-free-release-2026-10-02.md先于业务代码写入。本轮不包含提交、推送、部署、上传或提审。实际目录D:\files\coachlink，头部旧路径仅作历史。
- 可恢复的编译期免费策略：会员/加油包/推荐页改免费权益，已发布平台知识库登录后开放，功率原画质开放、空间至少1GB。AI独立Redis每北京时间月30次，故障拒绝，不扣原付费余额、不写永久premium/扩容或会员延期。
- 暂停小程序教练新购/续费、购物车/市场、动作特效新任务/收费导出及平台付费订单。保留已有教练履约/问卷编辑/私有权限、历史订单查询/退款通知/已付任务、汇付真实分账/提现；不自动赠送教练劳动。无标识Web/App共用API按原策略；小程序专属付款免费后端无条件拒绝，旧免费客户端后续也不能直接收费。
- 根typecheck、最终65文件413测试、Next545页与最终小程序2890模块构建通过，124页JS/WXML/JSON完整。并行构建时测试冷导入超时一项，构建结束后限并发复验全通过，未改断言。小程序全量tsc仍有历史错误，业务源虚拟HEAD357→357/新增0，lint仅未配置提示。
- 未改生产数据/发布。28264专用API可读当前首页但截图automator超时，页面/交互未验收；隔离登录/订阅E2E、Redis真实并发/故障、正式包体及发布确认待完成。最终本地develop包绑定可用3000 API，正式地址选择逻辑未改。
- 免费候选版需正常提审，不保证审核。收费恢复须XPay及教练结算合规方案准备完整后重建/新版本提审，不能遥控绕审。历史全量修复仍遵循原发布预检。

## 计划服务周结转 (`2026-09-28`)

- 月历后续修复已完成本地实现与Web真实6196验收：按教练原D顺序投影安排、迟补日期标“推算”、保留原始提交时间；D1恢复7/6，6–9月已逐月展开。381测试/typecheck/Web及小程序构建通过；小程序开发者工具截图超时仍未验收。详见 docs/work/6196-plan-order-calendar-fix-2026-09-28.md；未发布或更正真实历史。
- 已确认并本地实现：权益以服务周/月为单位，按原计划各周完成比例消耗，未完成部分顺延。4周每周3练完成1次剩3又2/3周；跨频率不固定剩余次数。覆盖部分周访问、预计日期、计划读取及skip-day完成事实保护。
- 验证：新增27项回归；59 files / 363 tests、typecheck、Next 545页构建通过，lint仅提示。未修改已有测试，未部署/迁移生产/更正真实历史。
- 只读核对手机用户_6196：12周每周2练，20个唯一完成D，按规则剩2服务周/当前频率4次（D71、74、78、81）。D53/D57实际训练日期仍待本人确认，不能仅按原计划顺序修历史。
- 后续发布前须完成隔离写入E2E、日期迁移与部署授权；下方旧“次数结转”描述被本节服务周规则覆盖。

## 计划推进与订阅一致性 (`2026-09-26`)

- Latest: 已继续完成第二批本地月历/日期补记修复：双端共享日历、多D日期桶、历史查看、推进事实分离、明确实际训练日与审计/幂等RPC。新增39项回归，全量336项和根typecheck通过，隔离PostgreSQL实际并发通过且已清理。UI工具连接超时仍待验收；无生产迁移/数据更正/发布。详见 `docs/work/plan-calendar-backfill-2026-09-26.md`，下列第一批说明保留为历史。

- Status: 已按用户追加要求完成当前体系流程图和代码入口审计，并开始第一批本地后端修复：完成事实不被普通补录重写、完成写入条件防覆盖、订阅读取失败不得当作空历史。未改生产数据、未提交或发布；双端日历和权益结转尚未收口。
- Verification: 新增 23 项回归，最终 Vitest 55 files / 297 tests 和 typecheck 通过，本轮 Next 544 页构建通过。测试使用数据库替身；Docker 引擎未运行且本地配置连接远端业务库，未冒险运行写入 E2E，真实隔离库并发验收仍是发布前阻塞项。
- Artifact: `docs/work/plan-subscription-current-flow-2026-09-26.md` 记录实际流程与实施边界；`docs/work/plan-subscription-consistency-2026-09-26.md` 包含证据、固定不变量、验收矩阵和发布标准。方案不是已批准的新计费规则。
- Confirmed: 用户已确认换阶段保留未完成训练权益：4周每周3次，只完成1次，应剩11次，不能整周扣减；结转算法尚未切换，不自动改真实余额或历史训练日期。
- Next: 验证隔离库条件写入，再统一双端日历、历史访问与计划日事实；按已确认规则收口次数结转、频率变化算例与兼容迁移。

## 微信小程序虚拟支付改造 (`2026-09-16`)

- 最新2026-10-11：用户更正后dev SANDBOX=true已生效，沙箱AppKey经env=1只读微信接口验签errcode0。dev回调GET401仍需补public-path热修（main既有回调已成功）；线上dev94d62a4d/main3e446dd3含10-10单杠分享，不回退旧镜像。SQL约束只读检查工具permission拒绝，索引/退款CHECK未确认；没有数据库写入。测试包/受控后端未交付，已询问D盘1–3GB构建预算及测试设备，未开启正式收费、不动汇付。

- 当前续接实查（2026-10-11）：用户确认第二步配置后，Apollo dev/app-config已发布版本20261011013959-b1ec6960590c8330仍含WECHAT_XPAY_SANDBOX=false（直接配置服务与Pod新bootstrap一致），并非只需等待刷新。main/local也false。沙箱Key尚未接口验证，联调包/受控后端未交付，免费正式版与教练汇付未改。需仅dev更正true/发布后继续；八道具线上及消息推送提交沿用用户确认，不重复配置。

- Latest (`2026-10-11`): 用户确认消息推送已提交、8道具现网已发布，配置阶段结束，进入受控支付联调。真实回调签名200；微信只读现网XPay查询errcode0验证AppKey有效，支付三表必要字段可读。dev尚非SANDBOX=true，免费版前后端仍拦付费；测试包/迁移约束/支付权益幂等退款/苹果现网仍待完成，不自行恢复收费、构建部署或改汇付。详细docs/work/wechat-xpay-integration-checklist-2026-10-11.md。
- Latest (`2026-10-09`): 商户资料用户已核对，8项道具清单与合格PNG已齐；仅两月卡现网发布有截图证据，其余6项需核齐。正式main回调热修10-08已上线，10-09实测Apollo coachlink/main/app-config四项存在，OfferID1450666974及SANDBOX=false正确；真实Token签名GET200原文/无签名403。微信后台消息推送保存与发货退款订阅仍待用户确认，实际付款/权益/幂等/退款、开发沙箱和苹果IAP现网未验收。当前平台免费策略不变、教练汇付购买保留；本轮不收费、不支付、不改部署或数据库。下面9月实施记录为历史，不能据其“未部署”否定此次正式回调已上线。
- Status: 已按资金归属拆分本地支付链路：平台自营会员、AI/存储加油包和动作特效导出走微信官方 XPay；需要向教练分账的教练订阅继续走汇付小程序支付。尚未提交、推送、部署、执行数据库迁移、上传小程序或向微信发布商品。
- Settlement invariant: 教练订阅必须保留“汇付收款 → 7 天保护期 → 平台汇付现金户真实划转至教练汇付子账户 → 远端成功后才记教练钱包 → 汇付提现”的闭环。禁止用 XPay 收款后只增加数据库钱包余额；此前本地试验性的 `xpay_platform_ledger` 分支和教练金额 SKU 已删除。
- Review finding (`2026-09-25`): 微信最新运营指南将在线教育、技能提升、课程视频和辅导服务列入典型虚拟服务；CoachLink 当前教练套餐又明确包含训练计划、课程咨询、动作/视频反馈和图文/视频教学，所以线上教练订阅继续走汇付普通支付的审核风险高。混合支付本身并非必然违规，但只有真实线下/实体履约部分适合保留普通支付，虚拟权益必须拆成 XPay；纯线上教练套餐应另行设计 XPay 收款后的教练结算，或先取得微信书面确认。
- Verification: lint、typecheck、Vitest 53 files / 274 tests、Next 544 页生产构建、小程序 2,879 modules 构建及 8 个平台商品目录干跑均通过；微信开发者工具已验证会员、加油包、教练汇付等待页，0 error / 0 warning。最终截图位于 `artifacts/wechat-xpay/platform-membership-final-retry.png`、`platform-addon-final.png`、`coach-huifu-waiting-final.png`。

## 登录取消验收恢复与方法说明（2026-10-05，当前仍未交付稳定窗口）

- 用户连续追问为何启动失败、怎样验收成功。此前本轮实际原项目五条UI路径已通过；artifacts/onboarding-cancel/2026-10-05/result.json为passed/restoredStorage=true、cloudWrites=0，最新onboarding.png于23:24:51已确认顶部避开状态栏。这覆盖模拟请求/合成账号，不能当真实登录或手机通过。
- 发现共享开发窗口被其他任务切页，另一构建同时重写apps/wechat/dist；复制时app.json正不存在。这证明共享产物/窗口存在并发干扰，不代表全部超时原因均已确定。
- 已在artifacts/onboarding-cancel/2026-10-05/acceptance独立构建2897模块，AppID wx316e39eb71c0e834/独立端口9422，buildComplete=true；打开接口成功但自动化仍超时，尚未确认独立窗口稳定显示。临时关闭原私有热重载后当前文件又显示true，不能把原项目热重载关闭宣称为持久完成。
- Windows computer-use工具报告用户按Escape停止，已停止UI操作。本次追问只核对证据与写验收方法，没有再次操作窗口、提交/推送/上传/提审、改真实账号或已有测试。
- 推荐固定独立包、先手动编译查第一条错误并证明页面可重复启动，再用既有开发引导入口人工测试取消，最终预览二维码真机验证真实登录。方法尚未由用户确认执行，不能宣称新窗口已准备好。详见docs/work/wechat-onboarding-acceptance-method-2026-10-05.md。

## Web 手机浏览器和微信内支付（2026-10-05，本地完成，托管配置待补）

- 用户已明确两者都要支持。核对官方汇付文档后撤换前轮未经验证的 /v3 jspay T_NATIVE，使用 /v2/trade/hosting/payment/preorder、T_JSAPI、H5/PC 托管项目；手机浏览器和 MicroMessenger 走 M 并跳转 jump_url，电脑走 P 显示收银台链接二维码。汇付负责授权与实际渠道拉起，不能将此表述为已实现微信原生 transactions/h5 或已真机唤起。
- 保留 CoachLink 汇付现金户/教练结算及支付宝、小程序路径；服务端业务金额/周数/归属与 pending 状态校验，托管查单独立 queryorderinfo、金额和订单匹配、支付完成只依据查单/签名通知，非成功状态不回退 paid。缺 HUIFU_WEB_PAY_PROJECT_ID 会在支付记录插入前返回 503。
- 当前单源 bootstrap 是 Apollo，已有汇付基础密钥/回调但无托管项目号。已异步向用户索取已有 project_id（非密钥），尚无回复；下一步由真实汇付 H5/PC 项目、微信渠道/授权域名配置提供项目号并写入当前 Apollo，再受控验证两种手机入口、回调、履约、到账。没有修改 Apollo 或商户后台，没有真实下单/付款，没有提交推送部署。
- 最终 lint 退出 0（未配置 ESLint）、typecheck 通过、75 文件500测试、Next547页构建通过；后端隔离21项、web-devtools实际组件6条模拟交互/0页面错误/截图已查看。无真实数据库写入。现有完整订阅 E2E seed/cleanup 指向业务库，未提供隔离库，未执行/未宣称通过。来源 docs/work/web-coach-wechat-payment-2026-10-05.md；最新证据 artifacts/web-mobile-payment/2026-10-05，旧 Native 证据仅历史模拟。
- 以上取代本文件此前“Web 微信 Native 实现完成”的当前状态；原实现不能视为已接通汇付/手机真实支付。其他会话支付入账、附近照片、onboarding等 WIP保留。

## 自动验收会话管理系统设计（2026-10-06）

- 用户要求思考如何构造管理系统并沉淀到AGENTS.md，解决七八个开发者工具窗口无法识别、重复开启和未回收。此次完成设计与规则落盘，没有把询问设计扩大为批量关窗、全局Codex指令修改或新建定时后台服务。
- 已修改根AGENTS.md及apps/wechat/AGENTS.md：开窗先核对/复用/登记；同逻辑AppID交互串行，构建目录也协调；窗口归属与用户移交明确；成功失败均恢复测试状态并回收自建临时窗口，借用/用户/归属不明窗口保留；超时不得不断新开。
- 完整设计docs/work/devtools-session-management-design-2026-10-06.md：共享注册表+原子占用/排队+DevTools与构建adapter+生命周期/故障隔离+用户状态表；每项目1个AI工作、最多1个明确handoff，全机AI工作默认2；同AppID独立产物仍串行。规划先调度核心，再工具接入/回收，再构建与崩溃监督/旧窗口迁移。
- 当前仅设计与代理规则完成；可执行管理器、真实状态面板、自动排队/自动关窗尚未实现。规则变更不能立刻改造已运行对话，需它们下次读取并使用统一入口。既有七八个窗口未关闭，未操作GUI或增加窗口。归属不明旧窗口需先盘点，不强杀整个DevTools。
- 文档路径核对通过、两份AGENTS git diff --check通过。本轮没有业务/测试代码改动，未跑UI或业务构建回归，未提交推送/部署/上传/提审；其他会话onboarding、地图器材与支付WIP保持。

## Web 微信托管必需性复核（2026-10-06）

- 用户询问 project_id 怎么获取、是否必要、方案是否正确。官方 /v2/trade/hosting/payment/preorder 的 hosting_data.project_id 确实必填，需在汇付合作伙伴控台创建 H5/PC 托管项目取得；但该项目号只是本地选择托管方案的依赖，不是手机微信支付通用前提。此前未先核对已有商户能力就选托管并让用户申请，判断过早；托管是否最终采用待复核，不取消用户手机浏览器+微信内都支持的需求。
- 当天按严格 Apollo 单源 bootstrap 只读检查，WECHAT_PAY_MCHID/SERIAL_NO/API_V3_KEY/PRIVATE_KEY/PUBLIC_KEY 及网站微信 AppID、小程序 AppID 均存在，无值输出。仅字段存在，不证明密钥有效性或 H5/JSAPI权限、支付域名、公众号授权已开；商户后台权限未读取。
- 原生微信直连H5+JSAPI无需汇付项目号，但不能仅替换创建接口而把原汇付现金户/教练余额结算当作仍兼容。现有教练T_MINIAPP和结算走汇付，两个参考项目只有Native实现不能证明手机权限。下一步先核对现有商户H5/JSAPI/汇付通道与资金结算，再决定托管或直连，不催用户现在开新项目。
- 已更新 docs/work/web-coach-wechat-payment-2026-10-05.md 顶部纠正此前表述；本轮无业务代码修改、真实下单、Apollo/商户配置修改或提交发布。此前本地托管代码仍存在并缺项目号返回503，不称为手机实付已完成。

## Web 微信执行方案定案（2026-10-06，用户要求清晰总结和停止反复）

- 用户要求明确电脑/手机当前实现、配置及固定方案。代理依据当前已实现代码和保持教练结算确定执行：汇付H5/PC托管收银台，支付宝保持原路径，网页微信不切换直连。用户明确两种手机入口都要支持；方案选择由代理负责，不把它误记为用户指定了某商户配置。
- 当前仍仅本地代码/模拟验证，电脑QR也未真实支付；手机外部浏览器及微信内均跳转托管M收银台，实际微信唤起/授权/支付未验。电脑P模式二维码是汇付链接，微信扫码进入收银台。项目号缺失时所有Web微信下单503，未上线/未真实收款。
- 执行顺序固定：汇付合作伙伴控台创建/复用H5PC托管项目、开通选择微信与授权目录→取得project_id写当前Apollo HUIFU_WEB_PAY_PROJECT_ID→运行配置生效及部署→三入口受控实付/回调/查单/订阅生效/到账验收。本日重新只读核实五项汇付基础配置齐全，NEXTAUTH_URL存在，callback HTTPS、/api/payment/wechat/notify、无query；项目号仍缺。没有改Apollo/后台/业务代码或部署。
- 先前“项目号对微信支付整体非必需”的通用说明不表示本地已切到直连，本项目确定选择的托管路径需要它。以上覆盖前条“托管是否采用待复核”的执行状态；不再仅因理论上有其他接法来回改路径。真实商户若反馈不支持目标场景，凭证据报告阻碍，不能模拟冒充真支付。
- 权威说明docs/work/web-coach-wechat-payment-2026-10-05.md最顶部已整理三入口效果/已验证程度/配置步骤；其他会话WIP保持。

## Web 教练 AI 修改学员计划 network error（2026-10-06，诊断完成）

- 用户询问个人网络还是软件bug；截图文字不作为执行训练修改授权。本轮只读源码、正式Nginx/Pod日志、运行配置与编译chunk，无DB读写/模型请求/业务或测试改动/浏览器复现/发布。
- 精准匹配订阅3a71d6a5-924b-4ffb-95c1-c4be34e5b625：服务器+08的05:05:13、05:08:07（用户Asia/Tokyo06:05:13、06:08:07）两次batch-operation均upstream timed out while reading upstream，随后分别报Controller is already closed。确认为系统端代理中断，不能归因用户网络。
- 实际AI接口走Nginx普通location /，无自定义read timeout/buffering设置，采用默认60s读取间隔与buffering on；生产SSE编译chunk无周期心跳/X-Accel-Buffering/断连监听，前端直接展示底层错误。其他视频路径900s不覆盖AI；当前main generation125/3副本Ready。
- 模型第三段为什么慢仍未确认；进度3/4不证明修改已保存。仅完成诊断，尚未修复。下一步如修复：专用SSE代理配置+周期心跳/取消关闭保护+可读错误/最终结果完整性，针对超过60s等待与断连验证。
- 文档docs/work/ai-plan-network-error-diagnosis-2026-10-06.md；脱敏证据artifacts/ai-plan-network-diagnosis/2026-10-06/evidence.json。保留其他会话WIP。

## 训练首页 V2 本地完成（2026-10-06，待用户手测）

- 用户最新交互已落地：紧凑统一首页、多来源选择、日期/更多入口、真实轻任务；已完成状态以 execution 为准。完成总结与已完成执行页首有生成打卡图，首页已完成/查看记录。无订阅且无个人计划为即兴锻炼/找教练，订阅待制定为即兴/联系教练。
- 执行返回先读既有缓存再拉云端；完成提示带 instanceId；个人计划不带另一教练路由参数；补记和轻任务成功同步缓存，没有另建 storage 或改 60 天规则。
- root typecheck、76 文件507测试、Next547页与最终mini2894模块通过；lint仅提示未配置。mini历史435/最终428/新增0，历史问题仍在。产物静态核对通过，不当作 UI 或真实微信分享验收。
- 用户明确自行运行测试，因此无 DevTools/浏览器操作、无新窗口/mock/账号数据写入；没有后端或既有测试修改、提交推送、上传或部署。其余 WIP 保留。
- 实施记录 docs/work/today-training-home-implementation-2026-10-06.md，证据 artifacts/today-training-implementation/2026-10-06/result.json。下一步由用户手测多计划、完成打卡、无计划、日历补记与真实任务，后续反馈继续本地改。
## Web 教练 AI 修改 network error（2026-10-06，本地修复与验证完成，未上线）

- 用户明确“怎么修复啊 改啊”，已实施本地代码修复；未提交推送/部署/修改正式Nginx，未改学员真实计划或其他会话WIP。
- 新planEditSse立即连接注释+15秒心跳，X-Accel-Buffering:no/no-transform；请求/reader取消清定时器、关闭保护并传播AbortSignal到OpenAI与Anthropic，取消后不再重试或续写关闭controller。
- 前端两种模式共用结果完整性检查，无完整终态的EOF也报中断；收到完整结果后断连保留结果，业务错误只报一次，network error/HTTP代理HTML改为可读提示。重新提交原修改要求不是断点续传。
- Nginx单一路径候选deploy/nginx/plan-ai-sse.location.conf.example关闭buffering/cache/gzip、读取间隔180s，已在服务器临时配置nginx -t成功；正式配置未改/reload。
- lint退出0但未配置ESLint，root typecheck通过；实际修改链路额外类型对比HEAD基线4/当前4/新增0；Next编译和547页生成通过。78文件520测试通过，含本次新增13项，无既有测试改动。
- 真实BatchOperationDialog/服务/新流模块的浏览器受控模拟：65s慢响应在60s空闲代理下4次心跳/最大间隔15014ms，完整预览并实际确认应用通过；截断结果明确报错/无应用结果，0页面异常/0真实DB写。web-devtools skill未找到，使用Playwright替代；两PNG已查看。临时浏览器/服务器关闭、端口分配已释放。
- 文档docs/work/ai-plan-network-error-diagnosis-2026-10-06.md、证据artifacts/ai-plan-network-diagnosis/2026-10-06。后续仅发布本次Web/API并应用Nginx候选才能在正式站生效；模型第三段原变慢原因仍未确证，不宣称模型稳定性或真实计划保存已验收。
## 小程序动作库街健/有氧空列表（2026-10-06，本地修复）

- 正式公共动作接口当前返回力量414，其中客户端街健规则313；有氧20。用户截图在即兴选择的「常用」，此来源来自账号个人动作/训练记录，并非公共动作库；无需重新导入动作。
- 本地已调整街健/有氧无常用动作时切公共库及空态说明，lint提示未配置、typecheck、Next547页、520测试、独立小程序2894模块构建通过。DevTools复用目标归属不明，未交互验收；未提交/推送/上传，当前手机包仍可点「公共动作」查看。详情 `docs/work/action-library-empty-2026-10-06.md`。
## 街健公共动作素材核验（2026-10-06）

- 生产原有公共街健 313 条均无视频；未经逐条核验的 313 张旧参考图已备份并撤下。已找到并视觉核对一条公有领域前臂平板支撑真人视频，压缩上传项目 CDN，恢复“平板支撑”；其余 312 条以可逆 `STREET_REVIEW_PENDING` 类型隔离。线上回读 `STRENGTH` 102、`CARDIO` 20、待审核 312；动作行/历史引用保留。
- 后端全入口隐藏及小程序核验空态仅本地完成；无提交推送/API部署或小程序上传。独立构建/本地 API 筛选通过，开发者工具 9420 不可连，9422 归属不明，UI/视频播放未验收；本机 Docker daemon 不可用。余下 312 条需逐条视频审核。依据 `docs/work/street-workout-video-review-2026-10-06.md` 与 `artifacts/street-workout-video-review/2026-10-06`。

## 街健图片需求纠正已落地（2026-10-07）

- 用户明确最终导入准确示范图片，视频只用于研究/理解动作；10-06视频最终素材/强制视频准入作废。小程序列表是图片封面，详情可同时有图片和可选视频。
- 已将平板支撑误导入视频URL从公共动作及1条精确个人副本清空，导入核验真实视频120秒帧的640×640 JPG到标准动作。正式API回读图片新URL/url=null；该个人副本标准ID一致，其他用户视频/训练记录保留。
- 本地审核改为公共ID+标准动作ID+当前精确图片URL，不要求视频；对应全入口与小程序空态修改。旧视频导入脚本移除、类型恢复改图片条件，新313项队列为1项已导入图/312项待图片审核。312项未完成逐项核验，仍可逆隐藏，不能声称全部确定错误或已找遍来源。
- lint仅提示未配置；root typecheck、78文件520测试、Next547页、独立小程序2894模块构建通过。本地真实列表/HTTP详情验证力量102、有氧20、待审312；已审图片无视频可见，待审详情404，错图片/标准ID拒绝。正式素材回读通过，验证无DB写，已有测试无改动。
- 9420可连接pages/index/index，但项目完整路径/AppID/窗口/固定版本/占用者未确认，DevTools界面未验收；未导航/mock/storage写/开新窗口，连接已结束。只读API临时服务已关闭、3002释放；无提交推送/API部署/小程序上传。
- 记录docs/work/street-workout-image-review-2026-10-07.md；证据artifacts/street-workout-image-review/2026-10-07。后续312项需按图片来源/具体变式逐条审核，本地后端全入口隐藏及小程序改动未发布。其他会话WIP保留。

## 统一生成风格：首张纠正完成（2026-10-07）

- 已看原线上平板/反手引体/跪姿俯卧撑，旧负重动作图、v4母版和生成提示，确认用户要自生成统一解剖插画；照片/视频只姿势研究，前两轮直接视频/截图最终素材决策作废。
- 内建image_gen以母版/旧图为风格输入、真实前臂平板帧为姿势输入，生成白底灰白人体/红橙肌群/横向三幅插画。已逐幅查看前臂脚尖支撑、膝离地与躯干位置；静态保持三幅不编造动作变化。
- 最终文件design/image-workspace/action-library/reviewed-outputs/2026-10-07/plank-v4-reviewed.png；完整prompt同目录plank-v4-prompt.md，hash a91810eaa9a0786e9a7c23295711f1dc3975052c72530a6162748f558572ece1。条件替换仅本任务平板真人截图，CDN内容/hash、标准动作及正式API回读确认新PNG/url=null。旧图库/其他动作/用户视频/训练记录保留。
- 本地图片审核明确generated-illustration与原风格来源；旧照片导入脚本退役拒绝运行。队列仍1张已核验生成图/312待动作理解与重绘审核，不能声称全库已完成或有专业教练逐项认证。
- lint只提示未配置、root typecheck、78文件520测试、Next547页通过；实际本地列表/HTTP详情与分页、错图片/标准ID拒绝/待审404通过；正式API新生成图回读成功。没有修改已有测试。
- DevTools9420再次只读连接pages/index/index；实际项目完整路径/AppID/构建版本/窗口占用未确认，不抢用/另开窗口；未交互、mock/storage写或创建窗口，连接结束。小程序实际展示尚未验收。本轮没有客户端源码修改/新包上传/API部署/提交推送。
- 只读API服务已关闭、3002释放并解除port-manager登记。记录docs/work/street-workout-generated-style-2026-10-07.md。后续312按“理解动作→锁定原风格→生成→逐幅核姿势/风格→导入”推进，其他WIP保留。

## 静态示范图已改为单幅（2026-10-07）

- 用户明确静态保持动作不应重复同姿势三幅。已改生成提示词/生产规范，维持 CoachLink 原插画风格，幅数按动作解释需要决定。
- 平板支撑新单幅图由内建 image_gen 生成并在线替换，CDN/hash/标准动作及正式API回读通过，图片plank-v4-single-5e63bb04.png、视频为空。312项仍待审核重绘，无删除动作/历史。
- 本地审核清单同步单幅新URL和poseCount=1；未部署审核代码、未提交/推送/上传客户端。
- 本轮最终root typecheck、78文件520测试、Next547页构建与git diff --check通过；lint只提示未配置。实际本地列表/HTTP详情确认新单幅图可见、待审312隐藏/404、错误图片及变式拒绝；只读验证无数据库写，临时服务关闭、端口登记释放。


## 全量图片批次进度（2026-10-07 06:29UTC）

- 已实际替换并精确CDN/SHA/数据库回读确认67/434条，40个唯一生成素材；有氧20/20已替换，剩余367条仍在执行。
- 后水平按真实姿势照片纠正手臂向后方向后通过；水平澳式引体纠正终点屈肘，波比跳三种真实不同阶段通过。椭圆机/战绳/坡度快走/冲刺删除重复姿势改单幅；均用内建image_gen，不导入真人素材。
- 下一批8图为V支撑、人旗、悬垂举腿、抬腿触杠、单腿深蹲、靠墙/自由/折刀倒立撑，正在生成并逐幅核对。
- root typecheck通过，lint仅未配置提示，78文件520测试通过，Next编译及547页生成通过；未改既有测试。数据/素材进度不能代表手机展示验收，没有提交/推送/小程序上传/API部署。



## 全量动作图片替换进度（2026-10-07 07:02UTC）

- 已实际导入并逐资产CDN完整SHA/数据库回读确认91/434条，62个唯一素材（含先前单幅平板）；有氧20/20全部完成，343条仍待处理，未声称全量完成。
- 最新10图：单杠/吊环屈臂撑、吊环澳式引体/俯卧撑、单手悬挂/倒立、靠墙静蹲、进阶团身前水平、窄距引体、折刀倒立撑。辅助引体与死虫式未通过姿势审核，重画中。
- 下一批13图正在内建image_gen生成，含11种标准力量动作与2个纠错。最终仍统一母版解剖插画；静态一幅，动态不同阶段按需。没有删除动作、改用户视频或训练历史，没有提交/推送/API部署/小程序上传。


## 全量动作图片替换进度（2026-10-07 07:36UTC）

- 已实际导入并逐资产CDN完整SHA/数据库回读确认121/434条，88个唯一素材（含先前单幅平板）；有氧20/20已完成，剩余313条。不能声称全量完成。
- 第15批19个素材覆盖23条：高杠/前蹲、弯举变式、哑铃硬拉、面拉、绳索夹胸、腿弯举、划船/下拉、地板卧推、农夫行走、相扑硬拉、辅助引体、对侧死虫式。低杠与两种卧推未通过审查，继续纠正；传统硬拉两次内建生成输出审核误拒，未导入。
- 第16批23图生成中：20种标准力量动作及低杠/两种卧推纠错。最终自主生成原CoachLink灰白解剖插画，静态一幅，动态只留有用阶段。只更新标准图片字段及经审核条目恢复类型；不删除动作，不改原视频/说明。
- 只读脚本 verify-replaced-action-images.mts 已新加；数据库复核说明/原视频/名称/分类关系未变，454公共/764标准动作记录保留。图片服务器曾一次ECONNRESET，相同参数幂等重试成功。未提交/推送/API部署/小程序上传，未操作微信工具窗口。


## 全量动作图片替换进度（2026-10-07 07:52UTC）

- 已实际替换并CDN SHA/数据库回读确认137/434条，104个唯一素材（含原单幅平板），有氧20/20全部完成，剩余297条。
- 第16批16张已导入：下压/仰卧臂屈伸/过顶绳索伸展、侧平举/后束飞鸟/阿诺德推举、腿举/腿屈伸/坐姿提踵、髋内收/外展、缺口硬拉、严格肩推/借力推举、器械推胸、架上拉。新鲜只读数据库审计137项零错误，454公共/764标准记录保留。
- 低杠与两种卧推仍未通过关键位置审核，泽奇/箱式裤型需修；臀推/史密斯生成发生输出审核误拒，未导入。
- 第17批25张内建image_gen生成中：18种街健变式及7项纠错。静态单幅，实际阶段有变化才多幅；网上视频/照片只研究姿势，最终自主生成原统一灰白解剖插画。
- 浏览器研究照片开页曾超时，仅该次失败，无微信窗口操作；未提交/推送/API部署/小程序上传，不能声称手机已验收或全部完成。

## 全量动作图片替换进度（2026-10-07 08:21UTC）

- 已实际替换并CDN完整SHA/数据库回读确认152/434条，118个唯一素材（含原单幅平板），有氧20/20已完成，282条待处理。
- 第17批14张通过逐幅审核并导入，覆盖15条：军人/快速、两种宽距/并腿单手/击掌/爆发俯卧撑、单手肘支撑、吊环正十字/俄挺/飞机、泽奇/箱式/臀推/史密斯。新鲜只读审计152项零错误，454公共/764标准记录保留。
- 第18批24张内建生成中，包含14种新街健素材、8项未通过图纠错，以及2项已导入吊环图片的手掌旋转细节补修。单手引体过杠修正已生成，弓箭手纠错产生断杠，仍不导入。
- 已从FIG官方2025-2028男子规则PDF逐页读吊环图示，NASM官方深蹲PDF核低杠位置；没有把网络素材作为最终图库图片。没有提交/推送/API部署/小程序上传；没有操作微信窗口，不能称手机验收或全量完成。
## 全量动作图片替换进度（2026-10-07 08:40UTC）

- 实际替换/CDN完整SHA/数据库回读确认174/434条，135个唯一素材（含原单幅平板）；有氧20/20，剩260条。
- 第18批17张已逐幅审核导入覆盖22条；独立只读审计174项零错误，454公共/764标准动作保留。吊环划船/俯卧撑旋转补修仍未通过，本批未覆盖旧已导入图；后水平引体方向、单手划船多臂、静态头肘重复、弓箭手断杠/突击队器材继续纠正。
- 第19批13图内建生成中：低杠/两种卧推/传统硬拉/四种举重/单手前水平与4项街健补修。新增PT实拍训练PDF、TheraBand原厂图及GMB手腕图只研究，最终仍自生成统一插画。
- 低杠及两种卧推即使用实拍参考仍杠位不准，未导入；接下来用已正确地板卧推直接改支撑器材减少姿势误差。没有提交/推送/API部署/小程序上传/微信窗口操作，不称手机已验收或全部完成。


## 全量动作图片替换进度（2026-10-07 09:03UTC）

- 实际替换/CDN完整SHA/数据库回读确认190/434条，150个唯一素材（含原单幅平板）；有氧20/20，剩244条，不能称全量完成。
- 第19批8张通过视觉复核后导入；第20批7张覆盖8条已导入，含弹力带热身两个同名公共条目。传统硬拉、抓举高拉、力量抓举/挺举、单手前水平、弓箭手/突击队引体、单幅头肘倒立及辅助屈臂撑、虎扑/击掌变式已更新。
- 第21批12图内建生成中，7项纠错及Manna/宽距Manna/并腿直臂慢起/虎扑倒立撑/后水平引体；Sommer作者书原图、GMB和教练说明只作为研究，最终统一自生成插画。低杠、窄握卧推和手腕朝向仍需纠正，未把未通过图导入。
- 只更新标准图片及已审核街健恢复类型，不删动作，不改用户视频/名称/说明/训练历史。未提交/推送/部署/小程序上传/微信窗口操作；手机界面尚未验收。

## 全量动作图片替换进度（2026-10-07 09:15UTC）

- 实际替换/CDN完整SHA/数据库回读确认195/434条，154个唯一素材（含单幅平板）；有氧20/20，剩239条。最新只读审计195项零错误，454公共/764标准记录保留。
- 第21批卧推、力量翻、Manna、并腿直臂慢起4张覆盖5条已导入；其余不合格图没有导入。第22批25张内建image_gen正在生成，含6项补修及后倾/握法/单手引体/龙旗等19项。
- 已找到用户原8月动作DOCX、六张SIFANG STREETWORKOUT进阶图和四方力量团队2023训练指南；照片/剪影仅核对姿势，最终仍自主生成统一解剖插画。DOCX括号翻译可能错误，不能替代实际姿势。详见artifacts/action-image-replacement/2026-10-07/original-source-discovery.md。
- 不删动作，不改用户视频/名称/说明/训练历史；未提交/推送/API部署/小程序上传/微信窗口操作，手机界面尚未验收，不能称全部完成。


## 全量动作图片替换进度（2026-10-07 09:53UTC）

- 实际替换/CDN完整SHA/数据库回读确认221/434条，180个唯一素材（含单幅平板）；有氧20/20，剩213条。第22批另5图、第23批17图已逐幅审核后导入；最新只读审计221项零错误，454公共/764标准记录保留。
- 新导入反手后水平、地面/单杠反手俄挺、地面/双杠飞机、深度倒立撑、单手L-SIT、HOLLOW BACK、肘俄挺/单手变式、吊环团身引体/靠墙倒立撑、打字机/超人俯卧撑、高锐角支撑、弓箭手屈臂撑。静态仅单幅，动态实际阶段不同才多幅。
- 第24批25图内建image_gen正在生成：20项未通过图纠错及单手俄挺/后水平、辅助并腿俄挺、前水平上摆、反向硬拉5项。混合握法、下巴不过杠、俯卧撑画成屈臂撑等未通过图不导入；不能称全部完成。
- 最终自主生成原统一灰白解剖风格，网络和原四方进阶图/指南仅研究。只改标准图片及已审核街健恢复分类，不删动作，不改名称/说明/原视频/用户训练关联。没有提交、推送、API部署、小程序上传或微信工具窗口操作，手机界面尚未验收。


## 全量动作图片替换进度（2026-10-07 10:10UTC）

- 实际已替换237/434，197待完成，196个唯一素材（含原单幅平板），有氧20/20；只读数据库审计237项零错误，454公共/764标准记录保留。
- 第24批16张通过审核并CDN完整SHA/数据库回读确认，包含低杠/窄握卧推、后倾、龙旗、单手俄挺/后水平、辅助俄挺、前水平上摆和反向硬拉。其余手指朝向、多臂、错误支撑或幅度不足的图继续返修。
- 第25批28图准备执行，包括地面/双杠维多、反俄挺、龙压、单手变式与前批修正；已导入的团身前水平混合握法、吊环划船旋转、吊环俯卧撑RTO另补修，不能称全量完成。
- 仍为统一自生成解剖图，原四方海报/教练照片视频仅研究；静态单幅。只改标准图及经审核恢复分类，原动作/视频/名称/说明/历史保留。未提交/推送/部署/小程序上传或微信窗口操作；手机尚未验收。


## 全量动作图片替换进度（2026-10-07 10:57UTC）

- 实际替换271/434条，剩163；有氧20/20。第25批19张首次替换另2张握法补修，第26批15张通过并完成CDN完整SHA及数据库回读，静态单幅、动态关键阶段。
- 新增死亡俄挺、反手团身/宽距前水平、宽距地面维多、俄挺/肘俄挺/飞机/单手俄挺上压倒立、单手俄挺俯卧撑、屈臂慢起、击掌/虎扑屈臂撑、交叉手/宽距交叉手倒立和单幅前臂倒立。第26批11张未通过，继续返修，不能称全量完成。
- 新读李卓铭《街头极限健身》睡旗/人旗实拍及Burningate作者Claudio Negro《Calisthenics Sport》325页，核前水平上压、拉至贴腹及Russian forearm dip。研究页保存在artifacts/action-image-replacement/2026-10-07，不直接导入照片。
- 只更新标准图片及经审街健恢复分类；公共454/标准764行保留，名称、说明、用户视频与训练关联不改。最近独立只读审计256项零错误（10:41UTC），271条当前以每项SHA/回读日志为据。无提交/推送/部署/小程序上传或微信窗口操作，手机尚未验收。



## 全量动作图片替换进度（2026-10-07 11:31UTC）

- 已实际替换296/434条，剩138；253个唯一素材（含原单幅平板），有氧20/20。第27批19张通过（含3项已导入细节补修）；第28批7张通过并完成CDN完整SHA/数据库回读。
- 新鲜只读数据库审计296项零错误（11:31:46UTC），454公共/764标准动作行保留。未改变名称、说明、原视频、训练关联。错误支撑、重复阶段、杠未触腹和两根杠等生成结果均退回，不能称全量完成。
- 新读Sommer韩式屈臂撑91页、TMA直臂Zanetti及CWW教练Front Lever Touch说明；原四方动作海报/教练照片仅研究，最终仍自生成统一解剖插画。静态一幅、动态只保留确有区别的阶段。
- 第29批继续返修及新动作；用户要求全量完成，不能在部分批次结束。没有提交/推送/API部署/小程序上传或微信工具窗口操作，手机界面尚未验收。

## 全量图片替换最新记录（2026-10-07 11:53UTC）
- 已实际替换300/434，剩134；第29批3张覆盖4条（单手前水平引体、超宽/慢速超宽双力臂、吊环直臂双力臂），每项CDN完整SHA及数据库回读通过。第29批其余仍生成/复核中；不称全量完成。
- 当前生成结果有Manna后倾髋角、后倾倒立撑缺拱背、反手双力臂末端正握等问题，未导入。新增Stanchev本人《All about Maltese》作者自述及握法章节，只作为研究资料。
- 434条全量任务继续，静态单幅，最终统一自主生成。没有提交/推送/部署/小程序上传，手机尚未验收。

## 全量图片替换最新记录（2026-10-07 12:09UTC）
- 已实际替换并验证311/434条，剩123；267个唯一素材含单幅平板，有氧20/20。第29批最终11项CDN完整SHA及数据库回读均通过。
- 第30批23张继续生成/复核，包含10项返修、人旗引体、窄距人旗、单手举腿触杠、搭肘/彩虹/箭头式前水平、单手后水平引体、反手单杠飞机及鬣鳞蜥系列。未完成项继续工作，不称全量完成。
- 网络/原四方海报和教练实拍只研究动作，最终使用自主生成统一解剖插画；静态单幅。未提交/推送/部署/小程序上传；手机尚未验收。

## 全量图片替换最新记录（2026-10-07 12:49UTC）
- 已实际替换323/434条，剩111，279个唯一素材含单幅平板，有氧20/20。第30批12张通过；最终导入中一次CDN TLS断连，逐项重试完整SHA/数据库回读后通过，未绕过校验。
- 第30批11张退回：额外手臂、脚下支撑、两根杠、腕/肩高度及握距等。原海报4放大确认Manna后倾包含屈肘/伸肘，不应仅画Manna转V-sit，下一批按原图重建；同时补修已导入V-SIT后倾动态。
- 第31批25张计划继续，包含祈祷者、竖杠、Pelican及龙式器材；仍按全量任务推进。IAB已有研究标签getTab30秒超时，未重复开窗/下载远程图片绕过。原书/海报/作者文字为研究依据，不称已看网络视频。
- 无提交/推送/部署/小程序上传或DevTools窗口变更，手机尚未验收。

## 全量图片替换最新记录（2026-10-07 14:00UTC）
- 已实际替换335/434条，剩99，291个唯一素材含原单幅平板，有氧20/20。第31批12项首次替换、1项V-SIT后倾动态补修均完成完整CDN SHA/数据库回读；一次CDN断连已逐项重试成功。
- 第31批12项退回，含祈祷者动态缺端点、竖杠顶盖支撑、彩虹双臂锁定、反向龙式器材等；三项内建生成输出安全检查拒绝未返回图片，后续采用完整遮盖的运动服研究图重试。
- 第32批25项继续生成，重点单杠触腹接触点、正反/扣腕/直腕握法、CARUSO及Hefesto；新读四方指南74/81/82真实照片与Saian Mureau原书CARUSO定义。网络文字/原照片只研究，最终仍自主生成统一解剖插画。
- 没有提交/推送/部署/小程序上传或开发工具窗口变更；手机尚未验收。434条全量目标继续，不称完成。

## 全量图片替换最新记录（2026-10-07 14:18UTC）
- 已实际替换340/434条，剩94，296个唯一素材含平板，有氧20/20。第32批5项（直腕/宽距扣腕/正反宽距直臂贴腹及CARUSO）已完整CDN SHA/数据库回读。
- 第32批其余20项未通过：杠触胸而非腹、两根杠、反握画正握、弓箭手脱手、Hefesto两端都是支撑等。第33批25项生成/复核中，包含返修及侧挂/X旗/抓旗/单手地面与悬挂人旗、汉尼拔、吊环变举。
- CARUSO按Saian Mureau原书只用维多/前水平两个独特端点；后背双按四方162–164页与Calisteniapp教练EX296核肩后伸/韩式支撑。照片/视频不直接导入。
- 没有提交/推送/部署/小程序上传；手机未验收。全量继续，不以部分批次交付结束。

## 全量图片替换最新记录（2026-10-07 14:48UTC）
- 已实际替换359/434条，剩75；315个唯一素材含平板，有氧20/20。第33批15项已完整CDN SHA/数据库回读；第34批4项同样通过。
- 第34批触腹端点改善，但锁臂前水平端点误将杠置于头后，反握/交叉等仍错误，均退回。屈伸上误画翻身上，经体操kip原始资料确认后退回；不把错误动作为已完成。
- 第35批25项继续生成，3项通过视觉复核后导入中；后水平双力臂按四方原书164页三端点生成，后背双保持德式悬挂与韩式支撑的区别。
- 没有提交/推送/部署/小程序上传或开发工具窗口操作；手机未验收。全量任务持续推进，不以部分批次结束。

## 全量动作图片替换（2026-10-08 00:06 JST / 2026-10-07 15:06 UTC）
- 实际替换并逐项验证366/434条，剩68；322个唯一素材含单幅平板，有氧20/20。第35批7项通过：直臂PELICAN、正手/竖杠/弓箭手/辅助单手后背双、贴背后水平、单手肘贴腹。一次COS网络断连已逐项重试，完整CDN SHA及数据库回读通过。
- 第35批18项退回，包含后水双中间杠偏上背、拇指/中指握法、额外肢体、X旗重复阶段等。第36批24项继续生成，包含返修及双人俄挺/夹肘支撑/背后击掌/十字人旗/过肩单引/体操屈伸上。
- 用户要求全部替换，未完成68条继续；静态单幅、动态只画不同关键阶段，网络/原海报仅研究，最终自主生成同风格解剖图。无提交/推送/部署/小程序上传或开发工具窗口操作，手机未验收。

## 全量动作图片替换（2026-10-08 00:22 JST / 2026-10-07 15:22 UTC）
- 已实际替换375/434条，剩59；331个唯一素材含单幅平板，有氧20/20。第36批9项通过并逐项完整CDN SHA/数据库回读：正手直臂后水双、PELICAN、大天使、反向龙之俄挺、肘贴腹、夹肘支撑、双人俄挺、俄挺背后击掌、屈伸上。第36批15项退回，未把重复/多肢/握法/接触点错误计入。
- 第37批24项继续内建生成和视觉复核，重点扣腕/直腕/反手/宽距/交叉/弓箭手贴腹、上拉与撞腹端点。另复查已导入反手宽距直臂贴腹远手握法及祈祷者动态的手背支撑，下一轮补修。
- 最新全量只读审计366项零错误（15:07:48 UTC），其后9条以逐项CDN完整SHA及数据库回读为据；公共454/标准764行保留。原ID、名称、视频、说明与训练关联不改。
- 重新核作者Yordan Stanchev原书62–63页本人握法说明；浏览器已有研究标签getTab再次35秒超时，未开新标签/开发工具窗口。视频/照片只研究，最终仍自主生成同风格解剖插画，静态一幅。
- 用户要求全部替换，仍59待完成，持续工作，不称完成；无提交/推送/部署/小程序上传，手机未验收。

## 全量动作图片替换（2026-10-08 01:01 JST / 2026-10-07 16:01 UTC）
- 已实际替换并验证389/434条，剩45；345个唯一素材含平板，有氧20/20。第37批8项首次替换、1项反手宽距直臂补修；第38批6项首次替换及祈祷者手背/前臂方向补修，全部完成CDN完整SHA和数据库回读。CDN断连已重试通过，未绕过校验。
- 新鲜全量只读审计389项零错误（16:00:59 UTC），公共454/标准764行完整。第39批23项生成中，集中处理握法/腰腹接触/后水双端点和第38批细节返修；错误图不计入完成。
- 原四方海报、Sommer韩式倒立撑97页及Yordan Stanchev本人原书为研究依据；最终仍自主生成同风格解剖图，静态单幅。没有观看无法打开的网络视频，也未下载远程媒体绕过浏览器限制。
- 用户要求全部替换，45条继续完成。没有提交/推送/部署/小程序上传或开发工具窗口变更，手机尚未验收。

## 全量图片替换推进（2026-10-08 01:23 JST）
- 已实际替换400/434条，剩34；356个唯一素材含平板，有氧20/20。第39批11项逐项视觉复核、完整CDN SHA与数据库回读成功；错握法、缺完整幅度、反向前臂等12项退回继续返修。
- 第40批30项准备内建生成；手肘松解、仙人挂画及两项卡指动作仍查可靠姿势/握法，不能按不清晰缩略图编造。
- 全量继续，不作部分交付结束；无提交/推送/部署/小程序上传，手机尚未验收。

## 全量图片替换推进（2026-10-08 01:42 JST）
- 已实际替换409/434条，剩25；365个唯一素材含平板。第40批9项通过并完整CDN SHA/数据库回读，21项退回（特殊握法、额外肢体、手位变动、器材倾斜等）。
- 第41批21项继续重绘。四项无法可靠核实的动作已按用户先前隐藏授权处理：两项卡指、仙人挂画、手肘松解。前三项本已待审，手肘从STRENGTH改待审，旧错误图置空，保留所有ID、视频及训练关联；精确备份和读回由unverifiable-four文件记录。隐藏不计替换完成。
- 无提交/推送/部署/小程序上传，手机尚未验收；全量继续。

## 全量图片替换推进（2026-10-08 02:00 JST）
- 已实际替换418/434条，余16：12条继续修正，4条缺可靠姿势资料已暂时隐藏，隐藏不计替换。第41批9项CDN完整SHA和数据库回读通过，12项错握法/缺动态端点继续返修。
- 静态单幅，动态只保留有用端点，同风格自主生成；原照片仅研究。没有提交/推送/部署/小程序上传，手机尚未验收。
- 本轮lint、typecheck、78文件520测试、Next build/547页面全部通过。

## 全量图片替换推进（2026-10-08 02:21 JST）
- 已实际替换425/434条，余9：5条继续修正，4条无法可靠核实已暂时隐藏；隐藏不计替换。第42批4项、第43批3项通过CDN完整SHA及数据库回读；X旗COS上传一次TLS断连，逐项重试成功。
- 最新全量只读审计418项零错误（17:05:06UTC），其后7条逐项完整验证。特殊中指/手背握法继续修正，反手全幅倒立最低端点肩已与手同高，仅研究素材、尚未算最终替换。
- 第44批5项原生生成继续，不作部分交付结束。没有提交/推送/API部署/小程序上传或DevTools窗口改动；手机未验收。

## 全量动作图片处理完成（2026-10-08 02:51 JST）
- 全范围434条已逐项处理：430条实际替换并验证，4条无法可靠核实暂时隐藏（单杠卡指俄挺、单杠卡指飞机、仙人挂画、手肘松解）。隐藏不计替换，不能称434条全部换好。保留ID、视频与训练关联。
- 17:51:27UTC新鲜全量只读审计430条零错误，公共454/标准764完整；正式及体验匿名公共动作接口各430条新图URL逐条一致，failures=[]。有氧20/20完成。
- 静态单幅；普通/宽距祈祷者俯卧撑、地面反手转手背飞机采用准确单幅关键姿势，不声称完整运动序列。最终统一自主生成CoachLink解剖插画，错误/不确定输出未导入。
- 本轮lint/typecheck、78文件520测试、Next build/547页通过。手机画面未验收；无提交/推送/API部署/小程序上传或DevTools窗口改动。当前工作区D:/files/coachlink。
- 完整结果docs/work/action-image-full-replacement-2026-10-08.md；证据artifacts/action-image-replacement/2026-10-07。仅剩四项获取可靠姿势资料后再生成恢复；本轮全库替换/隔离处理已结束。

## 本地动作图片审核库交付（2026-10-08）
- 430 当前动作图片、4 隐藏动作可在 http://127.0.0.1:3002 审核；合格/不合格/撤销、备注及放大筛选已实现。
- 记录落盘 artifacts/action-image-review/reviews.json 与 rework-queue.json；换图按SHA恢复待审。后台node PID53840、浏览器交付标签保留供用户审核，重启后可用 scripts/start-action-image-review.cmd。
- 代理只用隔离记录做保存/重启等验证；实际用户记录仍空。CUA浏览器搜索、放大、有氧分类通过，有截图。后续按用户不合格清单重做；文档 docs/work/action-image-local-review-2026-10-08.md。
- 本地审核工具最终检查：lint/typecheck/Next547页、D盘临时目录单worker78文件520测试全部通过；用户真实审核记录为空待审。首轮系统盘空间失败已在文档记录，未删除任何原有素材释放空间。

## 动作审核库前六页返修完成（2026-10-08）
- 18条用户指定公共动作实际删除，2条重量比例重复俯卧撑合并；3处名称/可调负重属性规范化。六张错误图已全部重新生成并导入，完整CDN SHA及canonical回读通过；原吊环教学说明保留。
- 原430审核位置和18页固定（410图+20处理记录），反手扣腕撞腹仍原第144项、第6页末，继续按钮/下一页实际验证通过；后续页名称、图片、公共行逐字段未改。旧评审保留，新图待用户审核。
- 正式/体验公共接口均410条、所有图片对应、0额外训练项。typecheck与81文件558测试通过，Next547页构建通过；lint仅未配置提示。未改既有测试。
- 本地审核服务PID17844/3002已保留，浏览器停第6页继续位置。没有Git提交推送、API部署或小程序上传。报告docs/work/action-first-six-corrections-2026-10-08.md。下一步用户继续审核后续页，不宣称全部姿势通过人工审核。
