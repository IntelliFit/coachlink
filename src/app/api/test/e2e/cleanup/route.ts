import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

type CleanupTarget = {
  subscriptionId?: string | null;
  instanceId?: string | null;
  coachId?: string | null;
  coachUserId?: string | null;
  studentUserId?: string | null;
};

function assertE2EAllowed(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    return { ok: false as const, message: "E2E cleanup only allowed in development/test" };
  }
  const secret = process.env.E2E_SECRET;
  // Local dev convenience: if E2E_SECRET is not set, allow cleanup (dev only).
  if (secret) {
    const provided = req.headers.get("x-e2e-secret");
    if (provided !== secret) return { ok: false as const, message: "Invalid e2e secret" };
  }
  return { ok: true as const };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function deleteByIn(table: string, column: string, values: string[]) {
  if (values.length === 0) return;
  const { error } = await (serviceRoleSupabase as any)
    .from(table)
    .delete()
    .in(column, values);
  if (error) throw error;
}

async function deleteByEq(table: string, column: string, value?: string | null) {
  if (!value) return;
  const { error } = await (serviceRoleSupabase as any)
    .from(table)
    .delete()
    .eq(column, value);
  if (error) throw error;
}

async function listIdsByIn(table: string, idColumn: string, filterColumn: string, values: string[]) {
  if (values.length === 0) return [];
  const { data, error } = await (serviceRoleSupabase as any)
    .from(table)
    .select(idColumn)
    .in(filterColumn, values)
    .limit(5000);
  if (error) throw error;
  return unique((data || []).map((row: Record<string, string | null | undefined>) => row[idColumn]));
}

async function listSeededE2ETargets(explicit: CleanupTarget): Promise<CleanupTarget[]> {
  const targets: CleanupTarget[] = [];
  if (
    explicit.subscriptionId ||
    explicit.instanceId ||
    explicit.coachId ||
    explicit.coachUserId ||
    explicit.studentUserId
  ) {
    targets.push(explicit);
  }

  const { data: coaches, error } = await serviceRoleSupabase
    .from("coaches")
    .select("id, user_id, name")
    .ilike("name", "E2E Coach%");
  if (error) throw error;

  for (const coach of coaches || []) {
    targets.push({
      coachId: coach.id,
      coachUserId: coach.user_id,
    });
  }

  const byKey = new Map<string, CleanupTarget>();
  for (const target of targets) {
    const key = [
      target.subscriptionId || "",
      target.instanceId || "",
      target.coachId || "",
      target.coachUserId || "",
      target.studentUserId || "",
    ].join(":");
    byKey.set(key, target);
  }
  return Array.from(byKey.values());
}

async function cleanupOneTarget(target: CleanupTarget) {
  const coachIds = unique([target.coachId]);
  const coachUserIds = unique([target.coachUserId]);
  const studentUserIds = unique([target.studentUserId]);

  if (target.coachId && studentUserIds.length === 0) {
    const { data: subs, error } = await serviceRoleSupabase
      .from("coach_subscriptions")
      .select("student_id")
      .eq("coach_id", target.coachId);
    if (error) throw error;
    studentUserIds.push(...unique((subs || []).map((sub) => sub.student_id)));
  }

  const userIds = unique([...coachUserIds, ...studentUserIds]);

  let subscriptionIds: string[] = unique([target.subscriptionId]);
  if (coachIds.length > 0 || studentUserIds.length > 0) {
    let query = serviceRoleSupabase
      .from("coach_subscriptions")
      .select("id")
      .limit(5000);
    if (coachIds.length > 0) {
      query = query.in("coach_id", coachIds);
    }
    if (studentUserIds.length > 0 && coachIds.length === 0) {
      query = query.in("student_id", studentUserIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    subscriptionIds = unique((data || []).map((row) => row.id));
  }

  let subscriptionOrderIds: string[] = [];
  if (subscriptionIds.length > 0) {
    subscriptionOrderIds.push(
      ...(await listIdsByIn("coach_subscription_orders", "id", "subscription_id", subscriptionIds)),
    );
  }
  if (coachIds.length > 0) {
    subscriptionOrderIds.push(
      ...(await listIdsByIn("coach_subscription_orders", "id", "coach_id", coachIds)),
    );
  }
  if (studentUserIds.length > 0) {
    subscriptionOrderIds.push(
      ...(await listIdsByIn("coach_subscription_orders", "id", "student_id", studentUserIds)),
    );
  }
  subscriptionOrderIds = unique(subscriptionOrderIds);

  let instanceIds: string[] = unique([target.instanceId]);
  if (subscriptionIds.length > 0 || coachIds.length > 0 || studentUserIds.length > 0) {
    if (subscriptionIds.length > 0) {
      const { data, error } = await serviceRoleSupabase
        .from("coach_plan_instances")
        .select("id")
        .in("coach_subscription_id", subscriptionIds)
        .limit(5000);
      if (error) throw error;
      instanceIds.push(...unique((data || []).map((row) => row.id)));
    }
    if (coachIds.length > 0) {
      const { data, error } = await serviceRoleSupabase
        .from("coach_plan_instances")
        .select("id")
        .in("coach_id", coachIds)
        .limit(5000);
      if (error) throw error;
      instanceIds.push(...unique((data || []).map((row) => row.id)));
    }
    if (studentUserIds.length > 0) {
      const { data, error } = await serviceRoleSupabase
        .from("coach_plan_instances")
        .select("id")
        .in("student_id", studentUserIds)
        .limit(5000);
      if (error) throw error;
      instanceIds.push(...unique((data || []).map((row) => row.id)));
    }
    instanceIds = unique(instanceIds);
  }

  let executionIds: string[] = [];
  if (instanceIds.length > 0) {
    executionIds = await listIdsByIn("plan_instance_executions", "id", "instance_id", instanceIds);
  }
  let executionSetVideoIds: string[] = [];
  if (executionIds.length > 0) {
    executionSetVideoIds = await listIdsByIn("execution_set_videos", "id", "execution_id", executionIds);
  }

  let roomIds: string[] = [];
  if (subscriptionIds.length > 0) {
    roomIds = await listIdsByIn("chat_rooms", "id", "subscription_id", subscriptionIds);
  }

  let walletIds: string[] = [];
  if (coachIds.length > 0) {
    const { data, error } = await serviceRoleSupabase
      .from("coach_wallets")
      .select("coach_id")
      .in("coach_id", coachIds);
    if (error) throw error;
    walletIds = unique((data || []).map((row) => row.coach_id));
  }

  let orderIds: string[] = [];
  if (userIds.length > 0) {
    const { data, error } = await serviceRoleSupabase
      .from("alipay_orders")
      .select("id")
      .in("user_id", userIds)
      .limit(5000);
    if (error) throw error;
    orderIds = unique((data || []).map((row) => row.id));
  }
  if (subscriptionOrderIds.length > 0) {
    const { data, error } = await (serviceRoleSupabase as any)
      .from("coach_subscription_orders")
      .select("alipay_order_id")
      .in("id", subscriptionOrderIds)
      .limit(5000);
    if (error) throw error;
    orderIds.push(
      ...unique((data || []).map((row: { alipay_order_id?: string | null }) => row.alipay_order_id)),
    );
    orderIds = unique(orderIds);
  }

  if (executionIds.length > 0) {
    await deleteByIn("student_video_collections", "execution_set_video_id", executionSetVideoIds);
    await deleteByIn("execution_set_videos", "execution_id", executionIds);
    await deleteByIn("personal_records_history", "execution_id", executionIds);
  }

  if (roomIds.length > 0) {
    await deleteByIn("chat_messages", "room_id", roomIds);
    await deleteByIn("chat_room_unreads", "room_id", roomIds);
    await deleteByIn("chat_rooms", "id", roomIds);
  }

  if (orderIds.length > 0) {
    await deleteByIn("platform_revenue", "source_order_id", orderIds);
    await deleteByIn("coach_subscription_settlements", "alipay_order_id", orderIds);
    await deleteByIn("wallet_transactions", "alipay_order_id", orderIds);
    await deleteByIn("alipay_orders", "id", orderIds);
  }

  await deleteByIn("coach_subscription_settlements", "subscription_id", subscriptionIds);
  await deleteByIn("coach_subscription_settlements", "coach_id", coachIds);
  await deleteByIn("platform_revenue", "coach_id", coachIds);

  if (walletIds.length > 0) {
    await deleteByIn("alipay_withdrawals", "wallet_id", walletIds);
    await deleteByIn("wallet_transactions", "wallet_id", walletIds);
  }
  await deleteByIn("alipay_withdrawals", "coach_id", coachIds);

  if (instanceIds.length > 0) {
    await deleteByIn("questionnaire_responses", "plan_instance_id", instanceIds);
    await deleteByIn("plan_instance_executions", "instance_id", instanceIds);
    await deleteByIn("coach_plan_instances", "id", instanceIds);
  }

  if (subscriptionOrderIds.length > 0) {
    await deleteByIn("coach_subscription_orders", "id", subscriptionOrderIds);
  }
  if (subscriptionIds.length > 0) {
    await deleteByIn("coach_reviews", "coach_subscription_id", subscriptionIds);
    await deleteByIn("coach_subscriptions", "id", subscriptionIds);
  }

  await deleteByIn("cart_items", "coach_id", coachIds);
  await deleteByIn("cart_items", "user_id", userIds);
  await deleteByIn("onboarding_questionnaires", "coach_id", coachIds);
  await deleteByIn("onboarding_questionnaires", "user_id", userIds);
  await deleteByIn("questionnaire_responses", "coach_id", coachIds);
  await deleteByIn("questionnaire_responses", "student_id", studentUserIds);
  await deleteByIn("student_comments", "coach_id", coachIds);
  await deleteByIn("student_comments", "student_id", studentUserIds);
  await deleteByIn("payout_requests", "coach_id", coachIds);
  await deleteByIn("alipay_accounts", "coach_id", coachIds);
  await deleteByIn("training_videos", "coach_id", coachIds);
  const trainingPlanIds = await listIdsByIn("training_plans", "id", "coach_id", coachIds);
  if (trainingPlanIds.length > 0) {
    const trainingRecordIds = await listIdsByIn("training_records", "id", "plan_id", trainingPlanIds);
    await deleteByIn("set_videos", "training_record_id", trainingRecordIds);
    await deleteByIn("training_records", "plan_id", trainingPlanIds);
    await deleteByIn("training_plan_details", "training_plan_id", trainingPlanIds);
    await deleteByIn("training_videos", "training_plan_id", trainingPlanIds);
    await deleteByIn("training_plans", "id", trainingPlanIds);
  }

  await deleteByIn("coach_wallets", "coach_id", coachIds);
  await deleteByIn("coach_pricing", "coach_id", coachIds);
  await deleteByIn("coach_posters", "coach_id", coachIds);
  await deleteByIn("coach_contents", "coach_id", coachIds);
  await deleteByIn("coach_content_columns", "coach_id", coachIds);
  await deleteByIn("coach_rulepacks", "coach_id", coachIds);
  await deleteByIn("coach_plan_templates", "coach_id", coachUserIds);
  await deleteByIn("coach_questionnaires", "coach_id", coachUserIds);
  await deleteByIn("coach_actions", "coach_id", coachUserIds);
  await deleteByIn("coach_applications", "user_id", coachUserIds);

  for (const userId of userIds) {
    await deleteByEq("user_profiles", "user_id", userId);
  }

  if (coachIds.length > 0) {
    await deleteByIn("coaches", "id", coachIds);
  }
  if (userIds.length > 0) {
    await deleteByIn("users", "id", userIds);
  }
}

export async function POST(req: NextRequest) {
  const gate = assertE2EAllowed(req);
  if (!gate.ok) {
    return NextResponse.json({ success: false, message: gate.message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subscriptionId?: string;
    instanceId?: string | null;
    coachId?: string;
    coachUserId?: string;
    studentUserId?: string;
  };

  const { subscriptionId, instanceId, coachId, coachUserId, studentUserId } = body;

  try {
    const targets = await listSeededE2ETargets({
      subscriptionId,
      instanceId,
      coachId,
      coachUserId,
      studentUserId,
    });
    for (const target of targets) {
      await cleanupOneTarget(target);
    }

    return NextResponse.json({ success: true, cleanedE2ECoaches: targets.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "cleanup failed" }, { status: 500 });
  }
}

