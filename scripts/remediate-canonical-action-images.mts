import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Mapping = {
  target_id: string;
  target_name: string;
  local_path?: string;
  source_url?: string;
  source_name?: string;
  clear?: boolean;
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1")), "..");
const execute = process.argv.includes("--execute");
const overwrite = process.argv.includes("--overwrite");
const mappingArg = process.argv.find((value) => value.startsWith("--mapping="))?.slice(10);
const reportArg = process.argv.find((value) => value.startsWith("--report="))?.slice(9);
if (!mappingArg) throw new Error("缺少 --mapping=<json>");
const mappingPath = path.resolve(ROOT, mappingArg);
const reportPath = path.resolve(ROOT, reportArg || "output/action-reference-remediation-report.json");

function safeStem(name: string) {
  return name.toLowerCase().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)
    || createHash("sha1").update(name).digest("hex").slice(0, 12);
}

function contentType(file: string) {
  const ext = path.extname(file).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
}

async function main() {
  const mappings = JSON.parse(readFileSync(mappingPath, "utf8")) as Mapping[];
  const ids = new Set<string>();
  for (const item of mappings) {
    const sourceCount = Number(Boolean(item.local_path)) + Number(Boolean(item.source_url)) + Number(Boolean(item.clear));
    if (!item.target_id || !item.target_name || sourceCount !== 1) {
      throw new Error(`无效映射：${JSON.stringify(item)}`);
    }
    if (ids.has(item.target_id)) throw new Error(`重复 target_id：${item.target_id}`);
    ids.add(item.target_id);
    if (item.local_path && !existsSync(path.resolve(ROOT, item.local_path))) throw new Error(`文件不存在：${item.local_path}`);
  }

  const { bootstrapEnv } = await import("../scripts/config/bootstrap-env.mjs");
  await bootstrapEnv({ mode: process.env.NODE_ENV || "development", projectRoot: ROOT });
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 Supabase URL 或 SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await db.from("canonical_actions").select("id,name,reference_image_url").in("id", [...ids]);
  if (error) throw error;
  const byId = new Map((rows || []).map((row: any) => [row.id, row]));
  const { cosUpload } = await import("../src/lib/cos");
  const results = [];

  for (const item of mappings) {
    const current: any = byId.get(item.target_id);
    if (!current) throw new Error(`目标不存在：${item.target_id}`);
    if (current.name !== item.target_name) throw new Error(`目标名称不一致：${item.target_id} 数据库=${current.name} 映射=${item.target_name}`);
    if (!overwrite && !(current.reference_image_url || "").includes("/fallback-reference-card.png")) {
      results.push({ ...item, status: "skipped_not_fallback", previous_url: current.reference_image_url });
      continue;
    }
    let nextUrl = item.clear ? null : item.source_url || null;
    if (item.local_path && execute) {
      const file = path.resolve(ROOT, item.local_path);
      const ext = path.extname(file).toLowerCase() || ".png";
      const uploaded = await cosUpload("action-reference-images", `canonical-actions/${item.target_id}/${safeStem(item.target_name)}-sequence${ext}`, readFileSync(file), {
        contentType: contentType(file), cacheControl: "public, max-age=31536000, immutable",
      });
      nextUrl = uploaded.url;
    }
    if (execute) {
      let updateQuery = db.from("canonical_actions").update({ reference_image_url: nextUrl }).eq("id", item.target_id);
      updateQuery = current.reference_image_url === null
        ? updateQuery.is("reference_image_url", null)
        : updateQuery.eq("reference_image_url", current.reference_image_url);
      const { data: updatedRows, error: updateError } = await updateQuery.select("id");
      if (updateError) throw updateError;
      if ((updatedRows || []).length !== 1) {
        throw new Error(`更新行数异常：${item.target_id} expected=1 actual=${(updatedRows || []).length}`);
      }
    }
    results.push({ ...item, status: execute ? "updated" : "dry_run", previous_url: current.reference_image_url, next_url: nextUrl });
  }
  const report = { generated_at: new Date().toISOString(), mode: execute ? "execute" : "dry-run", target_host: new URL(url).host, count: mappings.length, results };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ mode: report.mode, target_host: report.target_host, count: mappings.length, statuses: results.reduce((a: any, x: any) => (a[x.status] = (a[x.status] || 0) + 1, a), {}) }));
  console.log(reportPath);
}

main().catch((error) => { console.error(error); process.exit(1); });
