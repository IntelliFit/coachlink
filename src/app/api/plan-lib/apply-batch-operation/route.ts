import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

/**
 * 应用批量操作的修改到数据库
 */
export async function POST(req: NextRequest) {
    // 验证用户身份
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId || !session.user.is_coach) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const body = await req.json();
        const { templateId, updatedTrainingDays } = body;

        if (!templateId || !updatedTrainingDays) {
            return NextResponse.json(
                { success: false, message: "缺少必要参数" },
                { status: 400 }
            );
        }

        // 更新数据库
        const { error: updateError } = await supabase
            .from('coach_plan_templates')
            .update({ training_days: updatedTrainingDays })
            .eq('id', templateId)
            .eq('coach_id', userId);

        if (updateError) {
            throw new Error('保存失败: ' + updateError.message);
        }

        return NextResponse.json({
            success: true,
            message: '修改已应用'
        });

    } catch (error: any) {
        console.error('[apply-batch-operation] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message || '应用修改失败' },
            { status: 500 }
        );
    }
}
