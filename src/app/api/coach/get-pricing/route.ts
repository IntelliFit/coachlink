import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetPricingDto,
    GetPricingResponseDto,
    Pricing,
    Product,
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

    let {
        coachId = "",
        userId = "",
    } = await req.json() as GetPricingDto;

    if (userId && !coachId) {
        const { data: coach, error } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message,
            });
        }

        coachId = coach.id;
    }

    // 获取定价信息
    const { data, error } = await supabase
        .from("coach_pricing")
        .select("*")
        .eq("coach_id", coachId)
        .maybeSingle();

    if (error) {
        return NextResponse.json<ApiData<GetPricingResponseDto>>({
            success: false,
            message: "获取定价信息失败",
            data: null,
        });
    }

    // 如果是教练本人则返回缺省，否则返回空
    let defaultPricings = [] as Pricing[];
    let defaultProducts = [] as Product[];

    if (session.user.is_coach) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", coachId)
            .single();

        if (session.user.id === coach.user_id) {
            // 从数据库获取用户档案
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("nickname")
                .eq("user_id", session.user.id)
                .single();

            defaultPricings = [
                {
                    title: (profile?.nickname || "教练") + "的基础订阅计划",
                    price: 100,
                    features: [
                        "服务1",
                        "服务2",
                    ],
                    is_recommend: false,
                    is_ai_plan: false,
                },
            ];

            // 默认产品为空，让教练自己设置
            defaultProducts = [];
        }
    }

    const pricingData = (data as any) ?? {
        pricings: defaultPricings,
        products: defaultProducts,
    };

    return NextResponse.json<ApiData<GetPricingResponseDto>>({
        success: true,
        message: "获取定价信息成功",
        data: {
            // 新版数据结构
            products: (pricingData.products as Product[]) || [],
            // 向后兼容旧版
            pricings: (pricingData.pricings as Pricing[]) || [],
        },
    });
}
