import { NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import OpenAI from "openai";
import ivm from "isolated-vm";
import { BatchOperationDto, SSEMessage, ModificationDiff, NewActionDetected } from "./entity";

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 初始化 OpenAI 客户端 (使用 DeepSeek)
function getOpenAIClient(): OpenAI {
    if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }

    return new OpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
    });
}

/**
 * 在隔离的虚拟机中安全执行 TypeScript 代码
 */
async function executeCodeInVM(
    code: string,
    trainingDays: any[],
    actions: Array<{ id: string; name: string }>,
    timeout = 10000,
    memoryLimit = 128
): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
        // 创建隔离的虚拟机实例
        const isolate = new ivm.Isolate({ memoryLimit });
        const context = await isolate.createContext();

        // 注入数据到虚拟机上下文
        const jail = context.global;
        await jail.set('global', jail.derefInto());

        // 将 trainingDays 和 actions 注入到虚拟机
        await jail.set(
            'trainingDaysJSON',
            new ivm.ExternalCopy(JSON.stringify(trainingDays)).copyInto()
        );
        await jail.set(
            'actionsJSON',
            new ivm.ExternalCopy(JSON.stringify(actions)).copyInto()
        );

        // 准备执行的代码
        const scriptCode = `
            // 解析输入数据
            const trainingDays = JSON.parse(trainingDaysJSON);
            const actions = JSON.parse(actionsJSON);
            
            // 辅助函数
            const findActionByName = (name) => {
                return actions.find(a => a.name.includes(name) || name.includes(a.name));
            };
            
            const findActionById = (id) => {
                return actions.find(a => a.id === id);
            };
            
            // 用户代码
            ${code}
            
            // 返回结果
            JSON.stringify(trainingDays);
        `;

        // 编译并执行代码
        const script = await isolate.compileScript(scriptCode);
        const result = await script.run(context, { timeout });

        // 解析结果
        const updatedTrainingDays = JSON.parse(result);

        return {
            success: true,
            result: updatedTrainingDays
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || '代码执行失败'
        };
    }
}

/**
 * 分析训练计划的修改差异
 */
function analyzeModifications(
    original: any[],
    updated: any[],
    actions: Array<{ id: string; name: string }>
): ModificationDiff[] {
    const modifications: ModificationDiff[] = [];
    const actionMap = new Map(actions.map(a => [a.id, a.name]));

    for (let i = 0; i < Math.max(original.length, updated.length); i++) {
        const origDay = original[i];
        const updDay = updated[i];

        // 检查训练日是否被删除
        if (origDay && !updDay) {
            modifications.push({
                dayIndex: origDay.dayIndex || i + 1,
                actionName: '整个训练日',
                field: '删除',
                oldValue: origDay.type === 'training' ? '训练日' : '休息日',
                newValue: '已删除'
            });
            continue;
        }

        // 检查训练日是否被添加
        if (!origDay && updDay) {
            modifications.push({
                dayIndex: updDay.dayIndex || i + 1,
                actionName: '整个训练日',
                field: '添加',
                oldValue: '无',
                newValue: updDay.type === 'training' ? '训练日' : '休息日'
            });
            continue;
        }

        if (!origDay || !updDay) continue;

        const dayIndex = updDay.dayIndex || i + 1;

        // 检查训练日类型变化
        if (origDay.type !== updDay.type) {
            modifications.push({
                dayIndex,
                actionName: '训练日类型',
                field: 'type',
                oldValue: origDay.type === 'training' ? '训练日' : '休息日',
                newValue: updDay.type === 'training' ? '训练日' : '休息日'
            });
        }

        // 检查备注变化
        if (origDay.note !== updDay.note) {
            modifications.push({
                dayIndex,
                actionName: '备注',
                field: 'note',
                oldValue: origDay.note || '无',
                newValue: updDay.note || '无'
            });
        }

        // 检查动作集变化
        const origSets = origDay.actionSets || [];
        const updSets = updDay.actionSets || [];

        for (let j = 0; j < Math.max(origSets.length, updSets.length); j++) {
            const origSet = origSets[j];
            const updSet = updSets[j];

            if (!origSet && updSet) {
                // 新增动作
                const actionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';
                modifications.push({
                    dayIndex,
                    actionName,
                    field: '添加动作',
                    oldValue: '无',
                    newValue: `${actionName} (${updSet.params?.sets || 0}组 × ${updSet.params?.reps || 0}次)`
                });
            } else if (origSet && !updSet) {
                // 删除动作
                const actionName = actionMap.get(origSet.actionId) || origSet.params?.action_name || '未知动作';
                modifications.push({
                    dayIndex,
                    actionName,
                    field: '删除动作',
                    oldValue: `${actionName} (${origSet.params?.sets || 0}组 × ${origSet.params?.reps || 0}次)`,
                    newValue: '已删除'
                });
            } else if (origSet && updSet) {
                const actionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';

                // 检查动作ID变化(替换)
                if (origSet.actionId !== updSet.actionId) {
                    const oldActionName = actionMap.get(origSet.actionId) || origSet.params?.action_name || '未知动作';
                    const newActionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';
                    modifications.push({
                        dayIndex,
                        actionName: oldActionName,
                        field: '替换动作',
                        oldValue: oldActionName,
                        newValue: newActionName
                    });
                }

                // 检查参数变化
                const origParams = origSet.params || {};
                const updParams = updSet.params || {};

                if (origParams.sets !== updParams.sets) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '组数',
                        oldValue: origParams.sets || 0,
                        newValue: updParams.sets || 0
                    });
                }

                if (origParams.reps !== updParams.reps) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '次数',
                        oldValue: origParams.reps || 0,
                        newValue: updParams.reps || 0
                    });
                }

                if (origParams.weight !== updParams.weight) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '重量',
                        oldValue: `${origParams.weight || 0}kg`,
                        newValue: `${updParams.weight || 0}kg`
                    });
                }

                if (origParams.rest_seconds !== updParams.rest_seconds) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '休息时间',
                        oldValue: `${origParams.rest_seconds || 0}秒`,
                        newValue: `${updParams.rest_seconds || 0}秒`
                    });
                }
            }
        }
    }

    return modifications;
}

/**
 * SSE 流式批量操作接口
 */
export async function POST(req: NextRequest) {
    // 验证用户身份
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId || !session.user.is_coach) {
        return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            { status: 401 }
        );
    }

    try {
        const body = await req.json() as BatchOperationDto;
        const { templateId, instruction, conversationHistory = [] } = body;

        // 合并多轮对话为模型可见的完整指令（首轮 + 助手追问 + 用户补充）
        const effectiveInstruction =
            conversationHistory.length === 0
                ? instruction
                : [
                    `【用户首轮指令】\n${instruction}`,
                    ...conversationHistory.map(
                        (t) => `【${t.role === 'assistant' ? '助手追问' : '用户补充'}】\n${t.content}`
                    ),
                ].join('\n\n');

        // 创建 SSE 响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // 辅助函数：发送 SSE 消息
                const sendMessage = (message: SSEMessage) => {
                    const data = `data: ${JSON.stringify(message)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                };

                try {
                    const startTime = Date.now();

                    // 1. 获取训练计划模板
                    sendMessage({ type: 'progress', message: '正在加载训练计划' });
                    
                    const { data: template, error: templateError } = await supabase
                        .from('coach_plan_templates')
                        .select('*')
                        .eq('id', templateId)
                        .eq('coach_id', userId)
                        .single();

                    if (templateError || !template) {
                        throw new Error('无法找到训练计划模板');
                    }

                    const originalTrainingDays = JSON.parse(JSON.stringify(template.training_days || []));
                    const trainingDays = JSON.parse(JSON.stringify(template.training_days || []));

                    // 2. 获取教练的所有动作库
                    sendMessage({ type: 'progress', message: '正在加载动作库' });
                    
                    const { data: actionsData, error: actionsError } = await supabase
                        .from('coach_actions')
                        .select('id, name, type, detail')
                        .eq('coach_id', userId);

                    if (actionsError) {
                        throw new Error('无法加载动作库');
                    }

                    const actions = actionsData || [];

                    // 首先让 AI 判断用户意图
                    sendMessage({ type: 'progress', message: '正在分析您的需求' });

                    const intentPrompt = `你是一个训练计划助手。请分析用户的指令，判断他们是想要：
1. **查询/分析** - 想了解计划中的某些信息，如统计数据、动作分布、强度分析等（不修改计划）
2. **修改** - 想要对计划进行更改、替换、添加、删除等操作

## 当前训练计划概览
- 总天数: ${trainingDays.length} 天
- 训练天数: ${trainingDays.filter((d: any) => d.type === 'training').length} 天
- 休息天数: ${trainingDays.filter((d: any) => d.type === 'rest').length} 天

## 计划详情
${JSON.stringify(trainingDays, null, 2)}

## 可用的动作列表
${actions.map(a => `- ${a.name} (type: ${a.type})`).join('\n')}

## 用户指令（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请返回 JSON 格式:
{
    "intent": "query" 或 "modify",
    "reason": "简短说明判断依据"
}`;

                    const openai = getOpenAIClient();
                    const intentCompletion = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [{ role: "system", content: intentPrompt }],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 200
                    });

                    const intentContent = intentCompletion.choices[0]?.message?.content;
                    const intentResult = intentContent ? JSON.parse(intentContent) : { intent: 'modify' };
                    const userIntent = intentResult.intent as 'query' | 'modify';

                    // 根据意图走不同流程
                    if (userIntent === 'query') {
                        // 查询模式：让 AI 分析并回答
                        sendMessage({ type: 'progress', message: '正在分析训练计划' });

                        const queryPrompt = `你是一个专业的训练计划分析师。请根据用户的问题，分析训练计划并给出详细回答。

## 当前训练计划数据
\`\`\`json
${JSON.stringify(trainingDays, null, 2)}
\`\`\`

## 可用的动作列表（包含类型）
${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}

## 动作类型说明
- STRENGTH: 力量训练
- CARDIO: 有氧运动
- DIET: 饮食相关
- HABIT: 习惯养成

## 用户问题（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请用中文回答，格式要清晰易读。如果涉及统计，请给出具体数字。可以使用 markdown 格式（如列表、加粗等）来增强可读性。`;

                        const queryCompletion = await openai.chat.completions.create({
                            model: "deepseek-chat",
                            messages: [{ role: "system", content: queryPrompt }],
                            temperature: 0.3,
                            max_tokens: 2000
                        });

                        const queryAnswer = queryCompletion.choices[0]?.message?.content || '无法分析该问题';
                        const totalDuration = Date.now() - startTime;

                        // 发送统计信息（开发模式）
                        if (isDevelopment) {
                            const totalTokens = (intentCompletion.usage?.total_tokens || 0) + (queryCompletion.usage?.total_tokens || 0);
                            sendMessage({
                                type: 'stats',
                                tokenUsage: {
                                    prompt: (intentCompletion.usage?.prompt_tokens || 0) + (queryCompletion.usage?.prompt_tokens || 0),
                                    completion: (intentCompletion.usage?.completion_tokens || 0) + (queryCompletion.usage?.completion_tokens || 0),
                                    total: totalTokens
                                },
                                duration: totalDuration
                            });
                        }

                        // 发送查询结果
                        sendMessage({
                            type: 'query_result',
                            answer: queryAnswer
                        });

                        return; // 查询模式结束，不执行修改逻辑
                    }

                    // 修改模式：先检查用户指令是否信息完整
                    sendMessage({ type: 'progress', message: '正在检查指令是否完整' });
                    const clarificationPrompt = `你是一个训练计划助手。请判断用户的修改指令是否**信息完整**，能否直接执行。

## 判断规则（以下情况视为信息不完整，需向用户追问）
- 用户说「改为有氧」「换成有氧」「改成有氧」等，但**没有指定具体是哪种有氧运动**（如跑步、跳绳、骑行等）→ 不完整，需追问具体有氧类型
- 用户说「替换为力量动作」「改成力量」等，但**没有指定具体动作名称** → 不完整，需追问具体动作
- 用户说「改成 CARDIO」或「改为有氧类」但未说明具体动作 → 不完整
- 其他：指令中涉及「替换为」「改为」某**类别**（有氧/力量/休息等）而非**具体动作名**时，一律视为不完整，需请用户给出具体动作名称或从现有动作库中选择

## 若信息完整
- 用户已明确写出具体动作名（如「改为跑步」「替换为固定器械高位下拉」）
- 或仅做组数/次数/重量/休息等参数调整，不涉及替换动作类型
- 或删除/添加时已写明具体动作名
→ 返回 complete: true，无需 clarificationQuestion

## 当前动作库（供你判断用户是否可能从库中选）
${actions.map(a => `${a.name} (${a.type})`).join('、')}

## 用户指令（含多轮对话时此处为完整上下文，请结合用户补充判断是否已完整）
${effectiveInstruction}

请严格返回 JSON（不要其他内容）:
{
    "complete": true 或 false,
    "clarificationQuestion": "若 complete 为 false，此处写一句简短的中文追问，例如：请说明要改成哪种具体的有氧运动（如跑步、跳绳、骑行等）？",
    "suggestions": ["若 complete 为 false，此处返回 3～6 个具体推荐选项的字符串数组，与追问内容对应。例如有氧类可填 [\"跑步\", \"跳绳\", \"骑行\", \"游泳\", \"划船\"]，力量类可填动作库中的具体动作名。用户可点击直接选用。"]
}`;
                    const clarificationCompletion = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [{ role: "system", content: clarificationPrompt }],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 400
                    });
                    const clarificationContent = clarificationCompletion.choices[0]?.message?.content;
                    let clarificationResult: { complete?: boolean; clarificationQuestion?: string; suggestions?: string[] } = { complete: true };
                    if (clarificationContent) {
                        try {
                            clarificationResult = JSON.parse(clarificationContent);
                        } catch (_) {}
                    }
                    const suggestions = Array.isArray(clarificationResult.suggestions)
                        ? clarificationResult.suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 8)
                        : undefined;
                    if (clarificationResult.complete === false && clarificationResult.clarificationQuestion) {
                        sendMessage({
                            type: 'need_clarification',
                            question: clarificationResult.clarificationQuestion,
                            ...(suggestions?.length ? { suggestions } : {})
                        });
                        return;
                    }

                    // 代码生成流程（借鉴智能导入的 training data 结构描述）
                    const systemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。**只能使用下方「当前可用的动作列表」中的动作 id，禁止编造或使用列表外 actionId。**

## 训练计划数据结构

### trainingDays（训练日数组）
每个元素表示一天，按 dayIndex 顺序排列。

\`\`\`typescript
interface TrainingDay {
    type: 'training' | 'rest';   // 训练日 或 休息日
    note?: string;                 // 当天备注
    actionSets?: ActionSet[];     // 当天的动作集合（仅 type===training 时有）
    dayIndex: number;              // 第几天，从 1 开始
}
\`\`\`

### ActionSet（单日内的一个动作项）
\`\`\`typescript
interface ActionSet {
    actionId: string;   // 必须来自「当前可用的动作列表」中的 id，禁止使用列表外的 id
    setName?: string;
    params: {
        action_name?: string;   // 可选，展示用名称
        sets?: number;          // 组数（STRENGTH 常用）
        reps?: number;          // 次数（STRENGTH 常用）
        weight?: number;       // 重量 kg（STRENGTH 常用）
        rest_seconds?: number;  // 组间休息秒
        note?: string;
        // 有氧/饮食/习惯类动作可能还有 customData，见下
    };
}
\`\`\`

### 动作类型与 params 规则（与智能导入一致）
- **STRENGTH（力量）**：使用 sets、reps、weight、rest_seconds；可配 intensityConfig（如 RM、百分比）
- **CARDIO（有氧）**：sets/reps/weight 通常为 null，用 params 中的 customData 或 note 表达距离/时长/配速等
- **DIET / HABIT**：同上，以 customData 或 note 为主

### 重要约束
1. **actionId 唯一来源**：只能使用下面「当前可用的动作列表」里给出的 id。不得自造 uuid 或写列表中不存在的 id。
2. 直接修改 \`trainingDays\` 数组即可，不要 return。
3. 代码在沙箱中执行，禁止 \`require\`、\`fetch\`、异步、全局变量等。
4. 处理边界情况：先判断 \`day.actionSets\` 存在再遍历，避免空引用。

## 可用的辅助函数
- \`findActionByName(name: string)\`: 通过名称模糊查找动作，返回 \`actions\` 中的项
- \`findActionById(id: string)\`: 通过 id 查找动作

## 当前可用的动作列表（仅允许使用以下 id）
${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}

## trainingDays 当前内容示例
${JSON.stringify(trainingDays.slice(0, 2), null, 2)}

## 用户指令（含多轮对话时此处为完整上下文，请按用户最终意图生成代码）
${effectiveInstruction}

## 请生成 TypeScript 代码
返回 JSON：
{
    "actionPlan": "一句用户友好的执行计划说明（中文）",
    "code": "<仅修改 trainingDays 的 TypeScript 代码，不要包含注释外的任何说明>"
}`;

                    // 4. 调用 AI 并执行代码（支持重试）
                    const maxRetries = 3;
                    let retryCount = 0;
                    let executionResult: any = null;
                    let lastError: string = '';
                    
                    const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
                        { role: "system", content: systemPrompt }
                    ];

                    while (retryCount < maxRetries) {
                        try {
                            // 生成或重新生成代码
                            if (retryCount === 0) {
                                sendMessage({ type: 'progress', message: '正在生成操作方案' });
                            } else {
                                // 用户友好的消息，开发模式下显示重试次数
                                const retryMessage = isDevelopment 
                                    ? `正在微调执行序列（第 ${retryCount + 1}/${maxRetries} 次尝试）`
                                    : '正在微调执行序列';
                                sendMessage({ type: 'progress', message: retryMessage });
                            }

                            const aiStartTime = Date.now();
                            const completion = await openai.chat.completions.create({
                                model: "deepseek-chat",
                                messages: messages,
                                response_format: { type: "json_object" },
                                temperature: 0.2,
                                max_tokens: 4000
                            });
                            const aiDuration = Date.now() - aiStartTime;

                            const responseContent = completion.choices[0]?.message?.content;
                            if (!responseContent) {
                                throw new Error('AI 未返回有效响应');
                            }

                            const aiResponse = JSON.parse(responseContent) as {
                                actionPlan: string;
                                code: string;
                            };

                            // 第一次生成时发送执行计划
                            if (retryCount === 0) {
                                sendMessage({
                                    type: 'action_plan',
                                    plan: aiResponse.actionPlan || '准备执行批量操作'
                                });
                            }

                            // 如果是开发模式，发送统计信息
                            if (isDevelopment && completion.usage) {
                                sendMessage({
                                    type: 'stats',
                                    tokenUsage: {
                                        prompt: completion.usage.prompt_tokens,
                                        completion: completion.usage.completion_tokens,
                                        total: completion.usage.total_tokens
                                    },
                                    duration: aiDuration
                                });
                            }

                            // 执行代码
                            sendMessage({ type: 'progress', message: '正在执行操作...' });

                            executionResult = await executeCodeInVM(
                                aiResponse.code,
                                trainingDays,
                                actions.map(a => ({ id: a.id, name: a.name }))
                            );

                            if (executionResult.success) {
                                // 执行成功，跳出重试循环
                                break;
                            } else {
                                // 执行失败，准备重试
                                lastError = executionResult.error || '代码执行失败';
                                retryCount++;

                                if (retryCount < maxRetries) {
                                    // 将错误信息加入上下文
                                    messages.push(
                                        { role: "assistant", content: responseContent },
                                        { 
                                            role: "user", 
                                            content: `代码执行失败，错误信息：${lastError}\n\n请修复代码中的错误，重新生成正确的代码。注意：\n1. 不要使用return语句，直接修改trainingDays数组\n2. 确保所有语法正确\n3. 处理可能的边界情况`
                                        }
                                    );
                                } else {
                                    // 达到最大重试次数
                                    throw new Error('操作执行失败，已尝试多次修正但仍存在问题。请尝试更清晰地描述你的需求，或者手动编辑计划。');
                                }
                            }
                        } catch (error: any) {
                            if (retryCount >= maxRetries - 1) {
                                throw error;
                            }
                            lastError = error.message;
                            retryCount++;
                        }
                    }

                    if (!executionResult || !executionResult.success) {
                        throw new Error('操作执行失败，已尝试多次修正但仍存在问题。请尝试更清晰地描述你的需求，或者手动编辑计划。');
                    }

                    // 6. 分析修改差异
                    const modifications = analyzeModifications(
                        originalTrainingDays,
                        executionResult.result,
                        actions.map(a => ({ id: a.id, name: a.name }))
                    );

                    // 6.1 检测修改计划中是否包含不在动作库中的动作
                    const knownActionIds = new Set(actions.map((a: any) => a.id));
                    const newActionsDetected: NewActionDetected[] = [];
                    for (const day of executionResult.result || []) {
                        const sets = day.actionSets || [];
                        for (const set of sets) {
                            const aid = set.actionId;
                            if (aid && !knownActionIds.has(aid)) {
                                const suggestedName = set.params?.action_name || undefined;
                                if (!newActionsDetected.some((x) => x.actionId === aid)) {
                                    newActionsDetected.push({ actionId: aid, suggestedName });
                                }
                            }
                        }
                    }
                    if (newActionsDetected.length > 0) {
                        const namesList = newActionsDetected
                            .map((a) => a.suggestedName || a.actionId)
                            .join('、');
                        sendMessage({
                            type: 'new_actions_detected',
                            actions: newActionsDetected,
                            message: `修改计划中包含以下不在您动作库中的动作：${namesList}。请先在动作库中创建这些动作后再应用，或确认是否仍要应用计划。`
                        });
                    }

                    const totalDuration = Date.now() - startTime;

                    // 7. 发送预览结果(不保存到数据库)
                    sendMessage({
                        type: 'preview_result',
                        success: true,
                        originalTrainingDays,
                        updatedTrainingDays: executionResult.result,
                        modifications,
                        message: `分析完成，共发现 ${modifications.length} 处修改${isDevelopment ? ` (总耗时 ${totalDuration}ms)` : ''}`
                    });

                } catch (error: any) {
                    console.error('[batch-operation] Error:', error);
                    sendMessage({
                        type: 'error',
                        message: error.message || '操作失败'
                    });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('[batch-operation] Request error:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { status: 500 }
        );
    }
}
