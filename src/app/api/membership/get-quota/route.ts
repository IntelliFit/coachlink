import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { ApiData } from "@/types/api";
import { StudentQuota } from "@/app/service/studentMembershipService";
import { getOrInitStudentQuota } from "@/lib/membershipLimit";

async function handle(request: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const { userId } = request.method === "GET" ? { userId: undefined } : await request.json().catch(() => ({}));
    const targetUserId = userId || authResult.userId;

    let result: StudentQuota;
    try {
        result = await getOrInitStudentQuota(targetUserId) as StudentQuota;
    } catch (error) {
        console.error("Error fetching quota:", error);
        return NextResponse.json({
            success: false,
            message: "获取配额信息失败",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<StudentQuota>>({
        success: true,
        message: "获取配额信息成功",
        data: result,
    });
}

export async function GET(request: Request) {
    return handle(request);
}

export async function POST(request: Request) {
    return handle(request);
}
