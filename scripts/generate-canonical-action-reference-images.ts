/**
 * 标准动作参考图批处理脚本
 *
 * 默认 dry-run：分类 canonical_actions、查找本地图、输出 manifest，不上传、不写库。
 *
 * 用法：
 *   npx tsx scripts/generate-canonical-action-reference-images.ts --dry-run
 *   npx tsx scripts/generate-canonical-action-reference-images.ts --dry-run --limit=10
 *   npx tsx scripts/generate-canonical-action-reference-images.ts --execute --limit=10
 *   npx tsx scripts/generate-canonical-action-reference-images.ts --execute --shard=1/30
 *
 * 重要：
 * - 本脚本不调用内建 image_gen；缺图项会写入 manifest.prompt，供子智能体/人工生成后重跑。
 * - execute 只上传已存在的本地图，并默认只填充空 reference_image_url。
 * - 已有 reference_image_url 不覆盖，除非显式传 --overwrite。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import type { Database } from "../src/types/database.types";

type CanonicalActionRow = Database["public"]["Tables"]["canonical_actions"]["Row"];

type CliOptions = {
  dryRun: boolean;
  execute: boolean;
  overwrite: boolean;
  limit?: number;
  offset: number;
  shard?: { index: number; total: number };
  concurrency: number;
  manifestPath: string;
  imageDirs: string[];
};

type ExportAction = {
  canonical_id?: string;
  id?: string;
  name?: string;
  category?: string | null;
  best_public_action?: {
    positions?: string[] | null;
    attrs?: string[] | null;
    detail?: string | null;
    type?: string | null;
  } | null;
  community_action_count?: number;
};

type ManifestItem = {
  id: string;
  name: string;
  category: string | null;
  status:
    | "dry_run_ready"
    | "dry_run_existing_url"
    | "dry_run_missing_image"
    | "skipped_ambiguous"
    | "skipped_existing_url"
    | "missing_image"
    | "uploaded_and_updated"
    | "uploaded_but_update_skipped"
    | "failed";
  reason?: string;
  existing_reference_image_url?: string | null;
  local_image_path?: string | null;
  cos_key?: string | null;
  reference_image_url?: string | null;
  prompt?: string;
  metadata?: {
    positions?: string[] | null;
    attrs?: string[] | null;
    detail?: string | null;
    community_action_count?: number;
    confidence: "high" | "medium" | "low";
  };
  error?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST = "design/image-workspace/action-library/canonical-reference-manifest.json";
const DEFAULT_IMAGE_DIRS = [
  "design/image-workspace/action-library/canonical-outputs",
  "design/image-workspace/action-library/outputs",
];

function parseArgs(argv: string[]): CliOptions {
  const hasExecute = argv.includes("--execute");
  const hasDryRun = argv.includes("--dry-run");
  if (hasExecute && hasDryRun) {
    throw new Error("不能同时传 --dry-run 和 --execute");
  }

  const getNumber = (name: string, fallback?: number) => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} 必须是非负数字`);
    return n;
  };

  const shardArg = argv.find((arg) => arg.startsWith("--shard="))?.split("=")[1];
  let shard: CliOptions["shard"];
  if (shardArg) {
    const [indexRaw, totalRaw] = shardArg.split("/");
    const index = Number(indexRaw);
    const total = Number(totalRaw);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1 || index > total) {
      throw new Error("--shard 格式必须是 i/n，且 1 <= i <= n");
    }
    shard = { index, total };
  }

  const manifestPath = argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1] || DEFAULT_MANIFEST;
  const imageDirArg = argv.find((arg) => arg.startsWith("--image-dir="))?.split("=")[1];
  const imageDirs = (imageDirArg ? imageDirArg.split(",") : DEFAULT_IMAGE_DIRS)
    .map((dir) => dir.trim())
    .filter(Boolean);

  return {
    dryRun: !hasExecute,
    execute: hasExecute,
    overwrite: argv.includes("--overwrite"),
    limit: getNumber("limit"),
    offset: getNumber("offset", 0) || 0,
    shard,
    concurrency: Math.max(1, getNumber("concurrency", 3) || 3),
    manifestPath,
    imageDirs,
  };
}

async function loadRuntimeEnv() {
  const bootstrap = (await import("./config/bootstrap-env.mjs").catch(() => null)) as any;
  if (bootstrap?.bootstrapEnv) {
    await bootstrap.bootstrapEnv({
      mode: process.env.NODE_ENV || "development",
      projectRoot: ROOT,
    });
    return;
  }
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.join(ROOT, ".env.local") });
  dotenv.config({ path: path.join(ROOT, ".env.development") });
  dotenv.config({ path: path.join(ROOT, ".env") });
}

function requireEnv(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function createSupabase() {
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 Supabase URL 或 SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readExportActions(): Map<string, ExportAction> {
  const filePath = path.join(ROOT, "design/image-workspace/action-library/standard-actions-export.json");
  if (!existsSync(filePath)) return new Map();
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.actions || [];
  const out = new Map<string, ExportAction>();
  for (const row of rows as ExportAction[]) {
    const id = row.canonical_id || row.id;
    if (id) out.set(id, row);
  }
  return out;
}

function normalizeForLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .replace(/-sequence$/i, "")
    .replace(/[()\[\]（）【】\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractActionNameFromOutputFile(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(png|jpe?g|webp)$/i, "");
  const numbered = base.match(/^\d{3}-(.+)-sequence$/i);
  if (numbered?.[1]) return numbered[1];
  const plain = base.match(/^(.+)-sequence$/i);
  if (plain?.[1]) return plain[1];
  return base;
}

function safeFileStem(name: string): string {
  const normalized = normalizeForLookup(name);
  if (normalized) return normalized.slice(0, 80);
  return createHash("sha1").update(name).digest("hex").slice(0, 12);
}

function listImageFiles(imageDirs: string[]) {
  const files: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) visit(full);
      else if (/\.(png|jpe?g|webp)$/i.test(entry)) files.push(full);
    }
  };
  for (const dir of imageDirs) {
    visit(path.isAbsolute(dir) ? dir : path.join(ROOT, dir));
  }
  return files;
}

function findLocalImage(action: CanonicalActionRow, files: string[]): string | null {
  const idKey = normalizeForLookup(action.id);
  const nameKey = normalizeForLookup(action.name);
  const exact = files.find((file) => {
    const base = normalizeForLookup(extractActionNameFromOutputFile(file));
    return base === idKey || base === nameKey;
  });
  if (exact) return exact;
  return null;
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function isAmbiguousAction(action: CanonicalActionRow, exported?: ExportAction): { skipped: boolean; reason?: string } {
  const name = action.name.trim();
  const ambiguousTerms = [
    "辅助项",
    "半程维持",
    "待定",
    "未知",
    "其他",
    "通用",
    "自定义",
    "占位",
  ];
  const matched = ambiguousTerms.find((term) => name.includes(term));
  if (matched) return { skipped: true, reason: `名称包含泛化词：${matched}` };

  if (name.length <= 1) return { skipped: true, reason: "名称过短，无法稳定确定动作" };

  if (/^[一二三四五六七八九十两0-9]+周[一二三四五六七八九十两0-9]*练$/.test(name)) {
    return { skipped: true, reason: "名称看起来是训练频次描述，不是具体动作" };
  }

  const hasMetadata =
    (exported?.community_action_count || 0) > 0 ||
    Boolean(exported?.best_public_action?.positions?.length) ||
    Boolean(exported?.best_public_action?.attrs?.length);
  if (!hasMetadata && /^(训练|练习|热身|拉伸|激活|恢复)$/.test(name)) {
    return { skipped: true, reason: "名称只有泛化训练类型且缺少公共动作元数据" };
  }

  return { skipped: false };
}

function buildPrompt(action: CanonicalActionRow, exported?: ExportAction): string {
  const best = exported?.best_public_action;
  const positions = best?.positions?.length ? best.positions.join("、") : action.category || "按动作名称判断";
  const attrs = best?.attrs?.length ? best.attrs.join("、") : "无补充属性";
  const detail = best?.detail ? `\nKnown action detail: ${best.detail}` : "";

  return [
    "Use case: scientific-educational",
    "Asset type: CoachLink standard action reference image",
    `Primary request: Create one single wide horizontal image with three evenly spaced key frames from left to right for “${action.name}”.`,
    "Style: clean non-sexual sports anatomy teaching illustration, CoachLink v4 neutral training model: no shoes, no facial details, short dark hair, translucent white/gray anatomical body with subtle skeleton hints, clean white studio background.",
    "Composition: three separate poses in one wide image, equal spacing, no text, no numbers, no arrows, no labels, no watermark, no color swatches.",
    "Frames: frame 1 is the clear start position, frame 2 is the main transition / bottom / midpoint, frame 3 is the clear finish position. Make frame 3 visibly distinct when the action is cyclic.",
    `Muscle targets from library metadata: ${positions}.`,
    `Action attributes: ${attrs}.`,
    "Muscle highlights: primary trained muscles in red, secondary assisting/stabilizing muscles in orange. Keep highlights action-specific only.",
    "Avoid: shoes, detailed face, blurred face smear, unrelated colored highlights, exaggerated bodybuilding, gore, injury, text, logos, watermark.",
    detail,
  ].filter(Boolean).join("\n");
}

function applyWindow<T>(items: T[], options: CliOptions): T[] {
  let out = items;
  if (options.shard) {
    out = out.filter((_, idx) => idx % options.shard!.total === options.shard!.index - 1);
  }
  if (options.offset > 0) out = out.slice(options.offset);
  if (options.limit !== undefined) out = out.slice(0, options.limit);
  return out;
}

async function fetchCanonicalActions(supabase: ReturnType<typeof createSupabase>): Promise<CanonicalActionRow[]> {
  const { data, error } = await (supabase as any)
    .from("canonical_actions")
    .select("id, name, aliases, category, created_at, reference_image_url")
    .order("name", { ascending: true });
  if (!error) return data || [];

  if (String(error.message || "").includes("reference_image_url")) {
    console.warn(
      "警告：canonical_actions.reference_image_url 尚不存在；dry-run 将按空参考图字段继续。execute 前必须先执行迁移 20260621_canonical_action_reference_images.sql。",
    );
    const fallback = await (supabase as any)
      .from("canonical_actions")
      .select("id, name, aliases, category, created_at")
      .order("name", { ascending: true });
    if (fallback.error) {
      throw new Error(`读取 canonical_actions 失败：${fallback.error.message}`);
    }
    return (fallback.data || []).map((row: any) => ({
      ...row,
      reference_image_url: null,
    }));
  }

  throw new Error(`读取 canonical_actions 失败：${error.message}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadRuntimeEnv();

  if (options.execute) {
    requireEnv("COS_SECRET_ID");
    requireEnv("COS_SECRET_KEY");
    requireEnv("COS_CDN_ASSETS");
  }

  const supabase = createSupabase();
  const exported = readExportActions();
  const imageFiles = listImageFiles(options.imageDirs);
  const allActions = await fetchCanonicalActions(supabase);
  const actions = applyWindow(allActions, options);

  const { cosUpload } = await import("../src/lib/cos");
  const limiter = pLimit(options.concurrency);

  const items = await Promise.all(actions.map((action) => limiter(async (): Promise<ManifestItem> => {
    const meta = exported.get(action.id);
    const ambiguous = isAmbiguousAction(action, meta);
    const prompt = buildPrompt(action, meta);
    const localImage = findLocalImage(action, imageFiles);
    const existingUrl = action.reference_image_url ?? null;
    const baseItem: ManifestItem = {
      id: action.id,
      name: action.name,
      category: action.category,
      status: "dry_run_missing_image",
      existing_reference_image_url: existingUrl,
      local_image_path: localImage ? path.relative(ROOT, localImage) : null,
      prompt,
      metadata: {
        positions: meta?.best_public_action?.positions ?? null,
        attrs: meta?.best_public_action?.attrs ?? null,
        detail: meta?.best_public_action?.detail ?? null,
        community_action_count: meta?.community_action_count ?? 0,
        confidence: meta?.best_public_action ? "high" : meta?.community_action_count ? "medium" : "low",
      },
    };

    if (ambiguous.skipped) {
      return { ...baseItem, status: "skipped_ambiguous", reason: ambiguous.reason };
    }

    if (existingUrl && !options.overwrite) {
      return { ...baseItem, status: options.dryRun ? "dry_run_existing_url" : "skipped_existing_url" };
    }

    if (!localImage) {
      return { ...baseItem, status: options.dryRun ? "dry_run_missing_image" : "missing_image", reason: "未找到本地参考图文件" };
    }

    const cosKey = `canonical-actions/${action.id}/${safeFileStem(action.name)}-sequence${path.extname(localImage).toLowerCase() || ".png"}`;
    if (options.dryRun) {
      return { ...baseItem, status: "dry_run_ready", cos_key: cosKey };
    }

    try {
      const body = readFileSync(localImage);
      const uploaded = await cosUpload("action-reference-images", cosKey, body, {
        contentType: contentTypeFor(localImage),
        cacheControl: "public, max-age=31536000, immutable",
      });

      let updateQuery = (supabase as any)
        .from("canonical_actions")
        .update({ reference_image_url: uploaded.url })
        .eq("id", action.id);
      if (!options.overwrite) {
        updateQuery = updateQuery.is("reference_image_url", null);
      }

      const { data: updatedRows, error: updateError } = await updateQuery
        .select("id, reference_image_url");
      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        return {
          ...baseItem,
          status: "uploaded_but_update_skipped",
          cos_key: cosKey,
          reference_image_url: uploaded.url,
          reason: "上传成功，但数据库未更新；可能已有 reference_image_url 或记录不存在",
        };
      }

      return {
        ...baseItem,
        status: "uploaded_and_updated",
        cos_key: cosKey,
        reference_image_url: uploaded.url,
      };
    } catch (error) {
      return {
        ...baseItem,
        status: "failed",
        cos_key: cosKey,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })));

  const summary = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const manifest = {
    generated_at: new Date().toISOString(),
    mode: options.execute ? "execute" : "dry-run",
    options: {
      overwrite: options.overwrite,
      limit: options.limit ?? null,
      offset: options.offset,
      shard: options.shard ? `${options.shard.index}/${options.shard.total}` : null,
      concurrency: options.concurrency,
      image_dirs: options.imageDirs,
    },
    totals: {
      canonical_actions_all: allActions.length,
      canonical_actions_selected: actions.length,
      local_image_files_found: imageFiles.length,
    },
    summary,
    items,
  };

  const manifestPath = path.isAbsolute(options.manifestPath)
    ? options.manifestPath
    : path.join(ROOT, options.manifestPath);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`mode=${manifest.mode}`);
  console.log(`canonical_actions_all=${allActions.length}`);
  console.log(`canonical_actions_selected=${actions.length}`);
  console.log(`local_image_files_found=${imageFiles.length}`);
  console.log(`manifest=${path.relative(ROOT, manifestPath)}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
