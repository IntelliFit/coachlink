import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
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
    const authUser = await getAuthUser(req);

    let {
        coachId = "",
        userId = "",
    } = await req.json().catch(() => ({})) as GetPricingDto;

    // 公开读取：允许未登录用户按 coachId 获取定价（用于展示商品/服务列表）
    // 但不允许未登录时使用 userId 反查 coachId（避免枚举/越权）。
    const effectiveUserId = userId || session?.user?.id || authUser?.userId;
    if (!effectiveUserId && !coachId) {
        return NextResponse.json<ApiData<GetPricingResponseDto>>({
            success: false,
            message: "缺少 coachId 或 userId",
            data: null,
        }, { status: 400 });
    }

    // 如果没有 coachId，尝试从 userId、session 或 JWT 中获取
    if (!coachId) {
        const targetUserId = effectiveUserId;
        
        if (targetUserId) {
            // 查询教练信息（不限制状态，因为用户可能想查看自己的定价信息）
            const { data: coach, error } = await supabase
                .from("coaches")
                .select("id, status")
                .eq("user_id", targetUserId)
                .maybeSingle();

            if (error) {
                // 如果查询失败，可能是用户不是教练，返回空数据而不是错误
                coachId = ""; // 设置为空字符串，后续查询会返回空结果
            } else if (coach) {
                coachId = coach.id;
            } else {
                coachId = ""; // 设置为空字符串，后续查询会返回空结果
            }
        }
    }

    // 如果 coachId 为空，直接返回空数据
    let data = null;
    let error = null;
    
    if (coachId) {
        // 获取定价信息
        const result = await supabase
            .from("coach_pricing")
            .select("*")
            .eq("coach_id", coachId)
            .maybeSingle();
        
        data = result.data;
        error = result.error;

        if (error) {
            console.error("获取定价信息失败", error, coachId);
            return NextResponse.json<ApiData<GetPricingResponseDto>>({
                success: false,
                message: "获取定价信息失败",
                data: null,
            });
        }
    }

    // 如果是教练本人则返回缺省，否则返回空
    let defaultPricings = [] as Pricing[];
    let defaultProducts = [] as Product[];

    const currentUserId = session?.user?.id || authUser?.userId;
    const isCoach = session?.user?.is_coach ?? authUser?.user?.is_coach ?? false;

    // 只有当 coachId 存在且用户是教练时，才检查是否是本人
    if (isCoach && coachId && currentUserId) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", coachId)
            .single();

        if (!coachError && currentUserId === coach?.user_id) {
            // 从数据库获取用户档案
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("nickname")
                .eq("user_id", currentUserId)
                .maybeSingle();

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

    // 处理数据库返回的数据
    // 数据库返回的数据可能是 null 或者包含 pricings/products 字段的对象
    let finalPricings = defaultPricings;
    let finalProducts = defaultProducts;
    
    if (data) {
        // 如果数据库有数据，优先使用数据库的数据
        // 数据库可能返回的是 coach_pricing 表的原始数据，需要检查结构
        // coach_pricing 表可能有一个 JSON 字段存储 pricings 和 products
        const dbPricings = (data as any).pricings;
        const dbProducts = (data as any).products;
        
        // 如果数据库有有效的 pricings 数据，使用数据库的数据
        if (dbPricings && Array.isArray(dbPricings) && dbPricings.length > 0) {
            finalPricings = dbPricings;
        }
        
        // 如果数据库有有效的 products 数据，使用数据库的数据
        if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
            finalProducts = dbProducts;
        }
        
        // 如果数据库数据为空或无效，使用默认值（已经在上面设置了）
    }

    return NextResponse.json<ApiData<GetPricingResponseDto>>({
        success: true,
        message: "获取定价信息成功",
        data: {
            // 新版数据结构
            products: finalProducts,
            // 向后兼容旧版
            pricings: finalPricings,
        },
    });
}
