### 我们重构“AI 生成计划”的整体方案（针对动作型教练）

目标
- 以“规则引擎为主、AI增强为辅”的架构，为“只教某个动作/组合动作”的教练生成高质量周期训练。
- 每位教练有自己的“规则包”（rulepack）；AI只做个性化微调与说明补全，不主导结构。
- 前端表单不再“通用健身表单”，而是“教练-动作域”的动态表单。

一、信息架构与可扩展性
- 规则引擎（本地）
  - 每个教练一个或多个 rulepack：如
    - weighted_pullup_6w、weighted_dips_6w、pullup+dips_combo_6w
    - 以后可新增：front_lever、single_arm_pullup、脂增/脂减等
  - 规则包输出统一 JSON（周→日→主项/辅项、热身/收尾、递进规则），确定性、可离线、可落库。
- AI 增强器（可选）
  - 仅对规则输出做“个性化微调/文案润色/细节估算”，始终保证结构不变。
  - 若 AI 失败，直接使用规则输出，功能不受影响。
- 数据持久化（建议）
  - coach_rulepacks(id, coach_id, key, name, version, config_json)
  - training_plans(metadata jsonb) + exercises(extra jsonb)
  - 未来可增加 plan_sessions 结构化落地

二、前端交互重做（动态表单，基于教练域）
- 步骤 1：选择“服务/动作域”
  - 仅显示该教练提供的域：负重引体 / 负重臂屈伸 / 联合（pullup + dips）
- 步骤 2：动作能力评估（替换通用“目标/水平”）
  - 基线测试（每个动作不同）：
    - 负重引体：BW 最大连续次数、自报 3RM/1RM（可空）、是否会肩胛启动
    - 负重臂屈伸：BW 次数/负重能力、肘部历史伤病
  - 技术要点自我评估（Yes/No）：顶部/底部暂停是否能做、握距偏好
- 步骤 3：训练安排
  - 周频次（3/4）与每次时长（45/60/90）
  - 可训练日（Mon-Sun 勾选）
  - 器械与环境：单杠/双杠/弹力带/杠铃片/健身房/家庭
- 步骤 4：个性化偏好
  - 强度偏好：强度优先/容量优先/折中
  - 疲劳管理：休息上限/最短休息
  - 伤病与限制（自由文本）
  - 具体目标（例如“6 周内负重+10kg 5x5”）
- 步骤 5：生成与预览
  - 先生成“规则计划”（秒级）；若启用 AI，再叠加“增强说明”（文案、负重估算提示、配速/呼吸/注意事项）
  - 显示：周历/日卡片（主项/辅项/热身/收尾），递进规则与第 5/6 周变化

三、AI 增强点（严格边界）
- 不改动结构，仅补充/微调以下内容：
  - 负重估算提示：基于提供的 BW 次数 / 自报 3RM 给“起始 %1RM/绝对负重建议范围”
  - 技术要点：顶部/底部暂停如何做、动作节奏/呼吸、易犯错误纠正
  - 个性化建议：根据 injuries/specific_goals 调整“替代动作/缩短幅度/辅助练习”
  - 激励与教育：每周小目标、风险提示文案
- 调用方式
  - Prompt 输入：rulepack 输出 + 用户画像（动作域、能力评估、周频次、器械、限制）
  - 输出：只返回字段
    - notes_enhanced[]（日/动作级别）
    - load_hint[]（主项起始%1RM/重量区间建议）
    - weekly_focus[]（每周关注点简述）
- 失败策略：若 AI 返回异常或延迟超时，直接忽略增强，仅用规则计划

四、生成流程（稳定/可维护）
- Stage0 收集参数：来自动态表单（动作域/能力/安排/偏好/限制/目标）
- Stage1 规则引擎生成 skeleton 计划（6 周/3-4练）
- Stage2 可选 AI 增强（填充建议/文案/负重提示），结构不变
- Stage3 前端预览：可查看周/日/动作细节
- Stage4 落库：保存计划（metadata jsonb），exercises(extra jsonb)
- Stage5 执行与追踪：日卡片“完成/备注/主项实际负重/RPE”
- Stage6 复盘与再生：部分周重生（仅 Week3-4 微调），或目标变化重算

五、示例：负重引体（教练 A）表单字段映射
- domain: weighted_pullup | weighted_dips | combo
- bw_max_reps: number
- est_1rm / est_3rm: number?
- can_pause_top / can_pause_bottom: boolean
- weekly_freq: 3 | 4
- session_minutes: 45 | 60 | 90
- days_available: string[]
- equipment: ['pullup_bar','plates','bands','dips_bar',...]
- intensity_bias: 'intensity' | 'volume' | 'balanced'
- rest_policy: 'short'|'medium'|'long'
- injuries: string
- specific_goal: string

六、UI/UX 重点
- 动态表单：从教练服务入口跳入时按“动作域”加载不同问题集（schema per rulepack）
- 预览页：周视图（Week 1..6），点击展开“日卡片”，显示：
  - 主项：组数/次数/%1RM/休息/暂停/节奏/备注（带 AI 提示）
  - 辅项：组次/范围与替代动作
  - 热身/收尾：固定模板 + AI 个性化注意事项
- 执行页：今日训练卡，支持输入“主项实际负重/RPE/完成情况”，写入进度

七、版本化与多教练支持
- rulepack 版本号（version），计划记录保存使用的 rulepack_id + version，便于回溯
- coachId→rulepack key 映射（数据库/配置文件）
- 新教练接入：新增 rulepack + 配置表单 schema，即可上线

八、成本与稳定性
- 规则引擎实时生成（无外部依赖，0 成本）
- AI 增强异步/可选，失败自动忽略；仅在后端调用，Key 安全

九、落地节奏（建议）
- v1 本周：重做动态表单（动作域化）+ 规则引擎计划生成 + 周/日渲染 + 落库
- v2：打卡与统计（训练天数/完成次数/主项负重轨迹）
- v3：AI 增强开关（Edge Function 优化 + JSON 校验 + 说明润色）
- v4：多教练 rulepack 接入（你给规则，我补 rulepack）

如果确认这个方案，我就：
- 改造“AI训练计划”表单为“动作域化表单”（针对负重引体/负重臂屈伸/组合）。
- 挂接已实现的本地规则引擎作为生成基线（你现在就能稳定用）。
- 先让“周/日渲染 + 落库 + 执行页”走通，再补 AI 增强与其它教练 rulepack。