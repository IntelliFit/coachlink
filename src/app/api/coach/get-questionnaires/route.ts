import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    GetQuestionnairesDto,
    GetQuestionnairesResponseDto,
} from "./entity";
import { TrainingItem } from "@/types/questionnaires";

function ensureQuestionIds(questions: any[]): { normalized: TrainingItem[]; changed: boolean } {
    let changed = false;
    const normalized = (Array.isArray(questions) ? questions : []).map((q: any) => {
        // 兼容极老数据：字符串数组
        if (typeof q === "string") {
            changed = true;
            return {
                id: crypto.randomUUID(),
                type: "text",
                question: q,
            } as any;
        }

        if (!q || typeof q !== "object") return q as any;

        // 确保保留所有字段，包括 branching、media 等
        if (!q.id) {
            const normalizedQ = { ...q, id: crypto.randomUUID() };
            changed = true;
            return normalizedQ as any;
        }
        return q as any;
    });

    return { normalized: normalized as unknown as TrainingItem[], changed };
}

async function enrichRmQuestions(
    questions: TrainingItem[],
): Promise<TrainingItem[]> {
    const rmActionIds = Array.from(
        new Set(
            questions.flatMap((item: any) =>
                item?.type === "rm" && Array.isArray(item?.actionIds)
                    ? item.actionIds.filter((id: unknown) => typeof id === "string" && id.trim())
                    : [],
            ),
        ),
    );

    if (rmActionIds.length === 0) {
        return questions;
    }

    const { data: actionRows, error: actionError } = await supabase
        .from("coach_actions")
        .select("id, name")
        .in("id", rmActionIds);

    if (actionError) {
        console.error("[get-questionnaires] load rm action names failed:", actionError);
    }

    const actionNameMap = new Map<string, string>();
    (actionRows || []).forEach((row: any) => {
        const id = String(row?.id || "").trim();
        const name = String(row?.name || "").trim();
        if (id && name) actionNameMap.set(id, name);
    });

    return questions.map((item: any) => {
        if (item?.type !== "rm") return item;

        const actionIds = Array.isArray(item?.actionIds) ? item.actionIds : [];
        const existingInputs =
            item?.userInputs && typeof item.userInputs === "object" ? item.userInputs : {};

        const generatedInputs: Record<string, string | number> = {};
        actionIds.forEach((actionId: string, index: number) => {
            const key =
                actionNameMap.get(String(actionId).trim()) ||
                String(actionId || "").trim() ||
                `动作${index + 1}`;
            if (!(key in generatedInputs)) {
                generatedInputs[key] = existingInputs[key] ?? "";
            }
        });

        return {
            ...item,
            userInputs:
                Object.keys(generatedInputs).length > 0
                    ? generatedInputs
                    : existingInputs,
        } as TrainingItem;
    });
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    let userId = session.user.id;

    const {
        coachId = "",
    } = await req.json() as GetQuestionnairesDto;

    if (!coachId) {
        if (!session.user.is_coach) {
            return NextResponse.json({
                success: false,
                message: "用户不是教练",
                data: null,
            }, { status: 403 });
        }
    } else {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("*")
            .eq("id", coachId)
            .single();

        if (coachError) {
            return NextResponse.json({
                success: false,
                message: "获取教练信息失败",
                data: null,
            }, { status: 500 });
        }

        userId = coach.user_id;
    }

    // 获取线上问卷（status='active' 或 is_active=true）
    // 规则：线上版本就是“学员订阅时应用的版本”
    // 优先使用 status 字段（迁移后更稳定），兼容旧数据用 is_active
    // 简化逻辑：先获取所有问卷，然后在内存中筛选
    const { data: allQuestionnaires, error: fetchError } = await supabase
        .from("coach_questionnaires")
        .select("id,questions,is_active,status,updated_at")
        .eq("coach_id", userId)
        .order("updated_at", { ascending: false });

    if (fetchError) {
        console.error("[get-questionnaires] fetch error:", fetchError);
        return NextResponse.json({
            success: false,
            message: "获取问卷失败",
            data: null,
        }, { status: 500 });
    }

    // 筛选线上版本：必须同时满足 status='active' AND is_active=true
    const questionnaire = (allQuestionnaires || []).find((q: any) => {
        // 优先检查 status 和 is_active 的一致性
        if (q.status) {
            // 如果 status 存在，必须同时检查 is_active
            if (q.status === 'active') {
                return q.is_active === true;  // 必须同时为 true
            }
            return false;
        }
        // 兼容旧数据：如果 status 为空，使用 is_active
        return q.is_active === true;
    }) || null;

    // 注意：training_items 查询已移除，tags 选项现在由教练自定义

    // 默认问题列表：包含用户极限（1RM）问题
    // 注意：tags 选项现在由教练自定义，默认为空数组
    const defaultQuestions = [
        {
            type: "tags",
            // 教练自定义训练项目选项，默认为空
            options: [],
        }, // 训练项目偏好
        {
            type: "times",
            question: "您希望每周训练几次？",
            options: [1, 2, 3, 4, 5, 6, 7],
        }, // 每周训练次数（可配置）
        {
            type: "rm",
            // 由教练在问卷里选择需要填写 1RM 的动作；默认不强制任何动作
            actionIds: [],
        }, // 用户极限（1RM）
    ];

    const questionnairesData = questionnaire ?? {
        id: "",
        questions: defaultQuestions,
    };

    // 确保每个问题都有稳定 id（用于分支/历史答案匹配）
    const { normalized, changed } = ensureQuestionIds(
        (questionnairesData as any)?.questions || [],
    );

    // 若发现旧数据缺少 id，则自动补齐并持久化（避免每次打开都变）
    if (changed && questionnairesData.id) {
        const { error: patchErr } = await supabase
            .from("coach_questionnaires")
            .update({ questions: normalized as any })
            .eq("id", questionnairesData.id);
        if (patchErr) {
            // 不阻断返回，但打印日志便于排查
            console.error("[get-questionnaires] auto-migrate ids failed:", patchErr);
        }
    }

    const enrichedQuestions = await enrichRmQuestions(normalized);

    return NextResponse.json<ApiData<GetQuestionnairesResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: {
            id: questionnairesData.id,
            questionnaires: enrichedQuestions,
        },
    });
}
