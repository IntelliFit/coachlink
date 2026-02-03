import { NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import OpenAI from "openai";
import ivm from "isolated-vm";
import { BatchOperationDto, SSEMessage, ModificationDiff } from "./entity";

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
        const { templateId, instruction } = body;

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
                    sendMessage({ type: 'progress', message: '正在加载训练计划...' });
                    
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
                    sendMessage({ type: 'progress', message: '正在加载动作库...' });
                    
                    const { data: actionsData, error: actionsError } = await supabase
                        .from('coach_actions')
                        .select('id, name, type, detail')
                        .eq('coach_id', userId);

                    if (actionsError) {
                        throw new Error('无法加载动作库');
                    }

                    const actions = actionsData || [];

                    // 3. 构建初始 prompt
                    sendMessage({ type: 'progress', message: '正在分析您的指令...' });

                    const systemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。

## 可用的数据结构

### trainingDays (训练日数组)
\`\`\`typescript
interface TrainingDay {
    type: 'training' | 'rest';
    note?: string;
    actionSets?: ActionSet[];
    dayIndex: number;
}

interface ActionSet {
    actionId: string;
    setName: string;
    params: {
        action_name?: string;
        sets?: number;
        reps?: number;
        weight?: number;
        rest_seconds?: number;
        note?: string;
        // ... 其他参数
    };
}
\`\`\`

### actions (可用的动作库)
\`\`\`typescript
interface Action {
    id: string;
    name: string;
    type: 'STRENGTH' | 'CARDIO' | 'DIET' | 'HABIT';
    detail?: string;
}
\`\`\`

## 可用的辅助函数
- \`findActionByName(name: string)\`: 通过名称模糊查找动作
- \`findActionById(id: string)\`: 通过ID查找动作

## 注意事项
1. 直接修改 trainingDays 数组即可，不需要返回值
2. 代码会在沙箱中执行，有内存(128MB)和时间(10s)限制
3. 不要使用任何外部库或异步操作
4. 确保代码健壮，处理边界情况

## 当前可用的动作列表
${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}

## trainingDays 结构示例
${JSON.stringify(trainingDays.slice(0, 2), null, 2)}

## 用户指令
${instruction}

## 请生成 TypeScript 代码
要求返回 JSON 格式:
{
    "actionPlan": "用户友好的执行计划说明，例如：将第1-7天的深蹲替换为硬拉，并调整组数为5组",
    "code": "typescript代码"
}`;

                    // 4. 调用 AI
                    sendMessage({ type: 'progress', message: '正在生成操作方案...' });

                    const aiStartTime = Date.now();
                    const openai = getOpenAIClient();
                    const completion = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [
                            { role: "system", content: systemPrompt }
                        ],
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

                    // 发送执行计划(用户友好)
                    sendMessage({
                        type: 'action_plan',
                        plan: aiResponse.actionPlan || '准备执行批量操作'
                    });

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

                    // 5. 在虚拟机中执行代码
                    sendMessage({ type: 'progress', message: '正在执行操作...' });

                    const executionResult = await executeCodeInVM(
                        aiResponse.code,
                        trainingDays,
                        actions.map(a => ({ id: a.id, name: a.name }))
                    );

                    if (!executionResult.success) {
                        throw new Error(executionResult.error || '代码执行失败');
                    }

                    // 6. 分析修改差异
                    const modifications = analyzeModifications(
                        originalTrainingDays,
                        executionResult.result,
                        actions.map(a => ({ id: a.id, name: a.name }))
                    );

                    // 发送每个修改的用户友好描述
                    const modificationsByDay = new Map<number, ModificationDiff[]>();
                    modifications.forEach(mod => {
                        if (!modificationsByDay.has(mod.dayIndex)) {
                            modificationsByDay.set(mod.dayIndex, []);
                        }
                        modificationsByDay.get(mod.dayIndex)!.push(mod);
                    });

                    for (const [dayIndex, mods] of modificationsByDay.entries()) {
                        const description = mods.map(mod => {
                            if (mod.field === '添加动作') {
                                return `添加 ${mod.actionName}`;
                            } else if (mod.field === '删除动作') {
                                return `删除 ${mod.actionName}`;
                            } else if (mod.field === '替换动作') {
                                return `将 ${mod.oldValue} 替换为 ${mod.newValue}`;
                            } else {
                                return `${mod.actionName}的${mod.field}从 ${mod.oldValue} 改为 ${mod.newValue}`;
                            }
                        }).join('；');

                        sendMessage({
                            type: 'modification',
                            dayIndex,
                            actionName: mods[0].actionName,
                            description
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
