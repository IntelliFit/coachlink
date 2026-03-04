import supabase from "@/lib/supabaseClient";
import { addDays, addMonths } from "date-fns";

export class FulfillmentService {
    /**
     * Process a paid order and update user assets (Membership or Quota)
     */
    async fulfillOrder(orderId: string, productKey: string, userId: string) {
        console.log(
            `[Fulfillment] Processing order ${orderId} for user ${userId} with product ${productKey}`,
        );

        // 1. Memberships
        if (
            productKey.includes("monthly_basic") ||
            productKey.includes("monthly_premium")
        ) {
            await this.fulfillMembership(userId, productKey);
        } // 2. Add-on Packs
        else if (
            productKey.includes("ai_pack") ||
            productKey.includes("storage_pack")
        ) {
            await this.fulfillAddon(userId, productKey);
        }

        console.log(`[Fulfillment] Order ${orderId} fulfilled successfully`);
    }

    private async fulfillMembership(userId: string, productKey: string) {
        const targetTier = productKey.includes("premium") ? "premium" : "basic";
        // Basic: 30 days, Premium: 30 days.
        // Logic: extend if active & same tier, otherwise reset/upgrade.

        type MembershipRow = {
            status: string;
            end_date: string | null;
            start_date: string;
            tier: string;
        };
        const { data } = await (supabase
            .from("student_memberships" as any)
            .select("*")
            .eq("user_id", userId)
            .maybeSingle());
        const current = data as unknown as MembershipRow | null;

        let newStartDate = new Date();
        let newEndDate = addDays(new Date(), 30); // Default 30 days

        if (
            current && current.status === "active" && current.end_date &&
            current.end_date !== null
        ) {
            const currentEndDate = new Date(current.end_date);
            if (current.tier === targetTier) {
                // Same tier, extend duration
                // If not expired, add to end_date. If expired, add to now?
                // Usually check if currentEndDate > now
                if (currentEndDate > new Date()) {
                    newStartDate = new Date(current.start_date); // Keep original start
                    newEndDate = addDays(currentEndDate, 30);
                }
            } else {
                // Upgrade/Downgrade: For MVP, we just overwrite tier and set 30 days from NOW.
                // Refinements can be added later (prorating etc)
            }
        }

        console.log(
            `[Fulfillment] Upserting membership for user ${userId}, tier ${targetTier}`,
        );
        const { error, data: upsertResult } = await (supabase
            .from("student_memberships" as any)
            .upsert({
                user_id: userId,
                tier: targetTier,
                start_date: newStartDate.toISOString(),
                end_date: newEndDate.toISOString(),
                status: "active",
            }, { onConflict: "user_id" })
            .select());

        console.log(
            `[Fulfillment] Upsert result:`,
            upsertResult,
            `Error:`,
            error,
        );

        if (error) {
            throw new Error(`Failed to upsert membership: ${error.message}`);
        }

        // 3. Update Quota based on tier
        await this.applyTierQuota(userId, targetTier);
    }

    private async applyTierQuota(userId: string, tier: string) {
        const tierQuotas: Record<string, { ai: number; storage: number }> = {
            "free": { ai: 2, storage: 200 }, // 200MB for free
            "basic": { ai: 10, storage: 1024 }, // 1GB
            "premium": { ai: 9999, storage: 5120 }, // 5GB
        };

        const q = tierQuotas[tier] || tierQuotas["free"];

        // We use upsert for quota to ensure it exists
        const { error } = await (supabase
            .from("student_quotas" as any)
            .upsert({
                user_id: userId,
                ai_import_balance: q.ai,
                storage_total_mb: q.storage,
                // We keep storage_used_mb as is
            }, { onConflict: "user_id" }));

        if (error) {
            console.error(
                `[Fulfillment] Failed to update quota for tier ${tier}:`,
                error,
            );
        }
    }

    private async fulfillAddon(userId: string, productKey: string) {
        // Fetch current quota to ensure row exists
        type QuotaRow = { ai_import_balance: number; storage_total_mb: number };

        let { data } = await (supabase
            .from("student_quotas" as any)
            .select("*")
            .eq("user_id", userId)
            .maybeSingle());
        let quota = data as unknown as QuotaRow | null;

        if (!quota) {
            // Create if not exists
            const { data: newQuota, error: createError } = await (supabase
                .from("student_quotas" as any)
                .insert({
                    user_id: userId,
                    ai_import_balance: 0,
                    storage_total_mb: 500,
                    storage_used_mb: 0,
                }) // Default free limits
                .select()
                .single());

            if (createError) {
                throw new Error(`Failed to init quota: ${createError.message}`);
            }
            quota = newQuota as unknown as QuotaRow;
        }

        const updates: any = {};

        if (productKey === "ai_pack_basic") {
            updates.ai_import_balance = (quota.ai_import_balance || 0) + 3; // +3 AI chances
        } else if (productKey === "storage_pack_basic") {
            updates.storage_total_mb = (quota.storage_total_mb || 0) + 1024; // +1GB
        }

        const { error } = await (supabase
            .from("student_quotas" as any)
            .update(updates)
            .eq("user_id", userId));

        if (error) throw new Error(`Failed to update quota: ${error.message}`);
    }
}

export const fulfillmentService = new FulfillmentService();
