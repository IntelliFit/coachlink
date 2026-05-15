import { yuanToFen } from "@/lib/moneyUtils";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

type PricingTier = "basic" | "standard" | "vip";

interface DurationOptionLike {
    months?: unknown;
    price?: unknown;
    price_unit?: unknown;
    amount_unit?: unknown;
    is_recommend?: unknown;
}

interface ProductLike {
    id?: unknown;
    tier?: unknown;
    type?: unknown;
    name?: unknown;
    description?: unknown;
    included_products?: unknown;
    duration_options?: unknown;
}

export interface ResolvedCoachSubscriptionPricing {
    coachId: string;
    productId: string;
    productName: string;
    productTier: PricingTier;
    tier: number;
    durationMonths: number;
    purchasedWeeks: number;
    amountFen: number;
}

export function durationMonthsFromPurchasedWeeks(weeksValue: unknown): number {
    const weeks = Number(weeksValue);
    if (!Number.isFinite(weeks) || weeks <= 0 || !Number.isInteger(weeks)) {
        throw new Error("订阅时长无效，请重新选择套餐");
    }
    if (weeks % 4 !== 0) {
        throw new Error("订阅时长必须按整月购买，请重新选择套餐");
    }
    return weeks / 4;
}

function tierToNumber(tier: PricingTier): number {
    if (tier === "standard") return 2;
    if (tier === "vip") return 3;
    return 1;
}

function normalizeTier(value: unknown): PricingTier {
    const tier = String(value || "").toLowerCase();
    if (tier === "standard" || tier === "vip") return tier;
    return "basic";
}

function normalizeProducts(value: unknown): ProductLike[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object") as ProductLike[];
}

function priceToFen(option: DurationOptionLike): number {
    const rawPrice = Number(option.price);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
        throw new Error("套餐价格无效，请联系教练重新设置定价");
    }

    const explicitUnit = option.price_unit || option.amount_unit;
    const unit = String(explicitUnit || "yuan").toLowerCase();
    if (unit === "fen" || unit === "cent" || unit === "cents") {
        return Math.round(rawPrice);
    }

    if (!explicitUnit && Number.isInteger(rawPrice) && rawPrice >= 1000 && rawPrice % 100 === 0) {
        throw new Error("套餐价格单位不明确，请教练重新保存定价后再购买");
    }

    return yuanToFen(rawPrice);
}

export async function resolveCoachSubscriptionPricing(input: {
    coachId: string;
    productId?: string | null;
    purchasedWeeks?: number | null;
    durationMonths?: number | null;
}): Promise<ResolvedCoachSubscriptionPricing> {
    const coachId = String(input.coachId || "").trim();
    const productId = String(input.productId || "").trim();
    if (!coachId || !productId) {
        throw new Error("缺少套餐信息，请重新选择套餐");
    }

    const durationMonths = input.durationMonths
        ? Number(input.durationMonths)
        : durationMonthsFromPurchasedWeeks(input.purchasedWeeks);
    if (!Number.isFinite(durationMonths) || durationMonths <= 0 || !Number.isInteger(durationMonths)) {
        throw new Error("订阅时长无效，请重新选择套餐");
    }

    const { data, error } = await serviceRoleSupabase
        .from("coach_pricing")
        .select("products")
        .eq("coach_id", coachId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "读取教练定价失败");
    }

    const products = normalizeProducts((data as any)?.products);
    const product = products.find((item) => String(item.id || "") === productId);
    if (!product) {
        throw new Error("套餐已更新或不存在，请重新选择套餐");
    }

    const options = Array.isArray(product.duration_options)
        ? (product.duration_options as DurationOptionLike[])
        : [];
    const duration = options.find((option) => Number(option?.months) === durationMonths);
    if (!duration) {
        throw new Error("所选订阅时长已更新，请重新选择套餐");
    }

    const amountFen = priceToFen(duration);
    if (!Number.isFinite(amountFen) || amountFen <= 0) {
        throw new Error("套餐价格无效，请联系教练重新设置定价");
    }

    const productTier = normalizeTier(product.tier);
    return {
        coachId,
        productId,
        productName: String(product.name || "").trim(),
        productTier,
        tier: tierToNumber(productTier),
        durationMonths,
        purchasedWeeks: durationMonths * 4,
        amountFen,
    };
}
