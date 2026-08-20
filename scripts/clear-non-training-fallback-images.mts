import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1")), "..");
const execute = process.argv.includes("--execute");
const excluded = JSON.parse(readFileSync(path.join(ROOT, "output/action-reference-remediation-2026-08-20/excluded-non-training.json"), "utf8"));

async function main() {
  const { bootstrapEnv } = await import("../scripts/config/bootstrap-env.mjs");
  await bootstrapEnv({ mode: process.env.NODE_ENV || "development", projectRoot: ROOT });
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 Supabase URL 或 SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = excluded.map((item: any) => item.id);
  const { data, error } = await db.from("canonical_actions").select("id,name,reference_image_url").in("id", ids);
  if (error) throw error;
  const byId = new Map((data || []).map((row: any) => [row.id, row]));
  const results = [];
  for (const item of excluded) {
    const row: any = byId.get(item.id);
    if (!row || row.name !== item.name) throw new Error(`目标不一致：${item.id}`);
    if (!(row.reference_image_url || "").includes("/fallback-reference-card.png")) {
      results.push({ id: item.id, name: item.name, status: "skipped_not_fallback", previous_url: row.reference_image_url });
      continue;
    }
    if (execute) {
      const { error: updateError } = await db.from("canonical_actions").update({ reference_image_url: null }).eq("id", item.id).eq("reference_image_url", row.reference_image_url);
      if (updateError) throw updateError;
    }
    results.push({ id: item.id, name: item.name, status: execute ? "cleared" : "dry_run", previous_url: row.reference_image_url });
  }
  const report = { generated_at: new Date().toISOString(), mode: execute ? "execute" : "dry-run", target_host: new URL(url).host, count: excluded.length, results };
  const reportPath = path.join(ROOT, `output/action-reference-remediation-2026-08-20/non-training-${execute ? "execute" : "dry-run"}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ mode: report.mode, target_host: report.target_host, count: excluded.length, statuses: results.reduce((a: any, x: any) => (a[x.status] = (a[x.status] || 0) + 1, a), {}) }));
}

main().catch((error) => { console.error(error); process.exit(1); });
