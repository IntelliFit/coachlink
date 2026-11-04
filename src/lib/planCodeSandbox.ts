import ivm from "isolated-vm";
import { buildVmActionCatalog, type PlanAssistantActionLite } from "@/lib/planAssistantEdits";

/**
 * 在隔离的虚拟机中执行 AI 生成的计划修改代码。
 *
 * actions 必须带 type：提示词要求模型写 `findActionById(id)?.type || 'STRENGTH'`，
 * 目录里没有 type 时，把力量动作换成跑步也会被存成 STRENGTH。
 */
export async function executeCodeInVM(
    code: string,
    trainingDays: any[],
    actions: PlanAssistantActionLite[],
    timeout = 10000,
    memoryLimit = 128,
): Promise<{ success: boolean; result?: any; error?: string }> {
    let isolate: ivm.Isolate | null = null;
    try {
        isolate = new ivm.Isolate({ memoryLimit });
        const context = await isolate.createContext();
        const jail = context.global;
        await jail.set("global", jail.derefInto());
        await jail.set(
            "trainingDaysJSON",
            new ivm.ExternalCopy(JSON.stringify(trainingDays)).copyInto(),
        );
        await jail.set(
            "actionsJSON",
            new ivm.ExternalCopy(JSON.stringify(buildVmActionCatalog(actions))).copyInto(),
        );

        const scriptCode = `
            const trainingDays = JSON.parse(trainingDaysJSON);
            const actions = JSON.parse(actionsJSON);

            const normalizeActionName = (name) => String(name || '')
                .toLowerCase()
                .replace(/[\\s\\-_()（）【】\\[\\]·,，.。]/g, '');

            const findActionByName = (name) => {
                const target = normalizeActionName(name);
                if (!target) return null;
                // 严格匹配：仅允许“规范化后全等”
                return actions.find(a => normalizeActionName(a.name) === target) || null;
            };

            const findActionById = (id) => {
                return actions.find(a => a.id === id);
            };

            // 优先命中动作库；未命中则返回待确认的临时 actionId（后续走人工确认创建）
            const ensureActionIdByName = (name) => {
                const matched = findActionByName(name);
                if (matched?.id) return matched.id;
                const normalized = normalizeActionName(name);
                return normalized ? ('pending:' + normalized.slice(0, 48)) : 'pending:unnamed';
            };

            ${code}

            JSON.stringify(trainingDays);
        `;

        const script = await isolate.compileScript(scriptCode);
        const result = await script.run(context, { timeout });
        return {
            success: true,
            result: JSON.parse(result),
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "代码执行失败",
        };
    } finally {
        if (isolate && !isolate.isDisposed) isolate.dispose();
    }
}
