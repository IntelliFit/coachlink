import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    CoachQuestionnairesInsert,
    UpdateQuestionnairesDto,
    UpdateQuestionnairesResponseDto,
} from "./entity";

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

    if (id) {
        // 更新现有问卷
        const { data, error } = await supabase
            .from("coach_questionnaires")
            .update({
                questions: questionnaires as any,
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
            questions: questionnaires as any,
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
