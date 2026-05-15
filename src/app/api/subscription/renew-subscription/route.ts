import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { RenewSubscriptionResponseDto } from "./entity";

export async function POST() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>(
            {
                success: false,
                message: "用户未登录",
                data: null,
            },
            { status: 401 },
        );
    }

    return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>(
        {
            success: false,
            message: "直接续费接口已停用，请通过支付续费流程创建付款订单并等待支付回调生效",
            data: null,
        },
        { status: 410 },
    );
}
