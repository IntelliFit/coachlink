import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    GetQuestionnairesDto,
    GetQuestionnairesResponseDto,
} from "./entity";
import { TrainingItem } from "@/types/questionnaires";

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

    // 获取问卷数据
    const { data: questionnaire, error: questionnaireError } = await supabase
        .from("coach_questionnaires")
        .select("id,questions")
        .eq("coach_id", userId)
        .maybeSingle();

    if (questionnaireError) {
        console.error(questionnaireError);

        return NextResponse.json({
            success: false,
            message: "获取问卷失败",
            data: null,
        }, { status: 500 });
    }

    // 默认训练项目选项库：来自 training_items（避免误用模板 tags）
    let defaultTrainingItemNames: string[] = [];
    try {
        const { data: trainingItems, error: trainingItemsError } = await supabase
            .from("training_items")
            .select("name")
            .order("name");
        if (!trainingItemsError && Array.isArray(trainingItems)) {
            defaultTrainingItemNames = trainingItems.map((it: any) => String(it.name)).filter(Boolean);
        }
    } catch (e) {
        // ignore and fall back to static
    }

    // 默认问题列表：包含用户极限（1RM）问题
    const defaultQuestions = [
        {
            type: "tags",
            // 默认训练项目选项库：来自 training_items（若为空则给一个兜底）
            options: defaultTrainingItemNames.length > 0
                ? defaultTrainingItemNames
                : ["胸", "背", "腿", "肩", "手臂", "核心", "全身", "体能", "灵活性", "康复/矫正"],
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

    return NextResponse.json<ApiData<GetQuestionnairesResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: {
            id: questionnairesData.id,
            questionnaires: questionnairesData
                .questions as unknown as TrainingItem[],
        },
    });
}
