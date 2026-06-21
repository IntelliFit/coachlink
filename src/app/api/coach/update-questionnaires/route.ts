import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import type { ApiData } from "@/types/api";
import type { QuestionnaireDocument, QuestionnaireEditorType } from "@/types/questionnaires";
import { ensureQuestionIds } from "@/lib/questionnaireDocument";
import type {
    CoachQuestionnairesInsert,
    UpdateQuestionnairesDto,
    UpdateQuestionnairesResponseDto,
} from "./entity";

function buildQuestionnaireDocument(
    questions: any[],
    editorType?: QuestionnaireEditorType,
): QuestionnaireDocument {
    const { normalized } = ensureQuestionIds(Array.isArray(questions) ? questions : []);
    const inferredType = normalized.some((item: any) => item?.branching || item?.next)
        ? "flow"
        : "simple";

    return {
        editorType: editorType === "flow" ? "flow" : (editorType === "simple" ? "simple" : inferredType),
        questions: normalized,
    };
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    if (!authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = authResult.userId;

    const {
        id,
        name,
        editorType,
        questionnaires,
    } = await req.json() as UpdateQuestionnairesDto;

    if (authResult.user?.is_coach !== true) {
        return NextResponse.json({
            success: false,
            message: "教练不存在或无权限",
            data: null,
        }, { status: 404 });
    }

    const document = buildQuestionnaireDocument(questionnaires as any, editorType);
    const fallbackName = document.editorType === "flow" ? "流程图问卷" : "列表问卷";

    if (id) {
        // 编辑现有问卷：仅更新内容；status 由 publish 接口翻转
        const updatePayload: Record<string, any> = {
            questions: document as any,
            name: name?.trim() || undefined,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from("coach_questionnaires")
            .update(updatePayload)
            .eq("id", id)
            .eq("coach_id", userId)
            .select()
            .single();

        if (error) {
            console.error("更新问卷失败:", error);
            return NextResponse.json({
                success: false,
                message: `更新问卷失败: ${error.message}`,
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<UpdateQuestionnairesResponseDto>>({
            success: true,
            message: "问卷更新成功",
            data: {
                id: data.id,
            },
        });
    } else {
        // 新建问卷固定为草稿；上线由 publish 接口处理
        const insertData: CoachQuestionnairesInsert = {
            coach_id: userId,
            name: name?.trim() || fallbackName,
            questions: document as any,
            status: "draft",
        } as any;

        const { data, error } = await supabase
            .from("coach_questionnaires")
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error("创建问卷失败:", error);
            return NextResponse.json({
                success: false,
                message: `创建问卷失败: ${error.message}`,
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<UpdateQuestionnairesResponseDto>>({
            success: true,
            message: "问卷创建成功",
            data: {
                id: data.id,
            },
        });
    }
}
