1. 分支体系说明

我们的项目采用多级分支管理模式，核心逻辑为：功能开发隔离、分环境测试、多重人工审核。

分支类型
分支名称
说明
保护级别
主分支
main
对应线上生产环境，保持随时可发布状态。
除特殊紧急情况严禁直推，需 2 个 Approve
灰度分支
gray
对应预发布/灰度环境，用于上线前的最后验证。
需从 dev 合并
开发分支
dev
基础开发汇总分支，对应测试环境。
严禁直推，需 1 个 Approve

功能分支
feat/*
从 main 拉取，用于开发具体新功能。
开发者自控
修复分支
fix/*

从 main 或 dev 拉取，用于修复 Bug。
开发者自控

紧急分支

hotfox/*
紧急修复分支，可直接向main合并
开发者自控

2. 工作流规范 (Workflow)

2.1 开发流程

1. 拉取分支：所有新功能必须从最新的 main 分支拉取。
- 命名格式：feat/功能简名 (例如：feat/login-module)
  
  
2. 提交代码：开发过程中在 feat 分支进行频繁提交。
【建议】合并提交 (Squash & Rebase)：
- 可选但推荐：在发起合并请求前，建议使用 git rebase -i 将该分支上的多个琐碎 commit 合并为一个整洁的 commit。
- 这样可以避免“fixed typo”、“save”等无意义的记录进入主分支，保持历史线性且清晰。

3. 合并至 dev：功能完成后，发起 Merge Request (MR) 到 dev。
- 要求：至少需要 1 位 同事进行 Code Review 并给予 Approve。
- 测试：在测试环境进行功能验证。
  
  
4. 合并至 gray：测试通过后，由负责人将 dev 合并至 gray 进行预发布验证。（目前未启用gray分支）

5. 合并至 main：灰度验证无误后，发起 MR 到 main。
- 要求：至少需要 2 位 核心成员进行审核并给予 Approve。
  

3. Commit Message 提交规范

我们遵循约定式提交（Conventional Commits），格式如下：
类型(影响范围): 一句话简单描述

常用类型 (Type)

- feat: 新功能 (feature)
- fix: 修补 bug
- refactor: 重构（既不是新增功能，也不是修改 bug 的代码变动）
- docs: 文档变更
- style: 格式修改（不影响代码运行的变动）
- chore: 构建过程或辅助工具的变动
  
示例

feat(auth): 增加微信登录功能
fix(order): 修复订单金额计算精度问题
refactor(user): 优化用户信息查询接口性能


---

4. 合并冲突处理建议

1. 频繁同步：开发期间建议定期将 main 分支合入你的 feat 分支，提前解决冲突。
2. 保持线性：推荐使用 git pull --rebase 来保持分支历史的整洁。
3. 禁止强推：严禁在 main、gray 和 dev 分支使用 git push -f。
