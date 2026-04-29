import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fulfillmentService } from "@/app/service/fulfillmentService";

/**
 * 幂等履约学生会员订单。
 *
 * 只有第一次把 student_membership_orders.status 从 pending 改成 paid 的请求
 * 才会继续发放会员/加油包权益，避免 notify / query 并发导致重复到账。
 */
export async function fulfillStudentMembershipOrderOnPaid(params: {
    relatedOrderId: string;
    productKey: string;
    userId: string;
}) {
    const { relatedOrderId, productKey, userId } = params;

    if (!relatedOrderId || !productKey || !userId) return;

    const { data: updatedOrder, error } = await (serviceRoleSupabase
        .from("student_membership_orders" as any)
        .update({
            status: "paid",
            paid_at: new Date().toISOString(),
        })
        .eq("id", relatedOrderId)
        .eq("status", "pending")
        .select()
        .maybeSingle());

    if (error) {
        throw new Error(`更新会员订单状态失败: ${error.message}`);
    }

    // 说明此前已经处理过，直接视为幂等成功。
    if (!updatedOrder) return;

    await fulfillmentService.fulfillOrder(relatedOrderId, productKey, userId);
}
