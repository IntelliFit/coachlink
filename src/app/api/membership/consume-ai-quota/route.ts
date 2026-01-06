import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { checkAndConsumeAiQuota } from "@/lib/membershipLimit";

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const { count = 1 } = await request.json();
    const userId = session.user.id;

    const result = await checkAndConsumeAiQuota(userId, count);

    return NextResponse.json({
        success: result.success,
        message: result.message,
        data: {
            success: result.success,
            remaining: result.remaining,
        },
    }, { status: result.success ? 200 : 403 });
}
