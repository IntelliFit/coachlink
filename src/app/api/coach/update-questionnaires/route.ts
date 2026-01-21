import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    CoachQuestionnairesInsert,
    UpdateQuestionnairesDto,
    UpdateQuestionnairesResponseDto,
} from "./entity";

function normalizeQuestions(questions: any[]): any[] {
    return (Array.isArray(questions) ? questions : []).map((q: any) => {
        if (typeof q === "string") {
            return { id: crypto.randomUUID(), type: "text", question: q };
        }
        if (!q || typeof q !== "object") return q;
        if (!q.id) return { ...q, id: crypto.randomUUID() };
        return q;
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

    const userId = session.user.id;

    const {
        id,
        questionnaires,
    } = await req.json() as UpdateQuestionnairesDto;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "教练不存在或无权限",
            data: null,
        }, { status: 404 });
    }

    const normalized = normalizeQuestions(questionnaires as any);

    if (id) {
        // 更新现有问卷
        const { data, error } = await supabase
            .from("coach_questionnaires")
            .update({
                questions: normalized as any,
            })
            .eq("id", id)
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
        const insertData: CoachQuestionnairesInsert = {
            coach_id: userId,
            questions: normalized as any,
        };

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
