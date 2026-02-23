/**
 * AI 修改器上下文预览报告（命令行）
 * 用法: npx tsx scripts/context-preview-report.ts
 * 或:   npm run context-preview-report
 *
 * 自动解析「枭马葛」教练与学员「zhaoccy」的 ID 与订阅，跑三端场景并输出 Markdown 报告。
 */
import { resolve, dirname } from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { buildBatchOperationContext } from "../src/app/api/plan-lib/batch-operation/context";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// 优先 .env.local（与 Next 一致）
require("dotenv").config({ path: resolve(ROOT, ".env.local") });
require("dotenv").config();

const COACH_NICKNAME = "枭马葛";
const STUDENT_NICKNAME = "zhaoccy";

async function getSupabase() {
  const url =
    process.env.NEXT_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "缺少 SUPABASE URL 或 SERVICE_ROLE_KEY。请在项目根目录配置 .env.local，包含 NEXT_SUPABASE_URL 与 NEXT_SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）后重新运行。"
    );
  }
  return createClient<Database>(url, key);
}

async function resolveCoachAndStudent(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const { data: coachProfiles } = await supabase
    .from("user_profiles")
    .select("user_id, nickname")
    .ilike("nickname", `%${COACH_NICKNAME}%`)
    .limit(1);
  const coachUserId = coachProfiles?.[0]?.user_id ?? null;

  const { data: studentProfiles } = await supabase
    .from("user_profiles")
    .select("user_id, nickname")
    .ilike("nickname", `%${STUDENT_NICKNAME}%`)
    .limit(1);
  const studentUserId = studentProfiles?.[0]?.user_id ?? null;

  let subscriptionId: string | null = null;
  if (coachUserId) {
    const { data: coachRow } = await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", coachUserId)
      .maybeSingle();
    if (coachRow?.id && studentUserId) {
      let { data: sub } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("coach_id", coachRow.id)
        .eq("student_id", studentUserId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // 回退：若无活跃订阅，取最近一条历史订阅，便于上下文调试
      if (!sub?.id) {
        const fallback = await supabase
          .from("coach_subscriptions")
          .select("id")
          .eq("coach_id", coachRow.id)
          .eq("student_id", studentUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        sub = fallback.data || null;
      }
      subscriptionId = sub?.id ?? null;
    }
  }

  return {
    coachUserId,
    studentUserId,
    subscriptionId,
    coachNickname: coachProfiles?.[0]?.nickname ?? COACH_NICKNAME,
    studentNickname: studentProfiles?.[0]?.nickname ?? STUDENT_NICKNAME,
  };
}

function section(title: string, enabled: string[], unavailable: string[], prompt: string) {
  const lines: string[] = [];
  lines.push(`### ${title}`);
  lines.push("");
  lines.push("- **已启用**: " + (enabled.length ? enabled.join("、") : "无"));
  lines.push("- **不可用**: " + (unavailable.length ? unavailable.join("、") : "无"));
  lines.push("");
  lines.push("<details>");
  lines.push("<summary>完整注入给 AI 的上下文文本</summary>");
  lines.push("");
  lines.push("```");
  lines.push(prompt);
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("正在连接 Supabase 并解析用户…");
  const supabase = await getSupabase();

  const { coachUserId, studentUserId, subscriptionId, coachNickname, studentNickname } =
    await resolveCoachAndStudent(supabase);

  if (!coachUserId) {
    console.error("未找到教练用户（昵称含「枭马葛」）");
    process.exit(1);
  }
  if (!studentUserId) {
    console.error("未找到学员用户（昵称含「zhaoccy」）");
    process.exit(1);
  }

  console.log(`教练: ${coachNickname} (user_id=${coachUserId})`);
  console.log(`学员: ${studentNickname} (user_id=${studentUserId})`);
  console.log(`订阅 ID: ${subscriptionId ?? "未找到活跃订阅"}`);
  console.log("");

  const reportLines: string[] = [];
  reportLines.push("# AI 修改器上下文预览报告");
  reportLines.push("");
  reportLines.push(`生成时间: ${new Date().toISOString()}`);
  reportLines.push("");
  reportLines.push("## 场景一：教练端编辑具体学员计划（枭马葛 → zhaoccy）");
  reportLines.push("");

  try {
    const ctx1 = await buildBatchOperationContext({
      userId: coachUserId,
      targetActionType: "coach",
      contextOptions: {
        subscriptionId: subscriptionId ?? undefined,
        includeStudentProfile: true,
        includeStudentQuestionnaire: true,
        includeExecutionHistory: true,
        includeFeedbacks: true,
        includeStudentActionLib: true,
        includeCoachActionLib: true,
        includePublicActionLib: true,
        includeCoachTemplates: true,
        includeTemplateMatch: true,
      },
      supabase,
    });
    reportLines.push(section("教练改学员计划（全量上下文）", ctx1.enabled, ctx1.unavailable, ctx1.prompt));
  } catch (e) {
    reportLines.push("错误: " + String(e));
    reportLines.push("");
  }

  reportLines.push("## 场景二：教练端编辑模板");
  reportLines.push("");

  try {
    const ctx2 = await buildBatchOperationContext({
      userId: coachUserId,
      targetActionType: "coach",
      contextOptions: {
        includeStudentProfile: false,
        includeStudentQuestionnaire: false,
        includeExecutionHistory: false,
        includeFeedbacks: false,
        includeStudentActionLib: false,
        includeCoachActionLib: true,
        includePublicActionLib: true,
        includeCoachTemplates: true,
        includeTemplateMatch: true,
      },
      supabase,
    });
    reportLines.push(section("教练改模板（无学员上下文）", ctx2.enabled, ctx2.unavailable, ctx2.prompt));
  } catch (e) {
    reportLines.push("错误: " + String(e));
    reportLines.push("");
  }

  reportLines.push("## 场景三：学员端创建计划（zhaoccy）");
  reportLines.push("");

  try {
    const ctx3 = await buildBatchOperationContext({
      userId: studentUserId,
      targetActionType: "student",
      contextOptions: {
        includeStudentProfile: true,
        includeStudentQuestionnaire: true,
        includeExecutionHistory: true,
        includeFeedbacks: false,
        includeStudentActionLib: true,
        includeCoachActionLib: false,
        includePublicActionLib: true,
        includeCoachTemplates: false,
        includeTemplateMatch: false,
      },
      supabase,
    });
    reportLines.push(section("学员建计划（学员侧上下文）", ctx3.enabled, ctx3.unavailable, ctx3.prompt));
  } catch (e) {
    reportLines.push("错误: " + String(e));
    reportLines.push("");
  }

  const outPath = resolve(ROOT, "docs/work/AI修改器-上下文预览报告.md");
  writeFileSync(outPath, reportLines.join("\n"), "utf8");
  console.log("报告已写入: " + outPath);
}

main().catch((err) => {
  console.error(err);
  const outPath = resolve(ROOT, "docs/work/AI修改器-上下文预览报告.md");
  const stub = [
    "# AI 修改器上下文预览报告",
    "",
    "生成失败：未生成完整报告。",
    "",
    "**原因**: " + (err instanceof Error ? err.message : String(err)),
    "",
    "**处理**: 请在项目根目录配置 `.env.local`，包含：",
    "- `NEXT_SUPABASE_URL` 或 `SUPABASE_URL`",
    "- `NEXT_SUPABASE_SERVICE_ROLE_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`",
    "",
    "然后重新执行: `npm run context-preview-report`",
  ].join("\n");
  try {
    writeFileSync(outPath, stub, "utf8");
    console.log("已写入占位报告: " + outPath);
  } catch (_) {}
  process.exit(1);
});
