import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getCoachlinkPlanLlm } from "@/lib/coachlinkLlm";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { buildPowerAnalysisPromptContext } from "@/lib/powerAnalysisAssessment";
import type { ApiData } from "@/types/api";
import { isBarbellPowerAnalysisMode } from "@coachlink/core/src/powerAnalysisModes";
import type { PowerAnalysisJobDto, PowerAnalysisMetrics } from "../../../types";
import {
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  makeFallbackPowerSummary,
  mapPowerAnalysisJobWithQueueInfo,
  normalizeMetrics,
} from "../../../_helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const db = serviceRoleSupabase as any;

const SYSTEM_PROMPT = [
  "你是 CoachLink 的动作视频分析教练。只根据给定的结构化指标和姿态检查结果给训练建议，不要编造视频里没提供的信息。",
  "姿态检查里标为无法评估的项目，只能说明这次无法评估以及怎么拍才能评估，不能猜测结论。",
  "不要给出具体关节角度、次数、重量或速度以外的新数字；不要做医学诊断，不推断伤病原因。",
  "必须提醒这是基于视频姿态识别的估算，不是实验室测量。",
  "只输出纯文本，禁止使用星号、Markdown 标题、Markdown 列表或代码块。",
].join("");

function buildUserPrompt(metrics: PowerAnalysisMetrics) {
  const barbell = isBarbellPowerAnalysisMode(metrics.mode);
  return [
    "请用中文输出一段简洁但有训练价值的解读，分 4 小段：",
    "1. 本次表现概览",
    "2. 动作评估要点（先讲明显问题，再讲需注意的，最后一句带过做得好的）",
    "3. 下一次训练建议（针对上面的问题给 1 到 3 个具体做法）",
    "4. 误差与拍摄提醒",
    barbell
      ? "这是杠铃动作：重点讲平均速度和组内速度下降，可以据此建议下次是否加减重量；功率只是杠铃抬升功率，不要用它评价力量水平。"
      : "这是自重或负重动作：可以结合功率和速度谈爆发力。",
    "每段使用简短中文标题加全角冒号，标题和正文之间直接换行。不要输出任何星号。",
    "",
    buildPowerAnalysisPromptContext(metrics),
  ].join("\n");
}

function sanitizePowerSummary(value: unknown) {
  return String(value || "")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[\t ]*[-+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
    const sanitized = sanitizePowerSummary(current.llm_summary);
    const row = sanitized !== current.llm_summary
      ? (
          await db
            .from("tool_power_analysis_jobs")
            .update({ llm_summary: sanitized })
            .eq("id", current.id)
            .eq("user_id", session.user.id)
            .select("*")
            .single()
        ).data || { ...current, llm_summary: sanitized }
      : current;
    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      data: await mapPowerAnalysisJobWithQueueInfo(row),
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(metrics) },
      ],
      temperature: 0.4,
      max_tokens: 1100,
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (content) summary = sanitizePowerSummary(content);
  } catch (error) {
    console.warn("[power-analysis/llm-summary] fallback summary used:", error);
  }

  summary = sanitizePowerSummary(summary);
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
    data: await mapPowerAnalysisJobWithQueueInfo(data),
  });
}
