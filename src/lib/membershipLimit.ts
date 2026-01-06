import { serviceRoleSupabase as supabase } from "./supabaseClient";
import { MEMBER_BENEFITS } from "@/app/service/studentMembershipService";
import { isBefore, startOfMonth } from "date-fns";

export interface QuotaCheckResult {
    success: boolean;
    remaining: number;
    message?: string;
}

/**
 * Checks if a user has sufficient AI quota and deducts it.
 * Implements "Lazy Reset" logic: if the quota hasn't been reset this month,
 * it resets it based on the user's current membership tier before checking/deducting.
 *
 * @param userId - The user ID to check
 * @param count - Number of quota points to consume (default 1)
 * @returns Object indicating success/failure and remaining balance
 */
export async function checkAndConsumeAiQuota(
    userId: string,
    count: number = 1,
): Promise<QuotaCheckResult> {
    // 1. Get Quota and Membership
    const { data: quota, error: quotaError } = await supabase
        .from("student_quotas")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (quotaError) {
        console.error(
            `[Quota] Failed to fetch quota for user ${userId}`,
            quotaError,
        );
        // Fallback: If quota doesn't exist, try to initialize it?
        // Or fail safe. Let's fail safe for now.
        return {
            success: false,
            remaining: 0,
            message: "无法获取配额信息",
        };
    }

    const { data: membership } = await supabase
        .from("student_memberships")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    const currentTier =
        (membership?.tier || "free") as keyof typeof MEMBER_BENEFITS;
    const tierBenefits = MEMBER_BENEFITS[currentTier] ||
        MEMBER_BENEFITS["free"];

    // 2. CHECK FOR LAZY RESET
    const lastReset = quota.last_reset_date
        ? new Date(quota.last_reset_date)
        : new Date(0);
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);

    let currentBalance = quota.ai_import_balance;

    // If last reset was before the start of this month, we need to reset
    if (isBefore(lastReset, startOfCurrentMonth)) {
        console.log(
            `[Quota] Resetting monthly quota for user ${userId}. Tier: ${currentTier}`,
        );

        // Reset Logic:
        // Set balance to the monthly limit.
        // Note: usage is tracked by deducting. So balance = limit.
        currentBalance = tierBenefits.ai_limit_monthly;

        // Perform the reset update
        const { error: resetError } = await supabase
            .from("student_quotas")
            .update({
                ai_import_balance: currentBalance,
                last_reset_date: now.toISOString(),
            })
            .eq("user_id", userId);

        if (resetError) {
            console.error(
                `[Quota] Failed to reset quota for user ${userId}`,
                resetError,
            );
            return {
                success: false,
                remaining: currentBalance,
                message: "配额重置失败",
            };
        }
    }

    // 3. CHECK BALANCE
    if (currentBalance >= count) {
        // Deduct
        const { error: updateError } = await supabase
            .from("student_quotas")
            .update({
                ai_import_balance: currentBalance - count,
            })
            .eq("user_id", userId);

        if (updateError) {
            console.error(
                `[Quota] Failed to deduct quota for user ${userId}`,
                updateError,
            );
            return {
                success: false,
                remaining: currentBalance,
                message: "扣除配额失败",
            };
        }

        return {
            success: true,
            remaining: currentBalance - count,
            message: "配额扣除成功",
        };
    } else {
        return {
            success: false,
            remaining: currentBalance,
            message: "配额不足，请升级会员或购买加油包",
        };
    }
}

/**
 * Checks if a user has sufficient storage space.
 *
 * @param userId - The user ID to check
 * @param fileSizeBytes - Size of the file to be uploaded in bytes
 * @returns Object indicating success/failure
 */
export async function checkStorageAvailable(
    userId: string,
    fileSizeBytes: number,
): Promise<{ success: boolean; message?: string }> {
    const { data: quota, error } = await supabase
        .from("student_quotas")
        .select("storage_used_mb, storage_total_mb")
        .eq("user_id", userId)
        .single();

    if (error || !quota) {
        // Fail safe: allow if we can't check? Or block? Block is safer for business.
        // But if user has no quota record, they might be new.
        // Let's assume free tier defaults if no record found (which shouldn't happen if fulfillment worked).
        // For now, return false.
        console.error(
            `[Storage] Failed to fetch quota for user ${userId}`,
            error,
        );
        return { success: false, message: "无法获取存储配额信息" };
    }

    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    const newUsage = quota.storage_used_mb + fileSizeMB;

    if (newUsage > quota.storage_total_mb) {
        return {
            success: false,
            message: `存储空间不足 (剩余 ${
                (quota.storage_total_mb - quota.storage_used_mb).toFixed(1)
            } MB, 需要 ${fileSizeMB.toFixed(1)} MB)`,
        };
    }

    return { success: true };
}

/**
 * Increments the used storage for a user.
 */
export async function incrementStorageUsage(
    userId: string,
    fileSizeBytes: number,
) {
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    console.log(
        `[Storage] Incrementing usage for user ${userId} by ${
            fileSizeMB.toFixed(2)
        } MB`,
    );

    const { data: quota, error: fetchError } = await supabase
        .from("student_quotas")
        .select("storage_used_mb")
        .eq("user_id", userId)
        .single();

    if (fetchError) {
        console.error(
            `[Storage] Failed to fetch quota for user ${userId}`,
            fetchError,
        );
        throw fetchError;
    }

    if (!quota) {
        console.warn(
            `[Storage] No quota record found for user ${userId}. Cannot increment.`,
        );
        return;
    }

    const newUsage = Math.round((quota.storage_used_mb + fileSizeMB) * 100) /
        100; // Round to 2 decimal places
    console.log(
        `[Storage] Current usage for user ${userId}: ${quota.storage_used_mb} MB. Adding ${
            fileSizeMB.toFixed(2)
        } MB. New total: ${newUsage} MB.`,
    );

    const { error } = await supabase
        .from("student_quotas")
        .update({
            storage_used_mb: newUsage,
        })
        .eq("user_id", userId);

    if (error) {
        console.error(
            `[Storage] Failed to increment usage for user ${userId}`,
            error,
        );
        throw error;
    }
    console.log(`[Storage] Successfully updated usage for user ${userId}.`);
}
