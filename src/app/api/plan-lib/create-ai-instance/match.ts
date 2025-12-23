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
import { calcRecommendedLoad } from "@/lib/rmCaculator";

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
 * 将RM次数转换为具体重量(kg)
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
    if (!oneRM || oneRM <= 0) {
        console.log(`动作 ${action.actionId}: 学员未填写1RM数据，跳过计算`);
        return;
    }

    // 获取强度（RM次数）
    const rmValue = action.params?.["强度"];
    if (!rmValue || rmValue <= 0) {
        console.log(`动作 ${action.actionId}: 模板未设置强度(RM)，跳过计算`);
        return;
    }

    // 根据动作的 includesBodyWeight 属性决定 alpha 值
    // true = 负重动作（引体/臂屈伸），需要减去体重 -> alpha=1
    // false/null = 普通动作（深蹲/卧推/硬拉）-> alpha=0
    const alpha = actionConfig.includesBodyWeight ? 1 : 0;

    try {
        // 计算具体负重
        const calculatedWeight = calcRecommendedLoad(
            oneRM,
            bodyWeight,
            rmValue,
            alpha,
            "average",
        );

        // 将计算结果存入 params.load
        action.params = {
            ...action.params,
            load: calculatedWeight,
            loadUnit: "kg",
            loadCalculated: true, // 标记为已自动计算
        };

        console.log(
            `✅ 自动计算负重: 动作=${actionConfig.name}, 1RM=${oneRM}kg, 体重=${bodyWeight}kg, ${rmValue}RM, alpha=${alpha} -> ${calculatedWeight}kg`,
        );
    } catch (error) {
        console.error(`计算负重失败: 动作=${action.actionId}`, error);
    }
}

export function fillTemplate(
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

    // 获取学员1RM数据
    const rmData = answers.find((item) => item.type === "rm") as
        | TrainingRmQuestion
        | undefined;
    const userRmInputs = rmData?.userInputs || {};

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
