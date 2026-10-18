# Standard Action Sequence Image Production Plan

> 2026-10-07 user correction: the existing anatomy style stays consistent, but pose count follows the exercise. Static/isometric holds default to ONE informative posture. Dynamic exercises use extra key positions only when they explain real movement. Do not repeat identical poses or force three frames. The older fixed-three-frame pilot instructions below are historical.

Generated at: 2026-06-20T19:12:09.140Z

## Source Of Truth

- Standard dictionary: Supabase `canonical_actions` (383 rows).
- Public action metadata: Supabase `community_actions` (144 rows).
- Current persona sheet: `design/image-workspace/outputs/anatomy-model-persona-sheet-v4.png`.
- Character rule: base model is barefoot, faceless, translucent white/gray, no colored markings unless showing action-specific muscle activation.

## Pilot Scope

- Generate 50 exercise sequence images first.
- Static/isometric actions use one clear posture. Dynamic actions use only the distinct key positions needed to explain the exercise; a midpoint is optional and must add information.
- Each frame uses the same CoachLink anatomy model and marks trained muscles directly on the figure: red for primary muscles, orange for secondary/assisting muscles.
- Full rollout target remains all `canonical_actions` standard actions; non-visual habit/diet/cardio rows need a separate treatment decision before image generation.

## 10 Sub-Agent Plan

### batch-01 / Agent 1
- Scope: pilot actions 1-5.
- Spec output: `design/image-workspace/action-library/batches/batch-01-frame-spec.md`.
- 01. 负重臂屈伸 -> `design/image-workspace/action-library/outputs/001-负重臂屈伸-sequence.png` muscles: 全身
- 02. 负重引体（底部暂停） -> `design/image-workspace/action-library/outputs/002-负重引体-底部暂停-sequence.png` muscles: 手臂、背部
- 03. 弹力带肩部热身 -> `design/image-workspace/action-library/outputs/003-弹力带肩部热身-sequence.png` muscles: 肩部
- 04. 手腕热身 -> `design/image-workspace/action-library/outputs/004-手腕热身-sequence.png` muscles: 其他
- 05. 臂屈伸 -> `design/image-workspace/action-library/outputs/005-臂屈伸-sequence.png` muscles: 胸部、手臂

### batch-02 / Agent 2
- Scope: pilot actions 6-10.
- Spec output: `design/image-workspace/action-library/batches/batch-02-frame-spec.md`.
- 06. 俄挺 -> `design/image-workspace/action-library/outputs/006-俄挺-sequence.png` muscles: 肩部、手臂、其他
- 07. 负重臂屈伸-弹力带辅助 -> `design/image-workspace/action-library/outputs/007-负重臂屈伸-弹力带辅助-sequence.png` muscles: 胸部、肩部
- 08. 前水平 -> `design/image-workspace/action-library/outputs/008-前水平-sequence.png` muscles: 肩部、手臂、背部
- 09. 手肘松解 -> `design/image-workspace/action-library/outputs/009-手肘松解-sequence.png` muscles: 手臂
- 10. 提膝双力臂 -> `design/image-workspace/action-library/outputs/010-提膝双力臂-sequence.png` muscles: 背部、手臂

### batch-03 / Agent 3
- Scope: pilot actions 11-15.
- Spec output: `design/image-workspace/action-library/batches/batch-03-frame-spec.md`.
- 11. 团身引体 -> `design/image-workspace/action-library/outputs/011-团身引体-sequence.png` muscles: 背部
- 12. 引体向上 -> `design/image-workspace/action-library/outputs/012-引体向上-sequence.png` muscles: 背部、手臂
- 13. 直体双力臂 -> `design/image-workspace/action-library/outputs/013-直体双力臂-sequence.png` muscles: 背部、手臂
- 14. 直腿双力臂 -> `design/image-workspace/action-library/outputs/014-直腿双力臂-sequence.png` muscles: 背部、手臂
- 15. 吊环澳式引体 -> `design/image-workspace/action-library/outputs/015-吊环澳式引体-sequence.png` muscles: 背部、肩部、手臂

### batch-04 / Agent 4
- Scope: pilot actions 16-20.
- Spec output: `design/image-workspace/action-library/batches/batch-04-frame-spec.md`.
- 16. 吊环单手俯卧撑 -> `design/image-workspace/action-library/outputs/016-吊环单手俯卧撑-sequence.png` muscles: 胸部、肩部、手臂
- 17. 吊环俯卧撑可加负重 -> `design/image-workspace/action-library/outputs/017-吊环俯卧撑可加负重-sequence.png` muscles: 胸部、肩部、手臂
- 18. 吊环靠墙倒立俯卧撑 -> `design/image-workspace/action-library/outputs/018-吊环靠墙倒立俯卧撑-sequence.png` muscles: 肩部、手臂、核心
- 19. 吊环屈臂撑 -> `design/image-workspace/action-library/outputs/019-吊环屈臂撑-sequence.png` muscles: 胸部
- 20. 吊环团身俯卧撑 -> `design/image-workspace/action-library/outputs/020-吊环团身俯卧撑-sequence.png` muscles: 胸部、肩部、手臂、核心

### batch-05 / Agent 5
- Scope: pilot actions 21-25.
- Spec output: `design/image-workspace/action-library/batches/batch-05-frame-spec.md`.
- 21. 吊环团身引体 -> `design/image-workspace/action-library/outputs/021-吊环团身引体-sequence.png` muscles: 胸部、手臂、核心、肩部
- 22. 吊环引体 -> `design/image-workspace/action-library/outputs/022-吊环引体-sequence.png` muscles: 手臂、肩部、背部、核心
- 23. 阿诺德推举 -> `design/image-workspace/action-library/outputs/023-阿诺德推举-sequence.png` muscles: 三角肌前束、三角肌中束、肱三头肌
- 24. 保加利亚分腿蹲 -> `design/image-workspace/action-library/outputs/024-保加利亚分腿蹲-sequence.png` muscles: 股四头肌、臀大肌
- 25. 爆发式俯卧撑 -> `design/image-workspace/action-library/outputs/025-爆发式俯卧撑-sequence.png` muscles: 胸大肌、三头肌、核心

### batch-06 / Agent 6
- Scope: pilot actions 26-30.
- Spec output: `design/image-workspace/action-library/batches/batch-06-frame-spec.md`.
- 26. 传统硬拉 -> `design/image-workspace/action-library/outputs/026-传统硬拉-sequence.png` muscles: 臀大肌、腘绳肌、背部
- 27. 锤式弯举 -> `design/image-workspace/action-library/outputs/027-锤式弯举-sequence.png` muscles: 肱桡肌、肱肌、肱二头肌
- 28. 单臂哑铃划船 -> `design/image-workspace/action-library/outputs/028-单臂哑铃划船-sequence.png` muscles: 背阔肌、菱形肌、肱二头肌
- 29. 单腿深蹲 -> `design/image-workspace/action-library/outputs/029-单腿深蹲-sequence.png` muscles: 股四头肌、臀大肌、核心
- 30. 弹力带坐姿划船 -> `design/image-workspace/action-library/outputs/030-弹力带坐姿划船-sequence.png` muscles: 背阔肌、中下斜方肌

### batch-07 / Agent 7
- Scope: pilot actions 31-35.
- Spec output: `design/image-workspace/action-library/batches/batch-07-frame-spec.md`.
- 31. 地板卧推 -> `design/image-workspace/action-library/outputs/031-地板卧推-sequence.png` muscles: 胸大肌、肱三头肌
- 32. 登山跑慢速版 -> `design/image-workspace/action-library/outputs/032-登山跑慢速版-sequence.png` muscles: 核心、肩部、下肢
- 33. 低杠深蹲 -> `design/image-workspace/action-library/outputs/033-低杠深蹲-sequence.png` muscles: 股四头肌、臀大肌、竖脊肌
- 34. 俄挺进阶 -> `design/image-workspace/action-library/outputs/034-俄挺进阶-sequence.png` muscles: 三角肌、胸肌、核心
- 35. 俯身靠墙划船 -> `design/image-workspace/action-library/outputs/035-俯身靠墙划船-sequence.png` muscles: 背阔肌、菱形肌、肱二头

### batch-08 / Agent 8
- Scope: pilot actions 36-40.
- Spec output: `design/image-workspace/action-library/batches/batch-08-frame-spec.md`.
- 36. 俯身哑铃后束飞鸟 -> `design/image-workspace/action-library/outputs/036-俯身哑铃后束飞鸟-sequence.png` muscles: 三角肌后束、菱形肌
- 37. 俯卧腿弯举 -> `design/image-workspace/action-library/outputs/037-俯卧腿弯举-sequence.png` muscles: 腘绳肌
- 38. 负重双杠臂屈伸 -> `design/image-workspace/action-library/outputs/038-负重双杠臂屈伸-sequence.png` muscles: 胸大肌、三头肌、肩部
- 39. 负重引体向上 -> `design/image-workspace/action-library/outputs/039-负重引体向上-sequence.png` muscles: 背阔肌、肱二头、核心
- 40. 杠铃划船 -> `design/image-workspace/action-library/outputs/040-杠铃划船-sequence.png` muscles: 背阔肌、菱形肌、后束

### batch-09 / Agent 9
- Scope: pilot actions 41-45.
- Spec output: `design/image-workspace/action-library/batches/batch-09-frame-spec.md`.
- 41. 杠铃深蹲 -> `design/image-workspace/action-library/outputs/041-杠铃深蹲-sequence.png` muscles: 股四头肌、臀大肌、核心
- 42. 杠铃臀推 -> `design/image-workspace/action-library/outputs/042-杠铃臀推-sequence.png` muscles: 臀大肌、腘绳肌
- 43. 杠铃弯举 -> `design/image-workspace/action-library/outputs/043-杠铃弯举-sequence.png` muscles: 肱二头肌、肱肌
- 44. 高翻 -> `design/image-workspace/action-library/outputs/044-高翻-sequence.png` muscles: 臀大肌、股四头肌、斜方肌
- 45. 高杠深蹲 -> `design/image-workspace/action-library/outputs/045-高杠深蹲-sequence.png` muscles: 股四头肌、臀大肌、核心

### batch-10 / Agent 10
- Scope: pilot actions 46-50.
- Spec output: `design/image-workspace/action-library/batches/batch-10-frame-spec.md`.
- 46. 高脚杯深蹲 -> `design/image-workspace/action-library/outputs/046-高脚杯深蹲-sequence.png` muscles: 股四头肌、臀大肌、核心
- 47. 高位下拉 -> `design/image-workspace/action-library/outputs/047-高位下拉-sequence.png` muscles: 背阔肌、肱二头
- 48. 跪姿俯卧撑 -> `design/image-workspace/action-library/outputs/048-跪姿俯卧撑-sequence.png` muscles: 胸大肌、三头肌、前三角
- 49. 击掌俯卧撑 -> `design/image-workspace/action-library/outputs/049-击掌俯卧撑-sequence.png` muscles: 胸大肌、三头肌、肩部
- 50. 架上拉 -> `design/image-workspace/action-library/outputs/050-架上拉-sequence.png` muscles: 竖脊肌、斜方肌、臀大肌

## Global Prompt Contract

Use the CoachLink v4 anatomy model: barefoot adult male, natural faceless mannequin head, translucent white/gray body and skeleton. The illustration may add red/orange muscle highlights for the current action only. Use no text, labels, watermarks, logos, or UI chrome inside generated images. Static holds use one informative posture without duplicates. When multiple positions are useful for a dynamic action, keep the camera angle consistent and show actual distinct positions.

## Output Naming

- Sequence images: `design/image-workspace/action-library/outputs/NNN-action-name-sequence.png`.
- Batch frame specs: `design/image-workspace/action-library/batches/batch-XX-frame-spec.md`.
- Prompt manifests may be added next to outputs as `NNN-action-name-prompt.md` if needed.
