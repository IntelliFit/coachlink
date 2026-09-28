import { getMotionEffectPrices } from "@/app/api/toolbox/motion-effects/_commerce";

export interface WechatXPayGoods {
    id: string;
    name: string;
    price: number;
    remark: string;
    item_url: string;
}

const ITEM_URL = "https://coachlink.fit/coachlink.jpg";

const MEMBERSHIP_PRODUCTS: Record<string, { price: number; name: string; prefix: string }> = {
    monthly_basic: { price: 1990, name: "CoachLink基础月卡", prefix: "m_basic" },
    monthly_premium: { price: 3990, name: "CoachLink高级月卡", prefix: "m_premium" },
    ai_pack_basic: { price: 200, name: "AI导入加油包", prefix: "ai_pack" },
    storage_pack_basic: { price: 990, name: "存储扩容包", prefix: "storage" },
};

function createPricedProductId(prefix: string, priceFen: number) {
    const id = `${prefix}_${priceFen}`;
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) {
        throw new Error(`虚拟支付商品 ID 不合法：${id}`);
    }
    return id;
}

export function getMembershipXPayProduct(productKey: string, priceFen?: number) {
    const product = MEMBERSHIP_PRODUCTS[productKey];
    if (!product) return null;
    const resolvedPrice = priceFen == null ? product.price : Math.round(Number(priceFen));
    if (!Number.isSafeInteger(resolvedPrice) || resolvedPrice <= 0) {
        throw new Error("会员虚拟支付金额无效");
    }
    return {
        productKey,
        productId: createPricedProductId(product.prefix, resolvedPrice),
        priceFen: resolvedPrice,
        name: product.name,
    };
}

export function getMotionEffectXPayProduct(priceFen: number) {
    const normalized = Math.round(Number(priceFen));
    if (!Number.isSafeInteger(normalized) || normalized < 100) {
        throw new Error("动作特效虚拟支付金额不能低于 1 元");
    }
    return {
        productId: createPricedProductId("motion_p", normalized),
        priceFen: normalized,
        name: "动作特效导出",
    };
}

export function getFixedWechatXPayGoods(): WechatXPayGoods[] {
    const membership = Object.keys(MEMBERSHIP_PRODUCTS).map((productKey) => {
        const product = getMembershipXPayProduct(productKey)!;
        return {
            id: product.productId,
            name: product.name,
            price: product.priceFen,
            remark: `CoachLink 小程序虚拟商品：${product.name}`,
            item_url: ITEM_URL,
        };
    });

    const prices = getMotionEffectPrices();
    const motionPrices = Array.from(new Set([
        prices.standardCents,
        prices.hdCents,
        prices.standardCents + prices.priorityAddonCents,
        prices.hdCents + prices.priorityAddonCents,
    ]));
    const motion = motionPrices.map((priceFen) => {
        const product = getMotionEffectXPayProduct(priceFen);
        return {
            id: product.productId,
            name: product.name,
            price: product.priceFen,
            remark: "CoachLink 动作特效数字内容导出服务",
            item_url: ITEM_URL,
        };
    });

    return [...membership, ...motion];
}
