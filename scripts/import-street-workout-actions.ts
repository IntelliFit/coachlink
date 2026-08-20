/**
 * 将《街头健身动作汇总》的 303 个动作及配图导入公共动作库。
 * 默认 dry-run；确认报告中的目标环境后传 --execute 才会上传图片和写库。
 *
 * npx tsx scripts/import-street-workout-actions.ts
 * npx tsx scripts/import-street-workout-actions.ts --execute
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";

interface Occurrence {
  category: string;
  difficulty: string;
  unit: string;
}
interface SourceAction {
  id: number;
  name: string;
  occurrences: Occurrence[];
}
interface Options {
  execute: boolean;
  overwriteImages: boolean;
  ownerUserId?: string;
  concurrency: number;
  sourcePath: string;
  imageDir: string;
  reportPath: string;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const absolute = (value: string) => path.isAbsolute(value) ? value : path.join(ROOT, value);
const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

function options(): Options {
  const concurrency = Number(arg("concurrency") || "3");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("--concurrency 必须是 1 到 10 的整数");
  }
  return {
    execute: process.argv.includes("--execute"),
    overwriteImages: process.argv.includes("--overwrite-images"),
    ownerUserId: arg("owner-user-id"),
    concurrency,
    sourcePath: absolute(arg("source") || "tmp/street-workout-actions.json"),
    imageDir: absolute(arg("image-dir") || "output/street-workout-action-images"),
    reportPath: absolute(arg("report") || "output/street-workout-action-library-import-report.json"),
  };
}

async function runtimeClient() {
  const { bootstrapEnv } = await import("./config/bootstrap-env.mjs") as {
    bootstrapEnv: (input: { mode: string; projectRoot: string }) => Promise<void>;
  };
  await bootstrapEnv({ mode: process.env.NODE_ENV || "development", projectRoot: ROOT });
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 Supabase URL 或 SERVICE_ROLE_KEY");
  return {
    db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as any,
    host: new URL(url).host,
  };
}

function sourceActions(file: string): SourceAction[] {
  if (!existsSync(file)) throw new Error(`动作清单不存在：${file}`);
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const actions = (Array.isArray(parsed) ? parsed : parsed.actions) as SourceAction[];
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("动作清单为空或格式不正确");
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const action of actions) {
    action.name = String(action.name || "").trim();
    if (!Number.isInteger(action.id) || !action.name || !Array.isArray(action.occurrences)) {
      throw new Error(`无效动作记录：${JSON.stringify(action)}`);
    }
    if (ids.has(action.id) || names.has(action.name)) throw new Error(`重复动作：${action.name}`);
    ids.add(action.id);
    names.add(action.name);
  }
  return actions.sort((a, b) => a.id - b.id);
}

function actionImages(dir: string): Map<number, string> {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`图片目录不存在：${dir}`);
  const images = new Map<number, string>();
  for (const name of readdirSync(dir)) {
    const match = /^(\d{3})-.+\.(?:jpe?g|png|webp)$/i.exec(name);
    if (match) images.set(Number(match[1]), path.join(dir, name));
  }
  return images;
}

function stableId(action: SourceAction): string {
  const hash = createHash("sha1").update(action.name).digest("hex").slice(0, 10);
  return `street_workout_${String(action.id).padStart(3, "0")}_${hash}`;
}

function safeStem(name: string): string {
  return name.toLowerCase().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)
    || createHash("sha1").update(name).digest("hex").slice(0, 12);
}

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
function actionMetadata(action: SourceAction) {
  const categories = unique(action.occurrences.map((item) => item.category));
  const difficulties = unique(action.occurrences.map((item) => item.difficulty));
  const units = unique(action.occurrences.map((item) => item.unit));
  const positionMap: Record<string, string[]> = {
    推力: ["胸大肌", "肱三头肌", "三角肌", "核心"],
    拉力: ["背阔肌", "肱二头肌", "前臂", "核心"],
    混合类动作: ["全身", "核心"],
  };
  const canonicalCategory: Record<string, string> = {
    推力: "街头健身·推",
    拉力: "街头健身·拉",
    混合类动作: "街头健身·综合",
  };
  return {
    category: canonicalCategory[categories[0]] || "街头健身",
    detail: `街头健身${categories.join(" / ")}动作。原动作库难度：${difficulties.join(" / ")}。记录单位：${units.join(" / ")}。`,
    positions: unique(categories.flatMap((value) => positionMap[value] || ["全身"])),
    attrs: unique(["街头健身", "徒手", ...categories, ...difficulties.map((value) => `难度${value}`), ...units]),
    suggestedTime: units.includes("秒") && !units.includes("次数") ? "3组×20-30秒" : "3组×6-10次",
    enableAutoWeightCompute: action.name.includes("负重"),
    includesBodyWeight: true,
  };
}

async function fetchAll(db: any, table: string, columns: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return rows;
}

async function main() {
  const opts = options();
  const actions = sourceActions(opts.sourcePath);
  const images = actionImages(opts.imageDir);
  const missing = actions.filter((action) => !images.has(action.id));
  if (missing.length) throw new Error(`缺少 ${missing.length} 张图片：${missing.slice(0, 8).map((item) => item.name).join("、")}`);

  const { db, host } = await runtimeClient();
  const [canonicals, communities] = await Promise.all([
    fetchAll(db, "canonical_actions", "id,name,aliases,category,reference_image_url"),
    fetchAll(db, "community_actions", "id,contributor_user_id,name,type,canonical_action_id"),
  ]);
  const canonicalByName = new Map(canonicals.map((row) => [String(row.name).trim(), row]));
  const strengthByName = new Map(communities.filter((row) => row.type === "STRENGTH").map((row) => [String(row.name).trim(), row]));

  let ownerUserId = opts.ownerUserId;
  if (!ownerUserId) {
    const { data, error } = await db.from("users").select("id").order("created_at").order("id").limit(1).maybeSingle();
    if (error) throw error;
    ownerUserId = data?.id;
  }
  if (!ownerUserId) throw new Error("数据库中没有可作为种子贡献者的用户");

  const plan = actions.map((action) => {
    const canonical = canonicalByName.get(action.name);
    const community = strengthByName.get(action.name);
    return {
      source_id: action.id,
      name: action.name,
      canonical_id: canonical?.id || stableId(action),
      canonical_action: canonical ? "reuse" : "create",
      canonical_image: canonical?.reference_image_url && !opts.overwriteImages ? "reuse" : "upload",
      community_action: community ? "reuse" : "create",
      community_id: community?.id || null,
      reference_image_url: canonical?.reference_image_url || null,
      image_path: path.relative(ROOT, images.get(action.id)!),
    };
  });

  const report: any = {
    generated_at: new Date().toISOString(),
    mode: opts.execute ? "execute" : "dry-run",
    target_supabase_host: host,
    owner_user_id: ownerUserId,
    source_action_count: actions.length,
    database_canonical_count: canonicals.length,
    database_community_count: communities.length,
    database_strength_count: communities.filter((row) => row.type === "STRENGTH").length,
    image_count: images.size,
    summary: {
      canonical_create: plan.filter((item) => item.canonical_action === "create").length,
      canonical_reuse: plan.filter((item) => item.canonical_action === "reuse").length,
      image_upload: plan.filter((item) => item.canonical_image === "upload").length,
      image_reuse: plan.filter((item) => item.canonical_image === "reuse").length,
      community_create: plan.filter((item) => item.community_action === "create").length,
      community_reuse: plan.filter((item) => item.community_action === "reuse").length,
    },
    items: plan,
  };

  if (opts.execute) {
    const { cosUpload } = await import("../src/lib/cos");
    const limit = pLimit(opts.concurrency);
    report.results = await Promise.all(actions.map((action) => limit(async () => {
      const planned = plan.find((item) => item.source_id === action.id)!;
      const canonical = canonicalByName.get(action.name);
      const community = strengthByName.get(action.name);
      const meta = actionMetadata(action);
      try {
        let imageUrl = canonical?.reference_image_url || null;
        if (!imageUrl || opts.overwriteImages) {
          const image = images.get(action.id)!;
          const ext = path.extname(image).toLowerCase() || ".jpg";
          const uploaded = await cosUpload(
            "action-reference-images",
            `canonical-actions/${planned.canonical_id}/${safeStem(action.name)}-sequence${ext}`,
            readFileSync(image),
            { contentType: contentType(image), cacheControl: "public, max-age=31536000, immutable" },
          );
          imageUrl = uploaded.url;
        }

        const { error: canonicalError } = await db.from("canonical_actions").upsert({
          id: planned.canonical_id,
          name: action.name,
          aliases: canonical?.aliases || [],
          category: canonical?.category || meta.category,
          reference_image_url: imageUrl,
        }, { onConflict: "id" });
        if (canonicalError) throw canonicalError;

        let communityId = community?.id || null;
        if (!community) {
          const { data, error } = await db.from("community_actions").upsert({
            contributor_user_id: ownerUserId,
            owner_user_id: ownerUserId,
            name: action.name,
            detail: meta.detail,
            positions: meta.positions,
            attrs: meta.attrs,
            url: null,
            type: "STRENGTH",
            suggested_time: meta.suggestedTime,
            enableAutoWeightCompute: meta.enableAutoWeightCompute,
            includesBodyWeight: meta.includesBodyWeight,
            canonical_action_id: planned.canonical_id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "contributor_user_id,name" }).select("id").single();
          if (error) throw error;
          communityId = data.id;
        } else if (community.canonical_action_id !== planned.canonical_id) {
          const { error } = await db.from("community_actions").update({
            canonical_action_id: planned.canonical_id,
            updated_at: new Date().toISOString(),
          }).eq("id", community.id);
          if (error) throw error;
        }

        if (!community && communityId) {
          const { error } = await db.from("community_action_contributors").upsert({
            action_id: communityId,
            user_id: ownerUserId,
            role: "owner",
            contribution_count: 1,
            last_contributed_at: new Date().toISOString(),
          }, { onConflict: "action_id,user_id" });
          if (error) throw error;
        }
        return { source_id: action.id, name: action.name, status: "completed", canonical_id: planned.canonical_id, community_id: communityId, reference_image_url: imageUrl };
      } catch (error) {
        return { source_id: action.id, name: action.name, status: "failed", error: error instanceof Error ? error.message : String(error) };
      }
    })));
    report.execution_summary = {
      completed: report.results.filter((item: any) => item.status === "completed").length,
      failed: report.results.filter((item: any) => item.status === "failed").length,
    };
  }

  mkdirSync(path.dirname(opts.reportPath), { recursive: true });
  writeFileSync(opts.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`mode=${report.mode}`);
  console.log(`target_supabase_host=${host}`);
  console.log(`source_actions=${actions.length}`);
  console.log(`images=${images.size}`);
  console.log(`summary=${JSON.stringify(report.summary)}`);
  if (report.execution_summary) console.log(`execution_summary=${JSON.stringify(report.execution_summary)}`);
  console.log(`report=${path.relative(ROOT, opts.reportPath)}`);
  if (report.execution_summary?.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
