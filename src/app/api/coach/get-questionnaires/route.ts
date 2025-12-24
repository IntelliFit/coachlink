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

    // 默认问题列表：包含用户极限（1RM）问题
    const defaultQuestions = [
        { type: "tags" }, // 训练项目偏好
        { type: "times" }, // 每周训练次数
        { type: "rm" }, // 用户极限（1RM）
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
