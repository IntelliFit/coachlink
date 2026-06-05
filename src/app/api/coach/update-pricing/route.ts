import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { UpdatePricingDto, UpdatePricingResponseDto } from "./entity";

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
    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "教练不存在或无权限",
            data: null,
        }, { status: 404 });
    }

    const {
        products,
        pricings,
    } = await req.json() as UpdatePricingDto;

    // 向后兼容：如果传入的是旧版 pricings，执行旧的验证逻辑
    if (pricings && !products) {
        // 检查是否只有一个推荐项
        const recommendedCount = pricings.filter((tier: any) =>
            tier.is_recommend
        ).length;
        if (recommendedCount > 1) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: "只能有一个推荐档位",
                data: null,
            });
        }

        // 检查AI订阅计划
        const aiPlanCount = pricings.filter((tier: any) =>
            tier.is_ai_plan
        ).length;

        // 如果有AI订阅计划但不在第一个位置，返回错误
        if (aiPlanCount > 0 && !pricings[0].is_ai_plan) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: "AI订阅计划只能设置在第一个档位",
                data: null,
            });
        }

        // 如果有超过一个AI订阅计划，返回错误
        if (aiPlanCount > 1) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: "只能有一个AI订阅计划",
                data: null,
            });
        }
    }

    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, user_id, name, status, huifu_open_status, huifu_card_token")
        .eq("user_id", userId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: "教练不存在或无权限",
            data: null,
        }, { status: 404 });
    }

    // 检查是否已存在定价记录
    if (coach.huifu_open_status !== "opened" || !coach.huifu_card_token) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "请先完成收款账户开通和银行卡绑定，再设置订阅套餐价格。",
            data: null,
        }, { status: 403 });
    }

    const { data: existingPricing } = await supabase
        .from("coach_pricing")
        .select("id")
        .eq("coach_id", coach.id)
        .single();

    const updatePayload: any = {};
    if (products) updatePayload.products = products;
    if (pricings) updatePayload.pricings = pricings;

    if (existingPricing) {
        // 更新现有记录
        const { data, error } = await supabase
            .from("coach_pricing")
            .update(updatePayload)
            .eq("id", existingPricing.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: "更新定价信息失败: " + error.message,
                data: null,
            });
        }

        return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
            success: true,
            message: "定价信息保存成功",
            data: {
                pricing: data,
            },
        });
    } else {
        // 创建新记录
        const { data, error } = await supabase
            .from("coach_pricing")
            .insert({
                coach_id: coach.id,
                ...updatePayload,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: "创建定价信息失败: " + error.message,
                data: null,
            });
        }

        return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
            success: true,
            message: "定价信息保存成功",
            data: {
                pricing: data,
            },
        });
    }
}
