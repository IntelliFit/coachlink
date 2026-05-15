# CoachLink Ability Tree Prototype

独立移动端产品原型，不接入主站路由，不使用主项目 `src/app`，运行端口固定为 `4317`。

```powershell
cd D:\projects\coachlink\prototypes\ability-tree-app
npm run dev
```

打开：

```text
http://127.0.0.1:4317
```

当前版本按 `docs/PRD/CoachLink_能力树小程序原型需求文档.md` v0.3 实现：

- 手机小程序壳，无右侧解释面板。
- 底部 Tab：今日、能力、教练、我的。
- P0 流程：起点诊断、今日任务、能力树、节点详情、训练执行、教练升级、我的。
- 全部使用前端 mock 数据，不改真实小程序和主站逻辑。
