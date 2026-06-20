/**
 * 街健「数据社区」提交：体重 / 附加负重（kg）合理上限。
 * 用于过滤明显乱填；与 apps/wechat/src/utils/streetliftingSubmissionLimits.ts 保持数值一致。
 *
 * 取值说明：常人可验证范围；超过即拒绝提交。历史脏数据由迁移 SQL 清理。
 */
export const STREETLIFTING_MAX_BODYWEIGHT_KG = 250;
export const STREETLIFTING_MAX_ADDED_WEIGHT_KG = 250;

export function validateStreetliftingSubmissionWeights(
    bodyweight: number,
    addedWeight: number,
): { ok: true } | { ok: false; message: string } {
    if (!Number.isFinite(bodyweight) || bodyweight <= 0) {
        return { ok: false, message: "请填写有效体重" };
    }
    if (bodyweight > STREETLIFTING_MAX_BODYWEIGHT_KG) {
        return {
            ok: false,
            message: `体重不能超过 ${STREETLIFTING_MAX_BODYWEIGHT_KG} kg`,
        };
    }
    if (!Number.isFinite(addedWeight)) {
        return { ok: false, message: "请填写有效附加负重" };
    }
    if (addedWeight < 0) {
        return { ok: false, message: "附加负重不能为负数" };
    }
    if (addedWeight > STREETLIFTING_MAX_ADDED_WEIGHT_KG) {
        return {
            ok: false,
            message: `附加负重不能超过 ${STREETLIFTING_MAX_ADDED_WEIGHT_KG} kg`,
        };
    }
    return { ok: true };
}
