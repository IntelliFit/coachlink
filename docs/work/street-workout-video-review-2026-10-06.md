# 街健动作示范纠错与视频审核（2026-10-06）

> **2026-10-07 用户纠正：本文的视频最终导入与视频准入规则是代理误解，已作废。** 用户要求视频仅用于理解/核验动作，最终导入准确图片。平板支撑误导入的 MP4 已从公共动作及一个个人副本的 URL 撤回，更换成核对过的 640×640 示范照片帧。审核依据改为公共 ID、标准动作 ID、精确图片 URL；视频可选。余312项等待图片审核。当前记录见 `docs/work/street-workout-image-review-2026-10-07.md`，下面只保留10-06操作历史，不作为继续导入视频的指令。

## 查到的来源与现状

- 2026-08-31 的批量导入脚本 `scripts/import-street-workout-actions.ts` 把《街头健身动作汇总》中的动作和参考图写入标准/公共动作库，`community_actions.url` 留空。名称和图片导入不等于已有人逐项检查示范动作。
- 2026-10-06 正式 API 回读：按小程序的街健识别规则共 313 条；313 条视频 URL 均为空。307 条标准动作的分类为 `街头健身%`，另 6 条通过属性、详情或名称归入街健。不能说这些动作从未上传；真正缺的是可核验的视频。
- 用户反馈部分 AI 图严重不符。图像未经过逐条核验，因此先全部撤下，不继续作为示范显示。最初的 307 条和另外 6 条均已执行可逆的 `reference_image_url = null`；正式 API 再次回读 313 条带图数为 0，视频数仍为 0。动作行、计划和训练记录未删除。

## 可逆操作和审核队列

- 原始 307 条图片地址：`artifacts/street-workout-video-review/2026-10-06/canonical-images-before.json`，SHA256 `7daa6f1afed60c0228d70d53edd08a1ad03c6ab4e562a1eae7ed6917a79af6d9`。
- 另外 6 条共用标准动作的原图地址：`artifacts/street-workout-video-review/2026-10-06/shared-canonical-images-before.json`，SHA256 `6024dc6f42bc65273e75adf096b38d87eda2750a3fae54775f152865e9e617a6`。它们的标准动作还可能被力量分类使用，因此回滚/恢复前必须确认图片确实合格。两份操作日志同目录，脚本为 `scripts/quarantine-street-workout-reference-images.mjs`，默认 dry run，`--shared` 限定后 6 条；`--restore` 只在图片仍为空时恢复，不覆盖之后核验的新素材。
- 313 条逐项清单：`artifacts/street-workout-video-review/2026-10-06/review-queue.csv` 和机读 `review-queue.json`。平板支撑已核验导入，余下 312 条仍为 `pending_exact_video_review`；未填写候选链接、授权、审核人或日期时不能标为通过。
- 公共动作原行及原类型：`artifacts/street-workout-video-review/2026-10-06/public-action-types-before.json`，SHA256 `1f7eded13dab85df0c140c0aa921d60f3e3d587b254ec83a29a90981e558fbaf`；`scripts/quarantine-street-workout-public-actions.mjs` 曾把 313 条无视频的公共动作从 `STRENGTH` 临时改为 `STREET_REVIEW_PENDING`，保留 UUID、贡献关系、点赞、编辑及个人动作副本。正式小程序公共列表只请求 `STRENGTH`/`CARDIO`，因而无需新包便不再列出待核验条目。恢复脚本一次只接受一个已配置精确视频 URL 的动作 ID，不能批量解除隔离。

## 已导入的第 1 条：平板支撑

- 公共动作 ID `8b83f52f-1d03-406b-8e64-e921f813be18`，原定义为“核心稳定基础动作”。对应 [DVIDS 美国空军前臂平板支撑教学视频](https://www.dvidshub.net/video/825280/forearm-plank)，来源页标注公有领域，演示者以双前臂和脚尖支撑、身体保持平直；已抽取贯穿 3 分钟视频的画面逐段检查，证据 `forearm-plank-contact-sheet.jpg`。不把它用于“直臂俯卧支撑”等其他变式。
- 原 MP4 SHA256 `fd9faaca3b52db86f15a4e0de0456eca693239a5173a54a33f916dcf464ac5f7`；压缩为 854×480 H.264/AAC、6,127,883 字节，SHA256 `a50f25bd5bd3a8845521d97a5a21524d942d0d0bd4bf97a30a576e66f0a9c625`。`scripts/import-reviewed-forearm-plank-video.mts` 对来源动作、文件 hash、库主机与无视频待审核状态做前置检查，上传到项目视频 COS/CDN、HEAD 验证 MP4 后条件更新公共动作 `url` 和 `type=STRENGTH`；完整日志 `forearm-plank-video-import.json`。
- 正式接口回读该 ID 已有 [可访问的 MP4](https://cdn-videos.coachlink.fit/street-workout-reviewed/8b83f52f-1d03-406b-8e64-e921f813be18/forearm-plank-dvids-825280-a50f25bd.mp4)，旧 AI 图仍为空。小程序实际点击/真机播放尚未通过 DevTools 验收，不能把 CDN HEAD 当成终端播放成功。

## 待发布的隐藏规则

- `src/lib/streetWorkoutVideoReview.ts` 的审核清单已记录平板支撑的精确 ID/视频 URL/来源/许可。公共列表先过滤再分页计数；详情、加入个人库、点赞及问卷自动导入均阻止其余未核验街健动作。这样保留历史动作行与计划引用，同时避免新用户继续选用错图/无视频条目。
- 小程序街健公共库全部待审时显示“街健动作正在核验”；当前已恢复 1 条，因此默认显示该动作；有氧 20 条不进入街健审核规则。
- 正式 API 尚未部署上述代码。线上小程序按 `STRENGTH` 查询已看不到待核验街健动作，但不带 type 的旧接口调用或凭已知 ID 调详情仍可取得原动作行（已无图）；这需要后端代码上线才能完全关闭公共入口。小程序改动也仅在本地，未上传体验版或正式版。发布要处理共享工作区的其他未提交修改，不能把它们意外带上线。

## 视频准入

1. 逐条比对名称、器械、握法、身体姿态、起止位和动作幅度。变式不能用相似基础动作替代；搜索结果标题不构成审核。
2. 实际观看完整真人演示，记录来源页面、作者、授权/许可、审核人和日期。素材须可在小程序直接播放，外部网页链接只能复制，不能冒充已导入视频。
3. 有权限使用时再保存可播放媒体 URL 到对应 `community_actions.url`，把精确的公共动作 ID 与同一 URL 加入审核清单；接口只有两者完全一致才恢复显示。旧 AI 图不能因为找到视频而自动恢复。
4. 找不到准确视频或授权不明确时保持隐藏；不删除已有计划或训练历史引用。若名称/定义本身也错误，另行修订名称与要点并复核。

## 在线候选调查（均未准入）

- [Wikimedia Commons 引体向上示范](https://commons.wikimedia.org/wiki/File:Pull-ups_-_exercise_demonstration_video.webm)：页面标注 CC BY 3.0；不能用普通引体视频代替数据库中各类握法、暂停、高度和负重变式，且原文件 WebM 的小程序播放兼容性未验。
- [CDC 俯卧撑视频](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Push-ups.webm)：页面提供 CDC 原 MP4 链接；数据库中“跪姿”“快速”“击掌”等都不是标准俯卧撑，不据此匹配。
- [ACE 跪姿俯卧撑说明](https://www.acefitness.org/resources/everyone/blog/5241/4-upper-body-movements-for-beginners/)：可用于动作定义对照，当前页面资料不足以作为可导入的真人视频。

## 验证

- 生产接口在撤图前：313 街健动作、313 有图、0 有视频；撤图后：313 街健动作、0 有图、0 有视频；线上类型隔离后：`STRENGTH` 101、`CARDIO` 20、`STREET_REVIEW_PENDING` 313。平板支撑导入后：`STRENGTH` 102、`CARDIO` 20、待核验 312；待核验者带图/视频均 0，恢复的一条有 MP4、无图。
- 本地规则在原有 454 条全部类别中标记 313 条待隐藏，剩余 141 条（其中有氧 20 条）保留。
- 本地 lint 脚本不运行 ESLint；typecheck、78 文件 520 项测试、Next 构建 547 页通过。独立启动的本地接口回读：力量 101 条、街健 0 条；有氧 20 条；搜索“俯卧撑”剩 7 条。临时服务已停止并释放端口。小程序独立构建 2894 模块通过，补丁脚本通过；9420 无连接，9422 项目路径/AppID/构建版本/占用者无法确认，未导航或新开窗口，UI 未验收。
