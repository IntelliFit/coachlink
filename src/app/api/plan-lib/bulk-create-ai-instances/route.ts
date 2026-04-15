import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
  BulkCreateAiInstancesDto,
  BulkCreateAiInstancesResponseDto,
  BulkCreateAiInstancesResultItem,
} from "./entity";
import pLimit from "p-limit";
import { ApiError, createAiInstanceForSubscription } from "../create-ai-instance/service";

export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = session?.user?.id || null;
  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized", data: null },
      { status: 401 },
    );
  }

  const {
    mode = "explicit",
    subscriptionIds,
    excludedSubscriptionIds = [],
    startWeek,
    startDay,
    keepOriginalIndex = true,
  } = (await req.json()) as BulkCreateAiInstancesDto;

  const excludedSet = new Set((excludedSubscriptionIds || []).filter(Boolean));

  // Verify coach identity once
  const { data: coachRow, error: coachErr } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (coachErr) {
    return NextResponse.json(
      { success: false, message: coachErr.message, data: null },
      { status: 500 },
    );
  }

  if (!coachRow?.id) {
    return NextResponse.json(
      { success: false, message: "未找到教练身份", data: null },
      { status: 403 },
    );
  }

  let uniqueIds: string[] = [];

  if (mode === "no_plan") {
    // 1) All active subscriptions for this coach
    const { data: subs, error: subsErr } = await supabase
      .from("coach_subscriptions")
      .select("id")
      .eq("coach_id", coachRow.id)
      .eq("status", "active");

    if (subsErr) {
      return NextResponse.json(
        { success: false, message: subsErr.message, data: null },
        { status: 500 },
      );
    }

    const subIds = (subs || []).map((s: any) => s.id).filter(Boolean);
    if (subIds.length === 0) {
      return NextResponse.json<ApiData<BulkCreateAiInstancesResponseDto>>({
        success: true,
        message: "暂无可生成对象",
        data: { total: 0, successCount: 0, failedCount: 0, results: [] },
      });
    }

    // 2) Find which subscriptions already have any plan instance
    const { data: instances, error: instErr } = await supabase
      .from("coach_plan_instances")
      .select("coach_subscription_id")
      .in("coach_subscription_id", subIds);

    if (instErr) {
      return NextResponse.json(
        { success: false, message: instErr.message, data: null },
        { status: 500 },
      );
    }

    const hasPlanSet = new Set((instances || []).map((r: any) => r.coach_subscription_id).filter(Boolean));
    uniqueIds = subIds.filter((id) => !hasPlanSet.has(id)).filter((id) => !excludedSet.has(id));
  } else {
    uniqueIds = Array.from(new Set((subscriptionIds || []).filter(Boolean))).filter((id) => !excludedSet.has(id));
  }

  if (uniqueIds.length === 0) {
    return NextResponse.json<ApiData<BulkCreateAiInstancesResponseDto>>({
      success: true,
      message: "暂无可生成对象",
      data: { total: 0, successCount: 0, failedCount: 0, results: [] },
    });
  }

  const limiter = pLimit(5);
  const tasks = uniqueIds.map((subscriptionId) =>
    limiter(async (): Promise<BulkCreateAiInstancesResultItem> => {
      try {
        const template = await createAiInstanceForSubscription({
          actorUserId: userId,
          actorCoachId: coachRow.id,
          subscriptionId,
          startWeek,
          startDay,
          keepOriginalIndex,
        });

        return { subscriptionId, success: true, template };
      } catch (e: any) {
        const message = e?.message || "生成失败";
        const status = e instanceof ApiError ? e.status : 500;
        // For batch: treat any error as a failed item, but don't fail the whole request
        return { subscriptionId, success: false, template: null, error: `${status}: ${message}` };
      }
    }),
  );

  const results = await Promise.all(tasks);
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;

  return NextResponse.json<ApiData<BulkCreateAiInstancesResponseDto>>({
    success: true,
    message: "批量生成完成",
    data: {
      total: results.length,
      successCount,
      failedCount,
      results,
    },
  });
}

