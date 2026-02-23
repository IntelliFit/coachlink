# 分支策略：dev 为主，feat/newbie-quick-iteration 合并

## 一、当前事实澄清

### 1. 「AI 修改器上下文设置」到底在哪个分支？

| 文件/目录 | dev 提交里 | feat 提交里 | 当前工作区 |
|-----------|------------|-------------|------------|
| `batch-operation/context.ts` | ❌ 无 | ❌ 无 | ✅ 有（**未跟踪 ??**） |
| `batch-operation-context-preview/` | ❌ 无 | ❌ 无 | ✅ 有（**未跟踪 ??**） |
| `docs/work/AI修改器-上下文配置与测试.md` | ❌ 无 | ❌ 无 | ✅ 有（**未跟踪 ??**） |
| `BatchOperationDialog.tsx` 里的上下文 UI | 有（与 feat 不同） | 有（与 dev 不同） | 有（你改过的版本） |

**结论**：上下文设置的「新文件」（context.ts、context-preview API、文档）**从未被 commit 到任何分支**，只存在于你本地工作区。  
你记得在 feat 上写的，多半是：在 feat 分支上编辑了这些文件但**没 commit**，后来切到 dev，未提交的改动跟着工作区到了 dev，所以看起来「dev 也有」。  
两个分支的**已提交历史**里，都只有对 `BatchOperationDialog.tsx`、`batch-operation/route.ts`、`entity.ts` 等的不同修改，没有这些新文件。

---

## 二、策略原则（你要的「更好的策略」）

- **dev = 主分支**：所有功能最终都合到 dev，长期以 dev 为准。
- **feat/newbie-quick-iteration = 功能分支**：只负责「新手快速迭代 / 反馈闭环」等能力，开发完成后合并进 dev，然后可归档或删除。

推荐做法：**在 dev 上整理好当前工作区（含上下文设置），再把 feat 独有提交合并进 dev，冲突以 dev 为主并保留 feat 中有价值的新增。**

---

## 三、推荐操作步骤（按顺序做）

### Step 1：在 dev 上把「当前工作区」做成清晰提交（含上下文设置）

你现在在 **dev**，且有一堆未提交的修改 + 未跟踪文件。先别切分支，在 dev 上一次性整理好：

1. **把该留的改动都加进暂存区**（包括上下文相关的新文件）  
   - 若不想把 temp_dir、无关文档加进去，可只 add 需要的路径，例如：
   ```bash
   git add src/app/api/plan-lib/batch-operation/context.ts
   git add src/app/api/plan-lib/batch-operation-context-preview/
   git add src/app/api/plan-lib/apply-batch-operation/route.ts
   git add src/app/api/plan-lib/batch-operation/entity.ts
   git add src/app/api/plan-lib/batch-operation/route.ts
   git add src/components/BatchOperationDialog.tsx
   git add src/app/dashboard/plan-lib/create/page.tsx
   git add src/app/dashboard/plan-lib/edit/[id]/page.tsx
   git add src/app/dashboard/students/plan/[id]/page.tsx
   git add src/app/me/plan-lib/create/page.tsx
   git add src/app/service/batchOperationService.ts
   git add src/app/service/coachService.ts
   git add docs/work/AI修改器-上下文配置与测试.md
   # 若还有反馈闭环相关（StudentFeedbackPanel、get-student-feedbacks 等）也要进 dev，一并 add
   ```

2. **提交**（建议拆成 2 个 commit 更清晰）：  
   - 第一个：AI 修改器上下文配置与预览 API  
     ```bash
     git commit -m "feat(plan-lib): AI 修改器上下文配置与 context-preview API"
     ```  
   - 其余：批量操作 / 计划页 / 服务层等  
     ```bash
     git add -A
     git status   # 确认没有误加 temp_dir 等
     git commit -m "feat(plan-lib): 批量操作与计划页联动、上下文 UI 等"
     ```

这样「AI 修改器上下文设置」就**明确落在 dev**，以后不会混淆。

### Step 2：把 feat 独有提交合并进 dev

```bash
git checkout dev
git merge feat/newbie-quick-iteration -m "merge: feat/newbie-quick-iteration 学员反馈闭环等并入 dev"
```

- 若有冲突：**以 dev 为准**，只把 feat 里「你确定要保留」的新逻辑（如反馈闭环）手工合进来。
- 冲突高发文件：`BatchOperationDialog.tsx`、`batch-operation/route.ts`、学员 plan 页、反馈相关 API。

### Step 3：合并后检查

- 跑一遍：计划库创建/编辑、学员计划页、批量操作弹窗、上下文开关、反馈闭环。
- 确认无问题后：  
  ```bash
  git push origin dev
  ```

### Step 4：feat 分支后续

- 若 feat 已完全合并进 dev，可删除本地与远程：  
  ```bash
  git branch -d feat/newbie-quick-iteration
  git push origin --delete feat/newbie-quick-iteration

  ```
- 若还想保留名字做「已合并」记录，可以不删，但以后新功能建议从 dev 拉新分支，例如：  
  ```bash
  git checkout dev
  git pull
  git checkout -b feat/xxx
  ```

---

## 四、之后避免再搞混

1. **新功能**：一律从 **dev** 拉新分支（`git checkout -b feat/yyy`），做完再合并回 dev。
2. **上下文 / 批量操作类改动**：在 dev（或从 dev 拉出的分支）上改，改完就 commit，不要在两个分支上交替改同一块。
3. **临时实验**：用 `git stash` 或单独分支，避免在 dev 和 feat 上同时改同一批文件。

---

## 五、小结

| 问题 | 结论 |
|------|------|
| 上下文设置在哪个分支？ | **两个分支的提交里都没有**；只在当前工作区（未提交）。你记得在 feat 写的，是没 commit 就切分支了。 |
| 更好的策略？ | **dev 为主**；在 dev 上先提交当前工作区（含上下文），再 merge feat，冲突以 dev 为主。 |
| feat 之后怎么办？ | 合并进 dev 后可以删掉或保留为「已合并」；新功能从 dev 拉新分支。 |

若你愿意，我可以按你当前 `git status` 逐项列一份「建议 add / 建议不 add」的清单，方便你 Step 1 时少出错。
