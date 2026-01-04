import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetCoachPaymentSettingsDto,
    GetCoachPaymentSettingsResponseDto,
    UpdateCoachPaymentSettingsDto,
    UpdateCoachPaymentSettingsResponseDto,
} from "./entity";

// 获取教练支付设置
export async function GET(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.is_admin) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "需要管理员权限",
            data: null,
        }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get("coachId");

    if (!coachId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少 coachId 参数",
            data: null,
        }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("coaches")
        .select(
            "id, name, payment_mode, allow_personal_qrcode, payment_qr_codes",
        )
        .eq("id", coachId)
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetCoachPaymentSettingsResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            coach: data,
        },
    });
}

// 更新教练支付设置
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.is_admin) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "需要管理员权限",
            data: null,
        }, { status: 403 });
    }

    const {
        coachId,
        paymentMode,
        allowPersonalQrcode,
    } = await req.json() as UpdateCoachPaymentSettingsDto;

    if (!coachId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少 coachId 参数",
            data: null,
        }, { status: 400 });
    }

    // 构建更新对象
    const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };

    if (paymentMode !== undefined) {
        updateData.payment_mode = paymentMode;
    }

    if (allowPersonalQrcode !== undefined) {
        updateData.allow_personal_qrcode = allowPersonalQrcode;
    }

    const { data, error } = await supabase
        .from("coaches")
        .update(updateData)
        .eq("id", coachId)
        .select("id, payment_mode, allow_personal_qrcode")
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateCoachPaymentSettingsResponseDto>>({
        success: true,
        message: "更新成功",
        data: {
            coach: data,
        },
    });
}
