import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Database, Json } from "@/types/database.types";

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Update student's questionnaire answers (subscribe_data)
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const { subscriptionId, subscribeData } = await request.json();

        if (!subscriptionId || !subscribeData) {
            return NextResponse.json(
                { error: "缺少必要参数" },
                { status: 400 },
            );
        }

        // 验证调用者是该订阅的教练
        const { data: subscription, error: fetchError } = await supabase
            .from("coach_subscriptions")
            .select("coach_id")
            .eq("id", subscriptionId)
            .single();

        if (fetchError || !subscription) {
            return NextResponse.json(
                { error: "订阅不存在" },
                { status: 404 },
            );
        }

        // 获取教练信息
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", subscription.coach_id)
            .single();

        if (!coach || coach.user_id !== session.user.id) {
            return NextResponse.json(
                { error: "无权限修改此订阅" },
                { status: 403 },
            );
        }

        // 更新 subscribe_data
        const { data: updatedSubscription, error: updateError } = await supabase
            .from("coach_subscriptions")
            .update({
                subscribe_data: subscribeData as unknown as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", subscriptionId)
            .select()
            .single();

        if (updateError) {
            console.error("更新问卷数据失败:", updateError);
            return NextResponse.json(
                { error: "更新失败" },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            subscription: updatedSubscription,
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: "服务器内部错误" },
            { status: 500 },
        );
    }
}
