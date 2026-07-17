import { serviceRoleSupabase as supabase } from "./supabaseClient";
import { MEMBER_BENEFITS } from "@/app/service/studentMembershipService";
import { isBefore, startOfMonth } from "date-fns";
import {
    COACH_SUBSCRIPTION_TRAINING_VIDEO_STORAGE_MB,
    DEFAULT_TRAINING_VIDEO_STORAGE_MB,
} from "@/lib/trainingVideoLimits";

export interface QuotaCheckResult {
    success: boolean;
    remaining: number;
    message?: string;
}

async function getStorageEntitlementMb(userId: string) {
    const [{ data: membership, error: membershipError }, { data: coachSubscription, error: subscriptionError }] = await Promise.all([
        supabase
            .from("student_memberships")
            .select("tier")
            .eq("user_id", userId)
            .maybeSingle(),
        supabase
            .from("coach_subscriptions")
            .select("id")
            .eq("student_id", userId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle(),
    ]);

    if (membershipError) throw membershipError;
    if (subscriptionError) throw subscriptionError;

    const membershipTier = (membership?.tier || "free") as keyof typeof MEMBER_BENEFITS;
    const membershipStorageMb =
        MEMBER_BENEFITS[membershipTier]?.storage_mb || DEFAULT_TRAINING_VIDEO_STORAGE_MB;
    const coachSubscriptionStorageMb = coachSubscription
        ? COACH_SUBSCRIPTION_TRAINING_VIDEO_STORAGE_MB
        : DEFAULT_TRAINING_VIDEO_STORAGE_MB;

    return Math.max(membershipStorageMb, coachSubscriptionStorageMb);
}

export async function getOrInitStudentQuota(userId: string) {
    // 1) Try fetch existing quota row
    const { data: existing, error: fetchError } = await supabase
        .from("student_quotas")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (fetchError) {
        console.error(`[Quota] Failed to fetch quota for user ${userId}`, fetchError);
        throw fetchError;
    }

    if (existing) {
        // Repair legacy/bad data: storage_total_mb or ai_import_balance might be null/0 from earlier versions
        const storageEntitlementMb = await getStorageEntitlementMb(userId);

        const patch: Record<string, any> = {};
        // storage_total_mb: should never be null/0 for usable tiers (free should be 200MB)
        if (
            existing.storage_total_mb === null ||
            existing.storage_total_mb === undefined ||
            existing.storage_total_mb <= 0
        ) {
            patch.storage_total_mb = storageEntitlementMb;
        } else if (existing.storage_total_mb < storageEntitlementMb) {
            // An active coach subscription raises the total training-video storage to 1GB.
            patch.storage_total_mb = storageEntitlementMb;
        }
        // storage_used_mb: normalize null to 0
        if (existing.storage_used_mb === null || existing.storage_used_mb === undefined) {
            patch.storage_used_mb = 0;
        }
        // ai_import_balance: only repair null/undefined (0 may mean used up)
        if (existing.ai_import_balance === null || existing.ai_import_balance === undefined) {
            patch.ai_import_balance = tierBenefits.ai_limit_monthly;
            patch.last_reset_date = new Date().toISOString();
        }

        if (Object.keys(patch).length > 0) {
            const { data: updated, error: updateError } = await supabase
                .from("student_quotas")
                .update(patch as any)
                .eq("user_id", userId)
                .select("*")
                .single();
            if (!updateError && updated) return updated;
            console.warn(
                `[Quota] Failed to repair quota row for user ${userId}`,
                updateError,
            );
        }

        return existing;
    }

    // 2) No quota row -> initialize by membership tier (default free)
    const storageEntitlementMb = await getStorageEntitlementMb(userId);
    const { data: membership } = await supabase
        .from("student_memberships")
        .select("tier")
        .eq("user_id", userId)
        .maybeSingle();
    const currentTier = (membership?.tier || "free") as keyof typeof MEMBER_BENEFITS;
    const tierBenefits = MEMBER_BENEFITS[currentTier] || MEMBER_BENEFITS["free"];

    const now = new Date();
    const initRow = {
        user_id: userId,
        ai_import_balance: tierBenefits.ai_limit_monthly,
        storage_total_mb: storageEntitlementMb,
        storage_used_mb: 0,
        last_reset_date: now.toISOString(),
    };

    // Insert; if a race creates the row first, re-fetch.
    const { data: inserted, error: insertError } = await supabase
        .from("student_quotas")
        .insert(initRow as any)
        .select("*")
        .single();

    if (insertError) {
        console.warn(
            `[Quota] Failed to insert quota row for user ${userId}, retrying fetch`,
            insertError,
        );
        const { data: retry, error: retryError } = await supabase
            .from("student_quotas")
            .select("*")
            .eq("user_id", userId)
            .single();
        if (retryError) throw retryError;
        return retry;
    }

    return inserted;
}

/**
 * Checks if a user has sufficient smart generation quota and deducts it.
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
    // 1. Get or init quota row
    let quota: any;
    try {
        quota = await getOrInitStudentQuota(userId);
    } catch (quotaError) {
        console.error(`[Quota] Failed to get/init quota for user ${userId}`, quotaError);
        return { success: false, remaining: 0, message: "无法获取配额信息" };
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
    let quota: any;
    try {
        quota = await getOrInitStudentQuota(userId);
    } catch (error) {
        console.error(`[Storage] Failed to get/init quota for user ${userId}`, error);
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

    const quota: any = await getOrInitStudentQuota(userId);

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
