# 高频复发 Bug 清单（持续追加）

> 目标：把“反复出现”的问题变成固定检查项，给开发同学和 AI 在改代码前快速过一遍。

## 1) 索引语义混用（高频）

- **现象**：新增正常，删除/更新偶发失败或命中错误数据。
- **根因**：同一链路里混用了业务序号和数组下标。
- **统一规则**：
  - `dayIndex` = 业务序号（通常从 1 开始）
  - `arrayIndex` = 数组下标（从 0 开始）
  - 新增/删除/更新必须使用同一种索引语义，必要时先显式转换。
- **改动前自检**：
  - 事件回调参数和父组件处理逻辑语义一致
  - `findIndex` 的输入输出没有再次当作业务序号使用
  - 新增、删除、编辑三条路径都手动点一次
- **典型案例**（2026-02-15）：
  - `PlanDayCard` 组件传入的 `dayIndex` 是数组索引（0-based）
  - `handleActionSetChange` 使用 `findIndex(d => d.dayIndex === dayIndex + 1)` ✅
  - `handleRemoveActionSet` 遗漏 `+1`，写成 `findIndex(d => d.dayIndex === dayIndex)` ❌
  - 结果：添加/编辑动作正常，删除动作失效（找不到匹配的天）

## 2) 前端状态改了但持久化没跟上（高频）

- **现象**：页面上看已生效，刷新后丢失。
- **根因**：只更新本地 state，遗漏自动保存/手动保存链路。
- **统一规则**：涉及编辑态时，必须确认“本地状态 -> service -> API -> DB”闭环。

## 3) 可选字段空值语义不一致（高频）

- **现象**：同一字段在不同页面表现不一致（`''`、`null`、`undefined` 混用）。
- **根因**：接口层未统一空值约定。
- **统一规则**：在 service/API 层统一空值策略，组件层只做输入展示。

## 使用方式

- 新发现“重复两次以上”的 bug，按上面格式补充一条。
- 关联更新：`docs/done/engineering/代码检查清单.md` 中加入对应可勾选项。

## 4) 状态枚举与数据库约束不一致（高风险）

- **现象**：接口日志显示业务成功进入创建流程，但数据库报 `violates check constraint`，最终插入失败。
- **根因**：应用层新增了状态值（如 `pending`），但表字段 `CHECK` 约束未允许该值（如 `check_plan_status`）。
- **统一规则**：
  - 状态字段变更必须先核对 DB 约束允许列表；
  - 延迟/中间态优先复用已有合法值（如 `scheduled`），避免直接引入新枚举；
  - 若确需新状态，先补迁移再发版代码。
- **改动前自检**：
  - grep 状态常量，确认跨 API/service/定时任务一致；
  - 在 SQL 中确认约束列表包含目标状态；
  - 跑一遍“创建 -> 查询 -> 状态迁移”链路。

## 5) 同名动作多ID导致图表“有选项无数据”（高频）

- **现象**：力量曲线下拉里出现同名动作，选中后显示“暂无数据”，但实际该动作有历史记录。
- **根因**：动作下拉与历史查询在“动作唯一键”上不一致（前者按 action_id 去重，后者又依赖另一个 action_id/来源表）。
- **统一规则**：
  - 展示层下拉按“归一化动作名”去重；
  - 历史查询同时传 `actionId + actionName`，后端优先 ID，名称兜底；
  - 后端取动作元信息需 `coach_actions -> student_actions` 双源兜底。
- **改动前自检**：
  - 同名动作（不同 ID）场景下，下拉只出现一项且能出曲线；
  - 随机抽 1 个学员验证“有历史数据的动作不会显示空图”；
  - 检查 `AUTO_STATE` 仅用于状态/兜底，不污染 PR 时间线。

## 6) 新增/导入动作未确定 canonical（高风险）

- **现象**：新增动作后继续出现“同名不同 ID”，导入链路反复制造重复动作。
- **根因**：新增/批量导入只按名称插入，未在写库前确定 `canonical_action_id`，且重复校验只看原始 name。
- **统一规则**：
  - 所有动作类型在写入前必须落地 `canonical_action_id`；
  - 个人动作库“手动新建”场景：优先匹配，未匹配时自动创建 canonical；
  - 外部导入/复制场景：必须命中已有 canonical（或显式指定）；
  - 同域去重必须同时校验“归一化名称 + canonical_action_id”；
  - 批量导入需额外做“请求内去重”。
- **改动前自检**：
  - 单个新增：无 canonical 时可自动匹配，匹配失败应明确报错；
  - 批量导入：同批重复动作不会重复入库；
  - 教练库与学员库两条链路行为一致。

## 7) 动作名匹配多个 canonical_action_id 时阻断（中频）

- **现象**：智能导入/批量创建时报错「动作「xx」匹配到多个 canonical_action_id，请手动指定」，流程中断。
- **根因**：同一归一化名称对应多条 canonical_actions（如别名重叠、重复录入），`resolveCanonicalActionId` 默认不允许歧义。
- **统一规则**：
  - 需要强制唯一匹配的场景（如手动新建、复制）保持 `reason: "ambiguous"` 报错；
  - 批量/导入等可接受“取首个”的场景，传入 `pickFirstOnAmbiguous: true`。
- **改动前自检**：
  - 确认调用方对 ambiguous 的期望（必须手动指定 vs 可自动取首）；
  - 批量创建类 API 启用 `pickFirstOnAmbiguous` 后，仍保证写入有合法 canonical。

## 8) 编辑提案 `null/undefined` 语义丢失导致“看起来没改”（高风险）

- **现象**：公共动作编辑提案里，提交后对比弹窗显示“无差异”或审核通过后部分字段未生效（尤其是清空/替换视频、描述等可空字段）。
- **根因**：提案构建与审核落库使用 `??` 回退，导致“显式传 null（我要清空）”被当成“未修改”。
- **统一规则**：
  - 提案入库时区分“字段未传（undefined）”和“显式置空（null）”；
  - 审核应用提案时使用提案最终值，不再二次 `??` 回退；
  - 提交前必须做一次 diff，无改动禁止提交。
- **改动前自检**：
  - 分别验证：改值、清空值、上传视频替换值 三种路径；
  - 审核对比中可见真实差异；
  - 审核通过后 DB 与详情页展示一致。

## 9) AI 修改器跳过“缺失动作确认”直接落库（高风险）

- **现象**：AI 修改预览后可直接应用，计划里出现动作库外 `actionId`（前端显示“未知动作”或类型错配）。
- **根因**：修改链路只有“提示”没有“强制门禁”，未先完成“缺失动作 -> 人工确认 -> 创建/映射”闭环。
- **统一规则**：
  - AI 修改链路必须分两段：`预览` 与 `确认后应用`；
  - 预览阶段识别库外动作，必须进入人工确认（使用已有/新建动作）；
  - 应用接口必须做服务端硬校验：拒绝库外 `actionId`，拒绝 `itemType` 与动作类型不一致。
- **改动前自检**：
  - 构造“替换为新动作名”场景，确认必须先经过人工确认步骤；
  - 人工确认后新建动作成功，并完成 `tempActionId -> realActionId` 映射；
  - 跳过确认直接调用 apply 时，接口返回 400 且不落库。

## 10) AI 修改参数键不统一导致“动作新增了但组次不显示”（高风险）

- **现象**：AI 预览/应用后动作已插入，但编辑器里 `组数/次数/休息时间/重量` 为空或显示异常。
- **根因**：AI 生成 `sets/reps/rest_seconds/weight`，而编辑器读取的是 `组数/次数/休息时间/load`；字段语义未在链路中统一。
- **统一规则**：
  - AI 批量修改结果在进入编辑器前必须做参数标准化（英文字段 -> 中文字段）；
  - 缺失动作流程必须拆成两步：先“确认并映射动作”，再“确认应用计划”；
  - 映射完成后需把结果回写到当前编辑态，保证用户在应用前可见最终参数。
- **改动前自检**：
  - 用“新增动作 + 指定组次/休息/重量”测试，预览阶段即可看到参数落位；
  - 完成动作映射后，左侧计划应显示真实动作名和参数；
  - 未执行映射时，应用按钮必须禁用或明确拦截。

## 11) 新增必填字段导致老用户被门禁误拦（高频）

- **现象**：已注册老用户登录后被强制弹出"完善档案"问卷，明明之前已填过。
- **根因**：门禁条件从 `onboarding_completed === true` 改为 `onboarding_completed === true && 所有核心字段完整`，但老用户缺少新增的必填字段（如 `fitness_level`），导致判定为"未完成"。
- **统一规则**：
  - 流程完成标记（`onboarding_completed`）一旦为 `true`，后续不得因新字段追加而降级回"未完成"；
  - 新字段补全应走"温和引导"（如个人设置页提示），不走强制拦截弹窗；
  - 门禁条件只用 `onboarding_completed`，核心字段完整度做"建议补全"而不做"强制拦截"。
- **改动前自检**：
  - 新增 profile 字段时，检查是否影响了首登 / 导航门禁逻辑；
  - 用老账号（有 `onboarding_completed: true`、缺新字段）登录验证不被拦截。

## 12) AI 新建动作未先复用公共库导致重复动作（高风险）

- **现象**：AI 缺失动作确认中，明明公共动作库已有同名/同 canonical 动作，却直接在个人库新建，产生重复动作与后续统计分裂。
- **根因**：创建链路只查个人库，不查 `community_actions`，且未区分 `coach/student` 目标库权限边界。
- **统一规则**：
  - AI 缺失动作确认的 `create_new` 分支必须先查公共库（canonical 优先，其次规范化名称）；
  - 命中公共库时优先“加入我的动作库”，未命中才允许从头创建；
  - 接口必须显式接收 `targetActionType`（`coach`/`student`），并按 session 做权限校验。
- **改动前自检**：
  - 构造“公共库已存在同名动作”场景，确认最终复用公共动作而非新建重复项；
  - 同时验证 `coach` 与 `student` 两条链路写入各自动作库且不越权；
  - 复用后计划中的 `tempActionId -> realActionId` 映射完整且可应用。

## 13) 学员端误复用教练 API 导致 AI 编辑器不可用（高风险）

- **现象**：学员端也有 AI 编辑器入口，但发起后直接返回 Unauthorized/Forbidden，无法预览修改。
- **根因**：前端复用了教练 `batch-operation` 链路，却未显式传递目标类型，后端按教练权限门禁处理。
- **统一规则**：
  - AI 编辑链路必须显式传 `targetActionType`（`coach`/`student`），禁止靠默认值推断；
  - 后端按 `targetActionType` 做权限与表路由：`coach_actions/coach_plan_templates` 与 `student_actions/student_plan_favorites`；
  - `coach` 分支必须校验 `is_coach`，`student` 分支只允许访问 `session.user.id` 归属数据。
- **改动前自检**：
  - 学员端 `mode=local` 可完整走通“预览 -> 缺失动作确认 -> 应用到草稿”；
  - 教练端原链路回归正常，不受学员改造影响；
  - 抓包确认请求体均包含 `targetActionType`，且后端未跨库查询。

## 13) 展示索引与 execution 索引混用导致"打卡命中错误项目"（高风险）

- **现象**：页面能看到轻任务列表，但点击完成/更新后，状态写回到错误任务，或新增后的轻任务无法正确显示/完成。
- **根因**：展示层沿用 `day.actionSets` 的数组下标，持久化层实际使用的是 `execution.action_executions` 下标；当存在 `student_extra` 追加项或过滤渲染时，两者不再一一对应。
- **统一规则**：
  - 展示模型里同时保存 `source index` 与 `execution index`，提交接口时只用 `execution index`；
  - 若页面允许追加条目，模块构建必须合并 `execution` 中的 `student_extra` 项，不能只看计划原始 `actionSets`；
  - `item_type/type/source_action_index` 必须在 execution JSON 中显式保留，前端禁止靠位置猜测。
- **改动前自检**：
  - 原计划项与追加项都能分别完成、刷新后状态正确；
  - 过滤后的列表（如 strength-only）仍能准确定位到原 execution 项；
  - 新增、完成、回显三条链路都手动点一次。

## 14) 覆盖计划后旧 execution 越界项被误显示为轻任务（高风险）

- **现象**：教练已把当天轻任务改成 1 条，但学员端仍显示 2~3 条（常见为旧“入睡/跑步”任务残留）。
- **根因**：学员端把 `execution.action_executions` 中“source_action_index 越界”的旧计划项也当作 extra 展示；覆盖计划后 `actionSets` 变短时触发该误判。
- **统一规则**：
  - `extra` 任务仅认定为“学员自行追加”（`source === "student_extra"`，或历史兼容 `source_action_id` 存在且 `source` 为空）；
  - 不得仅凭“索引越界”把执行项判定为 extra；
  - 计划覆盖后展示层必须优先遵循当前 `training_days.actionSets`，避免旧 execution 污染展示。
- **改动前自检**：
  - 构造“覆盖前 3 条、覆盖后 1 条”的同一天场景，学员端应只显示当前计划 + 学员手动追加项；
  - 验证 `student_extra` 仍可正常显示、打卡、删除；
  - 验证训练模块总数不被旧越界 execution 项抬高。

## 15) `useEffect` 依赖对象/数组引用不稳定导致重复请求与界面闪烁（高风险）

- **现象**：弹窗/列表一打开就反复在 skeleton、空白态、真实数据之间切换，终端里同一个接口被高频重复调用。
- **根因**：`useEffect` 或 `useCallback` 直接依赖了渲染期新建的数组/对象/函数（如默认 props 数组、内联 filter 配置），组件每次 `setState` 后依赖引用变化，又触发下一轮请求。
- **统一规则**：
  - 请求型 effect 不要直接依赖临时数组/对象引用；
  - 先把依赖规范化为稳定标识（如 `join('|')`、序列化 key、显式 memo）再参与依赖比较；
  - 共享弹窗/选择器组件优先通过 service 层请求，避免局部重复拼装请求逻辑。
- **改动前自检**：
  - 打开弹窗后，同一接口是否只触发预期次数；
  - 加载完成后，组件是否稳定停留在列表态，而不是重新回到 skeleton；
  - 父组件高频重渲染时（计时器、输入框、toast），子组件请求 effect 是否会被误触发。

## 16) `/today-training` 外卡与 `/training-execution` 计划值取数源不一致（高风险）

- **现象**：外层今日训练卡片已经显示新重量，点进执行页后 `planned_weight` 仍是旧值。
- **根因**：`get-instance` 已按 `coach_actions -> student_actions` 双源补齐动作元信息并参与算重，但 `execution/start` 或 `syncExecutionPlan` 仍只查单一动作表，或只依赖 `actionSet` 原始名称，导致某些动作拿不到真实 `name/canonical_action_id/includesBodyWeight`，执行页继续沿用旧计划值。
- **统一规则**：
  - 任何“计划展示”和“execution 初始化/同步”链路，动作元信息查询都必须统一 `coach_actions -> student_actions` 双源兜底；
  - 参与 1RM/负荷计算的动作名，优先使用动作表真实名称，其次才回退 `actionSet.actionName/set_name`；
  - `dayIndex` 比较统一转 `Number(...)`，避免 `string/number` 混用导致同步直接失效。
- **改动前自检**：
  - 修改学员 1RM 或动作库配置后，外层卡片与执行页首组 `planned_weight` 一致；
  - `coach_actions` 与 `student_actions` 两类动作都各抽样验证一次；
  - 对已有 `in_progress/completed` execution 刷新后，`planned_weight/planned_reps/planned_rest_seconds` 会同步更新。

## 17) 历史计划详情误套当前订阅门禁导致列表可见但点开 403（高风险）

- **现象**：学员在“全部计划”里能看到 `completed/archived` 历史计划，点击后却提示“计划不存在”或接口返回 `403`。
- **根因**：历史详情链路虽然按实例 `id` 直查到了计划，但后端仍继续套用“当前订阅有效期 / 周数窗口”门禁，把已完成历史计划误当成当前训练内容拦截。
- **统一规则**：
  - 显式按实例 `id` 查看历史详情时，若实例状态为 `completed/archived`，只能校验“是否属于该学员/教练”，不能再按当前订阅有效期二次拦截；
  - 只有“按 subscription 获取当前计划”或“查看 active/paused 计划”时，才应用订阅有效期和周数窗口限制；
  - `get-instance` 与 `get-with-executions` 这类详情/执行聚合接口必须保持同一权限语义，避免一个放行、另一个 403。
- **改动前自检**：
  - 用已过期订阅的学员账号打开已完成计划详情，确认能看到完整训练天和执行记录；
  - 当前进行中的计划仍会按订阅有效期正常拦截；
  - 教练端查看学员历史计划弹窗与学员端“全部计划”详情表现一致。

## 18) CI/Docker 的 Node 版本低于原生依赖要求导致 `npm ci` 失败（中高风险）

- **现象**：GitHub Actions 或 Docker 构建在 `npm ci` 阶段失败，`isolated-vm` 等包触发 `node-gyp` 编译报错（如 `v8::SourceLocation`、override 不匹配）；本地用较新 Node 可能正常。
- **根因**：依赖（如 `isolated-vm@6.x`）声明 `engines.node >= 22`，与 CI/镜像中的 Node 20 不一致，V8 头文件与预编译逻辑不匹配；Alpine 镜像还缺少 `python3/make/g++` 时也会加剧失败。
- **统一规则**：
  - 以 `package.json` 的 `engines` 与关键原生依赖的 `engines` 为准，**GHA `setup-node`、Dockerfile 基础镜像、本地推荐版本三线对齐**；
  - Alpine 上安装含原生模块的依赖时，builder 阶段需具备编译链（如 `apk add python3 make g++`）。
- **改动前自检**：
  - 升级/新增带原生绑定的依赖后，看其 `engines` 与当前 CI Node 是否一致；
  - 修改 Dockerfile 后本地或推一次分支验证 `npm ci` + `npm run build`；
  - 与 `docs/done/engineering/代码检查清单.md` 中 CI 小节勾选项对照。

## 19) `path.join` / `fs` 收到 `undefined` 路径片段导致 `ERR_INVALID_ARG_TYPE`（中风险）

- **现象**：接口或页面报错 `The "path" argument must be of type string. Received undefined`；小程序端若把接口返回的 `message` 直接展示，可能整屏白底黑字显示该 Node 报错。
- **根因**：`path.join(base, 'public', 'docs', filename)` 等调用中，`filename` / `traceId` / `relativeName` 等任一片段为 `undefined` 时，Node 会抛出上述 TypeError。
- **统一规则**：
  - 读文件前校验路径分量已定义为非空字符串；
  - 写 trace/落盘前校验 `traceId`、`relativeName`；
  - 小程序 `Taro.reLaunch({ url })` 前校验 `url` 为以 `/` 开头的字符串。
- **改动前自检**：
  - 新增「动态拼路径」的 API 时，对 slug、id、文件名做存在性与类型校验；
  - 真机复现后对照后端日志是否同一条 TypeError。

## 20) 本地草稿恢复前即写入 storage，冲掉历史数据（高风险）

- **现象**：再次进入页面时，表单像被清空；性别/体重与档案不一致；用户反复填次数、负重等。
- **根因**：`useEffect` 在首屏用**空 state** 立刻 `setStorageSync`，早于异步「读档案 + 读旧草稿」完成，把 `sl_calc_form_data` 覆盖成空对象；或恢复草稿时用 storage **覆盖**档案中的性别/体重。
- **统一规则**：
  - 带本地缓存的表单：增加 **hydration 门闩**，仅在「读完 storage / 合并完档案」后再允许自动持久化；
  - 多数据源时明确优先级（如档案优先于草稿中的性别、体重）。
- **改动前自检**：
  - 首屏是否会在初始化完成前写入缓存键；
  - 合并顺序是否与产品口径一致。

## 21) 微信小程序 Canvas 绘制网络图未先落地本地路径（中高频）

- **现象**：分享海报、合成图里用户头像或远程资源始终空白或走占位，开发者工具无报错或仅偶发 `getImageInfo` 失败。
- **根因**：`https` 头像 URL 直接赋给 `createImage` 或仅 `getImageInfo`，不符合小程序对网络资源的落地要求；本地品牌图仅依赖打包 URL 时，在分包/产物路径下也可能解析失败。
- **统一规则**：
  - 远程图：先 `Taro.downloadFile` 再 `getImageInfo`/`createImage`（并确保下载域名已在后台配置）；
  - 包内固定资源：用 `config.copy` 落到 `dist` 已知路径，绘制时多候选路径兜底；
  - 头像字段兼容 `avatar_url` / `profile.avatar_url` 等多层结构。
- **改动前自检**：
  - 真机与开发者工具各测一张 `https` 头像；
  - 产物目录中是否存在 copy 的静态文件；
  - 关闭网络时包内 Logo 是否仍能绘制。

## 22) 微信小程序 Canvas 2D：`await` 插在同步绘制中间导致下半张「空白」（高风险）

- **现象**：海报/分享图只有顶部几行（昵称、时间、副标题），力量分、四格、底部品牌与二维码整段缺失。
- **根因**：在 `canvas.width/height` 重置并 `scale` 后，先同步画了头部，再 `await loadFontFace` / `getImageInfo` 等；恢复执行后后续 `fillText`/`drawImage` 在部分基础库上不再生效或绘制被丢弃。
- **统一规则**：
  - 主版面（分数、指标、文案、二维码等）在**同一段同步流程**内画完；`await` 仅放在「整图画完前」预加载字体，或放在「整图主体画完后」叠加非关键资源（如 Logo 盖图）。
  - 设置画布尺寸后用 `ctx.setTransform(dpr,0,0,dpr,0,0)`，避免与历史变换叠加。
- **改动前自检**：
  - 搜索绘制函数内的 `await`，确认其不在「只画了头部」与「画分数/四格」之间；
  - 开发者工具与真机各导出一张，检查是否仅顶部有字。

## 23) 小程序海报 Hook：`draw` 未 `return` 异步 Promise，导出早于绘制完成（高风险）

- **现象**：首次点「生成分享卡片」不出图或白图；再次点击也不出图（`generating` 与 `useCallback` 依赖叠加后更难恢复）。
- **根因**：`useSharePoster` 内 `await draw(ctx, data, canvas)`；若业务写成 `draw: (ctx, d) => { drawPoster(ctx, d) }` 而未 `return drawPoster(...)`，则 `drawPoster` 返回的 `Promise` 被丢弃，`canvasToTempFilePath` 在异步绘制完成前就执行。
- **统一规则**：`draw` 若内部有异步（字体、头像 `downloadFile` 等），必须 **`return` 该 Promise**（或改为 `async (ctx, d, c) => { await ... }`）；并发用 `useRef` 防重入，避免把 `generating` 放进 `useCallback` 依赖导致闭包/早退问题。
- **改动前自检**：
  - `draw` 回调是否显式 `return` 异步绘制函数的结果；
  - `createSelectorQuery` 在分包页是否 `.in(getCurrentInstance().page)`（按需）。

## 24) `useEffect` 依赖「每次渲染都是新引用」的会话对象 → 无限 setState（高风险）

- **现象**：控制台 `Maximum update depth exceeded`；某页一进就疯狂重渲染。
- **根因**：`const user = authService.getAuthSession().user`（或整个 `session`）引用每轮变化，却放进 `useEffect(..., [user])` 并在 effect 内 `setState`，形成死循环。
- **统一规则**：依赖里只放 **稳定原始值**（如 `user?.id`、`isAuthenticated`）；effect 内需要最新用户时再 `getAuthSession()`；合并 `setState` 时用浅比较避免重复写入同一快照。
- **改动前自检**：搜索 `getAuthSession` / `getCurrentUser` 与 `useEffect` 依赖数组是否同时出现「整条 user/session 对象」。

## 25) 并发/链式拉数 + 全局 `loading`：`finally` 被旧请求关掉、新请求仍飞 → 骨架屏卡死（高风险）

- **现象**：接口面板里请求都 200，但页面一直停在骨架屏/全屏 loading。
- **根因**：同一页 `loadData` 被 `useDidShow` 与 `useEffect([loadData])` 或「`loadData` 依赖会在加载末尾 `setState` 的字段」重复触发，多段 `Promise` 重叠；先结束的那段在 `finally` 里 `setLoading(false)`，后发起的请求又把 `loading` 设为 `true`，若时序错乱或旧 `finally` 误执行，会出现 `loading` 长期为 `true`。
- **统一规则**：并发拉数用 **请求序号/AbortController**，仅在 **当前序号** 的 `finally` 里结束 loading；`loadData` 不要依赖「本次加载会改写的 state」；页面展示用 `useDidShow` 与 `useEffect` 二选一去重，避免首屏双击请求。
- **改动前自检**：`setLoading(false)` 是否只对应「最后一次发起的请求」；`useCallback(loadData)` 依赖里有无 `activeXxxId` 这类会在 `loadData` 末尾被赋值的变量。

## 26) 聚合接口 vs 列表接口口径不一致 → 顶部 stats 与 tab/列表数字打架（中高频）

- **现象**：教练详情/学员详情等页面，顶部统计卡显示 `7 教学内容`，下面 tab 却写 `教学内容(2)`；同一字段在不同视图里前后矛盾。
- **根因**：`get-aggregated-info` 类聚合接口 `count(*)` 时**不带可见性/状态过滤**，列表接口（如 `get-contents`）按访问权限/可见 tier `lte/eq` 过滤，两端各自正确但口径不同，UI 用同一个 label 渲染就互相打脸。
- **统一规则**：
  - 同一页面里 stats 与 list 的"同名指标"必须**显式选定一个口径**（全量发布数 / 当前可见数）并在两个端点上对齐；
  - 推荐"全量返回 + 列表项 `is_locked` 标记 + 服务端按权限脱敏 body/资源 URL"，避免列表接口 0 数据但聚合数还在的违和感；
  - label 文案上区分不同口径（"已发布" vs "可查看"），避免共用"教学内容"。
- **改动前自检**：
  - 改聚合接口或列表接口任意一端时，搜全工程同字段的另一端是否也改；
  - 列表接口若按 `accessTier` 过滤，确认 `total/count` 是否需要重新对齐聚合口径；
  - 取消列表过滤时**必须**在路由层对受限行做字段脱敏（`content`、`media_urls`、付费链接），列表 body 的曝露面不能比详情接口的 403 更宽。
- **典型案例**（2026-05-04）：
  - `get-aggregated-info.contentCount` 不过滤 `required_tier`，`get-contents` 按 `accessTier` 过滤；
  - 教练详情页顶部 7 / tab 2 不一致，Web 与小程序同源同 bug；
  - 修复：`get-contents` 改为全量返回，未达 tier 的行 `content` 截断为 200 字预览、`media_urls` 清空、追加 `is_locked: true`；前端按 `is_locked` 渲染锁屏样式。

## 27) Web ↔ 小程序 UX 漂移：小程序自行长出 Web 没有的按钮/入口（中频）

- **现象**：同一个用户角色（如订阅中的学员），网站教练主页底部一个「立即订阅 / 查看价格」按钮，小程序却多出「智能生成计划 / 续费 / 填写问卷」等三四个按钮；标签命名也不一致（Web `教练专栏` vs 小程序 `教学内容`）。
- **根因**：小程序与 Web 各自迭代时，weapp 端独立加 CTA / 改文案，没有同步回 Web；`docs/PROJECT_BIBLE.md` 把它们当作同一产品但缺少"以 Web 为基线"的规则。一旦 Web 改版，weapp 不会自动跟上；反过来 weapp 加的入口（如 `/discovery/generate-plan`）在 Web 上根本不存在。
- **统一规则**：
  - 教练主页、学员我的会员、订阅价格等"双端公共页"统一以**Web 为视觉/CTA 基线**，weapp 仅在交互模式（页面栈、tab 容器、底部固定 CTA 行为）层面做适配；
  - weapp 不得新增 Web 没有的功能性按钮（如「智能生成计划」），如确需要先在 Web 上落地；
  - 标签/口径文案（"教练专栏"、"学员评价"等）以 Web 文案为准，weapp 直接照搬；
  - 续费、查看问卷这种带角色门槛的入口，要么放在 Web 同等位置（如简介区/订阅面板内），要么不放；底部 CTA 只允许有"主行动"按钮一个。
- **改动前自检**：
  - 新增/调整 weapp 教练或学员主页的按钮、标签时，先打开 `src/app/coach/profile/[id]/page.tsx`、`src/app/me/membership/...` 等对照页，逐项确认 Web 是否有对应元素；
  - 如果 Web 没有，先和产品/网页端确认是否要补，而不是 weapp 单飞；
  - 提交前在 weapp 真机回归"匿名"、"waiting"、"active"、"expired" 四种订阅态，每种态的可见按钮数应与 Web 一致；
  - 任何文案改名（如 `教学内容` → `教练专栏`）必须双端同步改，避免 stats/列表/tab 三处不一致。
- **典型案例**（2026-05-04）：
  - 教练详情页底部小程序额外渲染「智能生成计划」「填写/更新训练需求问卷」按钮，Web 无；
  - 小程序 tab 写 `教学内容(N)`，Web `CoachContent.tsx` 写 `教练专栏(N)`；
  - 修复：底部 CTA 折成单按钮（active→「查看订阅」/ waiting→「查看订阅进度」/ 默认→「立即订阅 / 查看价格」），「查看问卷」按钮迁入 `CoachIntro` 简介区（与 Web `CoachIntroduction` 同位置），「续费」按钮迁入 `PricingSection` 面板内（与 Web `CoachSubscription` 同位置），tab 文案改为 `教练专栏`。

## 28) 异步队列任务：先 Ack/commit 再写 DB 终态 → 丢任务或重复处理（高风险）

- **现象**：视频分析/AI 生成/批处理任务在 worker 崩溃、Kafka 重平衡或网络抖动后，前端长时间停在 `queued/processing`，或者同一任务被多个 worker 重复处理。
- **根因**：队列消息被当作任务状态源；consumer 收到消息后先 ack/commit，或没有用 DB 状态做幂等 claim。队列只保证投递语义，不等于业务终态已经落库。
- **统一规则**：
  - DB 任务表是 source of truth，队列只传轻量 `{ taskId, taskType }` 唤醒 worker；
  - worker 收到消息后必须通过 DB 乐观锁/lease 把 `queued` claim 成 `processing`；
  - 只有成功写入 `done/failed/expired` 等业务终态后，才 ack/commit Kafka offset；
  - memory/local 队列应在 Web 进程内嵌 worker 或同进程测试环境中使用，并配 recover loop，从 DB 中扫描可恢复的 `queued` 任务重新 publish，避免进程重启丢内存消息。
- **改动前自检**：
  - 新增队列 consumer 时，检查 ack/commit 是否发生在 DB 终态写入之后；
  - 搜索任务表状态流转，确认重复消息只会有一个 worker claim 成功；
  - 本地 memory 模式是否明确说明只适合同进程/内嵌 worker，并配了 DB recovery。

## 29) 训练日身份只靠数组位置 dayIndex：原地改计划让历史训练错位（高风险）

- **现象**：教练删除/插入某天或某周、把过去的休息日改成训练日、用模板“覆盖”已有训练的计划后，学员日历上的完成标记落到别的内容或休息日，“今天练什么”退回早已跳过的天（“请先完成第N天”），扣费范围也跟着变。
- **根因**：`plan_instance_executions` 只存 `day_index`；2026-09-15 起“更新计划”原地覆盖同一实例，网页编辑器删天/删周会把后面所有天重新编号，执行记录按旧编号挂到新内容上。
- **统一规则**：
  - 有训练记录（completed/abandoned/in_progress/timed_out/paused）的最远一天及之前视为历史：不得删除、插入、增删或调换动作、切换训练/休息，只能改组数、次数、重量、备注（`packages/core/src/planEditLock.ts`）。
  - 服务端 `update-instance` 与 `create-instance` 原地修订路径必须校验（409 `PLAN_DAYS_LOCKED` / `PLAN_START_LOCKED`）；客户端只做体验层拦截与合并，不能替代服务端。
  - “同一动作”判定要宽松：两边都有动作 id 比 id；只有一边有 id（客户端尚未解析）视为同一动作；都没有 id 才比动作名；调换顺序算结构变化。判定过严会把合法的改组数/次数也拦成 409。
  - 编辑器保存时用来合并的“已保存版本”必须是深拷贝，否则界面编辑会同时改到基线，合并失效；收到 409 后要重新拉取训练记录刷新锁定范围。
  - 整体更换计划走“新建阶段”，不要原地覆盖。
- **改动前自检**：
  - 任何会生成新 `training_days` 数组的入口（删天、删周、模板导入、AI 批量、智能导入、复制天、小程序“分配模板”）保存前是否经过 `mergeLockedPlanDays`？
  - 新增会改写计划结构的服务端路径时，是否调用 `findLockedPlanDayViolation`？
- **典型案例**（2026-10-13）：Web 编辑器 `handleRemoveDay`/`handleDeleteWeek` 会重新编号、小程序模板覆盖与 `assign-plan` 分配模板走原地修订，均无锁；已加服务端锁与双端合并（分配模板保留已训练天，模板从第 N+1 天起生效）。

## 30) 状态迁移只在读接口里落库，事件永不触发（高风险）

- **现象**：阶段练完后从不提醒教练安排下一阶段或引导续费；`coach_automation_jobs` 中 next_phase 为 0 条，教练 3–13 天后才手动发现。
- **根因**：`get-instance`/`get-with-executions`/`list-history` 读取时用 `persistCompletedPlanInstanceIfNeeded` 把计划写成 completed，但不触发 `onPlanProgressChanged`；唯一触发入口 `complete-instance` 只在前端看到“全部完成且仍是 active”时调用，而读接口返回的已是 completed，条件永远不成立。
- **统一规则**：
  - 业务状态迁移必须是带前置状态条件的写（`update ... where status='active'`），只有真正完成迁移的那次请求负责发事件；
  - 慢事件（消息、AI 生成）放到响应之后执行（`after()`），不能让学员等待；
  - 不要依赖“前端看到旧状态再回调”来触发服务端事件。
  - 能触发事件的写接口要校验前置条件本身：订阅学员只能在所有训练日（从有效起始日起）都完成或跳过后把教练计划标记完成，否则会提前触发下一阶段自动化；教练可提前结束。
- **改动前自检**：读接口里是否有写？写了是否触发对应事件？事件是否幂等（job idempotency key）？客户端能否跳过前置条件直接调用触发接口？
- **典型案例**（2026-10-13）：已改为条件迁移 + `schedulePlanCompletionAutomation`；默认策略只提醒教练（目前两端都没有查看/发布计划草稿的入口），提醒发出即把 job 记为 succeeded；`complete-instance` 增加学员完成度校验。

## 31) Supabase 单次查询最多 1000 行：批量任务静默截断（高风险）

- **现象**：订阅过期任务只读到 1000/1325 条完成记录，预计完成日、到期、自动取消基于不完整数据；教练学员列表余额随数据增长会偏高。
- **根因**：PostgREST `max-rows=1000`，超出部分直接丢弃且不报错；批量 `.in(...)` 查询没有分页。
- **统一规则**：跨订阅/全站的批量读取一律用 `src/lib/supabaseKeysetPages.ts`（`gt("id")` + `order("id")` 分页，`in` 每块 100 个 id）；任何读取失败都在写库前中止。
- **改动前自检**：新增批量查询的结果是否可能超过 1000 行？是否分页？失败时是否还会继续写？
- **典型案例**（2026-10-13）：`check-expired-subscriptions`、`check-subscription` 过期分支、`getSubscriptionCarryoverSummariesBatch`、`list-students` 已改为分页。

## 32) 全站维护任务由访客浏览器触发（中高风险）

- **现象**：任何登录用户打开网页就每 10 分钟触发一次全站订阅过期任务（刷新预计完成日、写到期、自动取消）。
- **根因**：没有服务端调度，借用 `NavigationStudent` 的 `useEffect` 定时调用。
- **统一规则**：
  - 全站维护任务放在 `src/instrumentation-node.ts` 进程内调度，或使用带密钥的 cron 路由；页面不得触发。
  - 会写正式数据的调度必须显式开启：订阅过期任务只有设置 `SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS`（部署环境如 3600000）才运行，因为本地 `npm run dev` 和本地 `npm run start` 都直连正式库；同一进程内单飞，避免叠加运行。
  - 先读后写的批量取消必须逐条条件更新（`status='active'` 且 `subscribed_weeks` 未变），只对真正取消成功的订阅清空 `invitation_coach_id`，否则会和并发续费互相覆盖。
- **改动前自检**：前端是否在调用会写多用户数据的接口？本地 `npm run dev` / 本地生产构建是否会定时写正式库？读到写之间数据被续费改动时会怎样？
- **典型案例**（2026-10-13）：`NavigationStudent` 定时触发已删除；过期任务改为进程内显式开启 + 单飞 + 逐条条件取消。

## 33) 计划接口权限边界：学员能改写/归档教练计划并指定不计费（高风险）

- **现象**：`update-instance` 允许学员改自己教练计划的状态、起始日、训练日；`archive-instance` 允许学员传 `entitlementPolicy=no_charge`；`activate-instance` 允许学员重新激活旧计划。
- **根因**：权限写成“教练或该计划的学员”，没有区分教练计划与学员自建计划。
- **统一规则**：教练计划只允许所属教练修改/归档/激活；学员只管理自己创建的计划（`source='self'` 且无订阅）；计费相关参数（归档原因、计费策略）只接受教练传入（`src/lib/planInstanceAccess.ts`）。
- **改动前自检**：新接口里“学员本人”的判断是否把订阅学员也算进来？客户端传来的计费/归属字段是否被直接信任？

## 34) start_execution_day 一词多义：接续天数重复扣费（高风险）

- **现象**：教练多次“更新计划”后，同一批训练被旧版本算一次、新版本“接续”再算一次甚至三次，学员显示额度用完。2026-10-13 生产有 6 个订阅共多扣 16.3 服务周。
- **根因**：`start_execution_day` 既表示线下已练，也表示新版本接着旧版本；扣费把它之前的训练日都算已用，跨版本汇总又把旧版本的真实完成再加一遍。2026-08-20 前旧版本被单当前计划触发器归档为 `replaced_counted/count_service`。原地修订还会把起点推到“第一个未完成训练日”，让跳过的天也被扣费。
- **统一规则**：原地修订不再移动起点；接续只能有一份计费来源；自动取消前用 `findDoubleChargedCarriedDays` 排除含重复扣费的订阅并转人工核对；历史余额修正必须逐条确认后再改库。
- **改动前自检**：新建/修订计划时是否改了 `start_execution_day`？旧版本归档后的计费策略是否与新版本的接续天数重叠？


## 35) 前端引用服务端数据库客户端：anon key 进公开 JS，且核心表无 RLS（高风险）

- **现象**：用 anon key 可直接读出全部用户的手机号、密码哈希、邮箱、微信 openid，以及订阅、计划、训练、聊天记录。
- **根因**：两个 `use client` 页面 import 了 `@/lib/supabaseClient`，生产构建又传入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，key 被内联进浏览器 JS；核心表从未开启 RLS，Supabase 默认给 anon 全表权限。
- **统一规则**：前端只调用 Next.js API，不直连 Supabase；服务端默认客户端用 service key；public 表对 anon/authenticated 无直接权限，新表同样适用（默认权限已收回）。
- **改动前自检**：新页面是否在 `use client` 文件里 import 了 supabaseClient？构建参数是否引入了 NEXT_PUBLIC_ 的数据库密钥？新建表是否需要客户端直连（答案应为否）？
- **典型案例**（2026-10-18）：知识库节点编辑页、/test 页；已移除并收紧服务端客户端与表权限。

## 36) 按成员查聊天会话用 maybeSingle：存在已归档旧会话时报错，系统消息静默发不出

- **现象**：「教链小助手」给某些用户发的系统消息（审核结果、新订单、平台待办）没有出现在消息列表里，接口也不报错。
- **根因**：`getSystemChatroom` 只按 `contains('members', [a, b])` 查找，再 `.maybeSingle()`。同一对用户留有已归档的旧会话（或成员数组包含更多人）时返回多行，`maybeSingle` 报错，调用方只记日志后返回 false。`getOrCreatePrivateChatroom` 也是同样写法。
- **统一规则**：按成员找私聊必须同时加 `.eq('is_archived', false)`、`.contains(members)` + `.containedBy(members)`，再 `.order('created_at').limit(1).maybeSingle()`；与 `/api/chat/create-chatroom` 保持一致。
- **改动前自检**：查询会话时是否可能命中已归档行或多人会话？`maybeSingle` 前是否有 `limit(1)`？发送失败时调用方是否只吞掉了错误？
- **典型案例**（2026-10-18）：创始人账号与小助手有 1 个已归档 + 1 个正常会话；已修复 `getSystemChatroom`，`getOrCreatePrivateChatroom` 待同样修复。

## 36) "当前计划"各处各选：同一订阅不同页面余额不同（高风险）

- **现象**：学员页面显示剩 23 周，过期任务按 36 周算到期；自动化提醒与页面差 0.67–1.75 周。
- **根因**：过期任务按 id 顺序取第一个未归档计划，订阅里同时有旧的已完成计划和进行中计划时会选到旧的；提醒用全版本汇总，日期过滤口径与页面不同。
- **统一规则**：余额只用 `deriveSubscriptionBalance` / `loadSubscriptionBalance`，当前计划只用 `pickCurrentPlanInstance`（进行中 > 已排期 > 已完成，取最新）。
- **改动前自检**：新代码是否自己写了 `.find(status !== 'archived')` 或自己拼 carryover + entitlement？

## 37) 到账回调先读后写：续费周数重复累加 / 再次订阅覆盖余额（高风险）

- **现象**：支付回调、主动查单、返回页同时到达时续费周数加两次；进行中订阅再次订阅会把剩余周数覆盖成本次购买量并清空开始日。
- **根因**：读出 `subscribed_weeks` 后无条件写回 `旧值 + 本次`，没有订单级幂等；订阅路径复用旧行直接覆盖。
- **统一规则**：周数写入必须带"读取时的周数"条件并记录已到账订单号（`applied_subscription_order_ids`），冲突时重读重试；进行中订阅再次订阅累加。
- **改动前自检**：任何"读出数值再加减写回"的地方，写入条件里有没有读取时的值？同一订单重复到达会不会再加一次？
