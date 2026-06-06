import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getCoachlinkPlanLlm } from "@/lib/coachlinkLlm";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  makeFallbackPowerSummary,
  mapPowerAnalysisJob,
  normalizeMetrics,
} from "../../../_helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const db = serviceRoleSupabase as any;

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const job = await getOwnedPowerAnalysisJob(id, session.user.id);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }

  const current = await expirePowerAnalysisJobIfNeeded(job);
  if (current.status !== "done") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务未完成，暂时无法生成分析", data: null },
      { status: 400 },
    );
  }

  if (current.llm_summary) {
    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      data: mapPowerAnalysisJob(current),
    });
  }

  const metrics = normalizeMetrics(current.metrics_json);
  if (!metrics) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "缺少分析指标，无法生成解读", data: null },
      { status: 400 },
    );
  }

  let summary = makeFallbackPowerSummary(metrics);
  try {
    const { client, model } = getCoachlinkPlanLlm();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是 CoachLink 的街健视频测试解读助手。只根据给定结构化指标做训练建议，不要编造视频里没提供的信息。必须强调这是基于视频姿态识别的估算，不是医学诊断或实验室测量。",
        },
        {
          role: "user",
          content: [
            "请用中文输出一段简洁但有训练价值的解读，分 4 小段：",
            "1. 本次表现概览",
            "2. 爆发力/速度特点",
            "3. 下一次训练建议",
            "4. 误差与拍摄提醒",
            "",
            `动作类型: ${metrics.mode === "muscleup" ? "双力臂" : "引体向上"}`,
            `结构化指标 JSON: ${JSON.stringify(metrics)}`,
          ].join("\n"),
        },
      ],
      temperature: 0.4,
      max_tokens: 900,
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (content) summary = content;
  } catch (error) {
    console.warn("[power-analysis/llm-summary] fallback summary used:", error);
  }

  const { data, error } = await db
    .from("tool_power_analysis_jobs")
    .update({ llm_summary: summary })
    .eq("id", current.id)
    .eq("user_id", session.user.id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[power-analysis/llm-summary] update failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error?.message || "保存解读失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
    success: true,
    data: mapPowerAnalysisJob(data),
  });
}
