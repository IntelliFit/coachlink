import supabase from "@/lib/supabaseClient";
import { CoachPlanTemplateRow } from "@/types";
import {
    TrainingItem,
    TrainingOptionQuestion,
    TrainingRmQuestion,
} from "@/types/questionnaires";
import {
    CoachPlanAction,
    CoachPlanTrainingDay,
} from "../create-template/entity";
import {
    calcIntensityDisplay,
    calcRecommendedLoad,
    normalizeIntensityConfig,
} from "@/lib/rmCaculator";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";

// 自动计算动作的配置类型
interface AutoComputeAction {
    id: string;
    name: string;
    enableAutoWeightCompute: boolean | null;
    includesBodyWeight: boolean | null; // true=负重动作(alpha=1), false/null=普通(alpha=0)
}

// fillTemplate的选项参数
export interface FillTemplateOptions {
    studentBodyWeight: number | null;
    autoComputeActions: AutoComputeAction[];
    studentId?: string; // 学员ID，用于获取最新的PR记录
    coachId?: string; // 教练ID，用于权限校验
}

export async function matchPlan(questionare: TrainingItem[]) {
    let query = supabase.from("coach_plan_templates")
        .select("*");

    console.log("问卷数据:", questionare);

    const tagsInfo = questionare.find((item) => item.type === "tags");
    if (
        tagsInfo && tagsInfo.userSelections &&
        tagsInfo.userSelections.length > 0
    ) {
        // 问卷中存储的就是标签名称（如"引体负重"），直接用于匹配
        console.log("学员选择的标签:", tagsInfo.userSelections);
        query = query.contains("tags", tagsInfo.userSelections);
    }

    const timesInfo = questionare.find((item) => item.type === "times");
    if (timesInfo) {
        console.log("匹配条件 - 每周训练次数:", timesInfo.userSelection);
        query = query.contains("week_days", [timesInfo.userSelection]);
    }

    // 只匹配动作选择类的 option 问题（排除 scope='global' 的全局问题）
    const optionInfos = questionare.filter((item) =>
        item.type === "option" && item.scope !== "global"
    ) as TrainingOptionQuestion[];

    const questionNames = optionInfos.map((o) => o.question);
    console.log("匹配条件 - 动作选择问题:", questionNames);

    // 先查出满足全局条件的模板
    const { data: planTemplates, error: planTemplatesError } = await query;

    if (planTemplatesError) {
        console.error("查询错误:", planTemplatesError);
        return null;
    }

    console.log(`全局条件匹配到 ${planTemplates?.length || 0} 个模板`);

    // 应用层过滤：检查 contained_options
    // 规则：如果模板的 contained_options 不为空，则要求学员问卷包含所有这些问题
    const filteredTemplates = planTemplates?.filter((template) => {
        const containedOptions = template.contained_options || [];

        // 如果模板没有条件筛选要求，直接匹配
        if (containedOptions.length === 0) {
            console.log(`模板 "${template.name}": 无条件筛选要求，匹配成功`);
            return true;
        }

        // 如果模板有条件筛选要求，检查学员问卷是否包含所有这些问题
        const allContained = containedOptions.every((opt: string) =>
            questionNames.includes(opt)
        );
        console.log(
            `模板 "${template.name}": 需要 ${containedOptions}, 学员有 ${questionNames}, 匹配: ${allContained}`,
        );
        return allContained;
    }) || [];

    console.log(`最终匹配到 ${filteredTemplates.length} 个模板`);
    return filteredTemplates;
}

/**
 * 计算动作的具体负重
 * 支持新的 intensityConfig 格式，同时向后兼容旧的 params.强度 字段
 */
function computeActionWeight(
    action: CoachPlanAction,
    userRmInputs: Record<string, number>,
    options?: FillTemplateOptions,
    autoComputeActionMap?: Map<string, AutoComputeAction>,
) {
    // 检查动作是否支持自动计算
    const actionConfig = autoComputeActionMap?.get(action.actionId);
    if (!actionConfig) {
        return;
    }

    // 检查学员是否有体重数据
    const bodyWeight = options?.studentBodyWeight;
    if (!bodyWeight || bodyWeight <= 0) {
        console.log(`动作 ${action.actionId}: 学员体重数据缺失，跳过计算`);
        return;
    }

    // 获取学员该动作的1RM
    const oneRM = userRmInputs[action.actionId];

    // 提取强度配置（支持新旧格式）
    const intensityConfig = normalizeIntensityConfig(action.params);
    const legacyRm = action.params?.["强度"];

    // 调试日志：检查 intensityConfig 是否正确传入
    console.log(`🔍 动作 ${actionConfig.name} (${action.actionId}):`, {
        "params.intensityConfig": action.params?.intensityConfig,
        "intensityConfig (normalized)": intensityConfig,
        "legacyRm (params.强度)": legacyRm,
        "oneRM": oneRM,
        "bodyWeight": bodyWeight,
    });

    // 如果没有任何强度配置，跳过
    if (!intensityConfig && !legacyRm) {
        console.log(`动作 ${action.actionId}: 未设置强度，跳过计算`);
        return;
    }

    // 根据动作的 includesBodyWeight 属性决定计算方式
    const includesBodyWeight = actionConfig.includesBodyWeight ?? false;

    try {
        // 使用新的计算函数
        const result = calcIntensityDisplay({
            intensityConfig,
            legacyRm,
            oneRM,
            bodyWeight,
            includesBodyWeight,
        });

        // 将计算结果存入 params
        if (result.source !== "none") {
            action.params = {
                ...action.params,
                load: result.displayWeight,
                loadUnit: result.displayUnit || "kg",
                loadSource: result.source,
                loadDisplayText: result.displayText,
                loadCalculated: result.source === "calculated",
            };

            const sourceLabel = result.source === "calculated"
                ? "自动计算"
                : result.source === "recommended"
                ? "推荐数值"
                : "相对强度";

            console.log(
                `✅ ${sourceLabel}: 动作=${actionConfig.name}, ` +
                    `1RM=${oneRM || "无"}kg, 体重=${bodyWeight}kg, ` +
                    `结果=${result.displayWeight ?? result.displayText}${
                        result.displayUnit || ""
                    }`,
            );
        }
    } catch (error) {
        console.error(`计算负重失败: 动作=${action.actionId}`, error);
    }
}

export async function fillTemplate(
    answers: TrainingItem[],
    template: CoachPlanTemplateRow,
    options?: FillTemplateOptions,
) {
    // 为 answers 中的 options 建立索引
    const optionNameMapUserSelection: Record<string, number> = {};
    for (const optionInfo of answers.filter((item) => item.type === "option")) {
        optionNameMapUserSelection[optionInfo.question] =
            optionInfo.userSelection;
    }

    // 获取学员1RM数据：优先使用最新的PR记录，如果没有则使用问卷数据
    const rmData = answers.find((item) => item.type === "rm") as
        | TrainingRmQuestion
        | undefined;
    const questionnaireRmInputs = rmData?.userInputs || {};
    
    let userRmInputs: Record<string, number> = questionnaireRmInputs;
    
    // 如果有学员ID和教练ID，尝试获取最新的PR记录
    // getCurrent1RMRecords 已经实现了时间优先级逻辑：
    // - 优先使用最新的 AUTO_STATE 记录
    // - 如果没有，使用最新的记录（按 date_achieved desc）
    // - 如果问卷更新时间更晚，用问卷值覆盖
    if (options?.studentId && options?.coachId) {
        try {
            const records = await getCurrent1RMRecords(options.coachId, {
                targetUserId: options.studentId,
            });
            
            // 构建1RM映射：直接使用 getCurrent1RMRecords 返回的值
            // getCurrent1RMRecords 已经按时间优先级处理过了：
            // - 优先使用最新的 AUTO_STATE 记录
            // - 如果没有，使用最新的记录（按 date_achieved desc）
            // - 如果问卷更新时间更晚，用问卷值覆盖
            const prRmMap: Record<string, number> = {};
            for (const record of records || []) {
                // 同时使用 actionId 和 actionName 作为 key，确保能匹配到
                // getCurrent1RMRecords 返回的数组中，每个动作只有一个记录（最新的）
                if (record.actionId && record.current1RM > 0) {
                    prRmMap[record.actionId] = record.current1RM;
                }
                // 同时使用 actionName 作为 key（用于匹配没有 actionId 的情况）
                if (record.actionName && record.current1RM > 0) {
                    prRmMap[record.actionName] = record.current1RM;
                }
            }
            
            // 合并数据：PR记录优先（因为它已经按时间优先级处理），问卷数据作为fallback
            userRmInputs = {
                ...questionnaireRmInputs,
                ...prRmMap,
            };
            
            console.log(
                `✅ 已获取最新PR记录，覆盖了 ${Object.keys(prRmMap).length} 个动作的1RM数据`,
                `PR记录:`,
                prRmMap,
            );
        } catch (error) {
            console.warn(
                `⚠️ 获取PR记录失败，使用问卷数据:`,
                error,
            );
            // 如果获取PR记录失败，继续使用问卷数据
        }
    }

    // 构建可自动计算的动作Map
    const autoComputeActionMap = new Map<string, AutoComputeAction>(
        options?.autoComputeActions?.map((a) => [a.id, a]) || [],
    );

    console.log(
        `学员体重: ${options?.studentBodyWeight}kg, 1RM数据:`,
        userRmInputs,
    );
    console.log(`支持自动计算的动作: ${autoComputeActionMap.size}个`);

    const trainingItems = template
        .training_days as unknown as CoachPlanTrainingDay[];

    if (!trainingItems) {
        console.warn("模板没有训练日数据");
        return;
    }

    for (const day of trainingItems) {
        const specificActionSet = [] as CoachPlanAction[];

        if (!day.actionSets) {
            continue;
        }

        for (const actionSet of day.actionSets) {
            if (actionSet.type === "one-filter") {
                const question = actionSet.question;
                const userSelection =
                    optionNameMapUserSelection[question.question];
                const selectedAction = actionSet.actions[userSelection];
                // 计算具体重量
                computeActionWeight(
                    selectedAction,
                    userRmInputs,
                    options,
                    autoComputeActionMap,
                );
                specificActionSet.push(selectedAction);
            } else if (actionSet.type === "no-filter") {
                // 计算具体重量
                computeActionWeight(
                    actionSet,
                    userRmInputs,
                    options,
                    autoComputeActionMap,
                );
                specificActionSet.push(actionSet);
            }
        }

        day.actionSets = specificActionSet;
    }
}
