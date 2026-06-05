import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { GetPaymentQrCodesResponseDto } from "./entity";

export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    return NextResponse.json<ApiData<GetPaymentQrCodesResponseDto>>({
        success: true,
        message: "个人收款码已停用，教练收款统一通过汇付账户",
        data: {
            qrCodes: [],
            allowPersonalQrcode: false,
        },
    });
}

export async function POST() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    return NextResponse.json<ApiData<null>>({
        success: false,
        message: "个人收款码已停用，学员给教练的付款请走汇付平台支付",
        data: null,
    }, { status: 410 });
}
