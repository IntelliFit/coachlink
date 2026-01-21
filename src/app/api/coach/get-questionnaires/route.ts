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

        if (!q.id) {
            q = { ...q, id: crypto.randomUUID() };
            changed = true;
        }
        return q as any;
    });

    return { normalized: normalized as unknown as TrainingItem[], changed };
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

    // 获取线上问卷（is_active=true）
    // 规则：线上版本就是“学员订阅时应用的版本”
    const { data: questionnaire, error: questionnaireError } = await supabase
        .from("coach_questionnaires")
        .select("id,questions,is_active,updated_at")
        .eq("coach_id", userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (questionnaireError) {
        console.error(questionnaireError);

        return NextResponse.json({
            success: false,
            message: "获取问卷失败",
            data: null,
        }, { status: 500 });
    }

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

    return NextResponse.json<ApiData<GetQuestionnairesResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: {
            id: questionnairesData.id,
            questionnaires: normalized,
        },
    });
}
