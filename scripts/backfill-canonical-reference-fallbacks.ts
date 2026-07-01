import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cosUpload } from "../src/lib/cos";
import type { Database } from "../src/types/database.types";

type CanonicalRow = Pick<
  Database["public"]["Tables"]["canonical_actions"]["Row"],
  "id" | "name" | "aliases" | "category" | "reference_image_url" | "created_at"
>;

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

type CommunityMeta = {
  positions: string[];
  attrs: string[];
  detail: string | null;
  communityActionCount: number;
};

type CliOptions = {
  execute: boolean;
  overwrite: boolean;
  limit?: number;
  manifestPath: string;
  outputDir: string;
};

type ManifestItem = {
  id: string;
  name: string;
  category: string | null;
  previousReferenceImageUrl: string | null;
  nextReferenceImageUrl: string | null;
  localPngPath: string | null;
  cosKey: string | null;
  status:
    | "skipped_existing_url"
    | "dry_run_ready"
    | "uploaded_and_updated"
    | "failed";
  reason?: string;
  metadata: {
    positions: string[];
    attrs: string[];
    detail: string | null;
    communityActionCount: number;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST =
  "design/image-workspace/action-library/canonical-fallback-reference-manifest.json";
const DEFAULT_OUTPUT_DIR =
  "design/image-workspace/action-library/fallback-outputs";

function parseArgs(argv: string[]): CliOptions {
  const getNumber = (name: string) => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`--${name} 必须是非负数字`);
    }
    return n;
  };

  return {
    execute: argv.includes("--execute"),
    overwrite: argv.includes("--overwrite"),
    limit: getNumber("limit"),
    manifestPath:
      argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1] ||
      DEFAULT_MANIFEST,
    outputDir:
      argv.find((arg) => arg.startsWith("--output-dir="))?.split("=")[1] ||
      DEFAULT_OUTPUT_DIR,
  };
}

async function loadRuntimeEnv() {
  const bootstrap = (await import("./config/bootstrap-env.mjs")) as {
    bootstrapEnv: (options: { mode: string; projectRoot: string }) => Promise<void>;
  };
  await bootstrap.bootstrapEnv({
    mode: process.env.NODE_ENV || "development",
    projectRoot: ROOT,
  });
}

function createSupabase() {
  const url =
    process.env.NEXT_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or service role key");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readExportActions(): Map<string, ExportAction> {
  const filePath = path.join(
    ROOT,
    "design/image-workspace/action-library/standard-actions-export.json",
  );
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.actions || [];
  const out = new Map<string, ExportAction>();
  for (const row of rows as ExportAction[]) {
    const id = row.canonical_id || row.id;
    if (id) out.set(id, row);
  }
  return out;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFileStem(name: string) {
  return String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "canonical-action";
}

function buildCardHtml(action: CanonicalRow, exported?: ExportAction) {
  const positions = exported?.best_public_action?.positions?.filter(Boolean) || [];
  const attrs = exported?.best_public_action?.attrs?.filter(Boolean) || [];
  const detail = String(exported?.best_public_action?.detail || "").trim() || "";
  const category = action.category || exported?.category || "标准动作";
  const chips = positions.length > 0 ? positions : [category];
  const attrChips = attrs.length > 0 ? attrs : ["动作参考", "训练执行", "标准动作"];

  const chipHtml = chips
    .slice(0, 4)
    .map(
      (chip) => `<span class="chip chip-primary">${escapeHtml(chip)}</span>`,
    )
    .join("");
  const attrHtml = attrChips
    .slice(0, 4)
    .map(
      (chip) => `<span class="chip chip-secondary">${escapeHtml(chip)}</span>`,
    )
    .join("");

  const detailText = detail
    ? escapeHtml(detail).slice(0, 120)
    : "该动作暂未补齐三帧示意图，先提供统一参考卡，避免小程序出现空白素材位。";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <style>
    :root {
      --bg: #f6efe8;
      --ink: #2f2622;
      --muted: #6f6258;
      --line: #dbcdbf;
      --brand: #cf6d4e;
      --sand: #efe3d6;
      --card: #fffaf5;
      --panel: #f3e5d8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1600px;
      height: 900px;
      background:
        radial-gradient(circle at 15% 20%, rgba(207,109,78,.14), transparent 24%),
        radial-gradient(circle at 82% 18%, rgba(207,109,78,.10), transparent 22%),
        linear-gradient(180deg, #fbf6f1 0%, var(--bg) 100%);
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
      color: var(--ink);
    }
    .frame {
      width: 100%;
      height: 100%;
      padding: 64px;
      position: relative;
      overflow: hidden;
    }
    .grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(111,98,88,.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(111,98,88,.05) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(180deg, rgba(0,0,0,.5), transparent 90%);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      position: relative;
      z-index: 1;
    }
    .eyebrow {
      font-size: 22px;
      letter-spacing: 0.12em;
      color: var(--brand);
      font-weight: 700;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 68px;
      line-height: 1.08;
      font-weight: 800;
      max-width: 860px;
    }
    .subline {
      color: var(--muted);
      font-size: 24px;
      line-height: 1.5;
      max-width: 900px;
    }
    .badge {
      padding: 14px 20px;
      border: 2px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,.8);
      font-size: 20px;
      color: var(--muted);
      font-weight: 700;
    }
    .chip-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 24px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 22px;
      font-weight: 700;
      border: 2px solid transparent;
    }
    .chip-primary {
      background: rgba(207,109,78,.14);
      color: var(--brand);
    }
    .chip-secondary {
      background: rgba(47,38,34,.06);
      color: var(--ink);
      border-color: rgba(47,38,34,.08);
    }
    .content {
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 32px;
      align-items: stretch;
      height: calc(100% - 248px);
      position: relative;
      z-index: 1;
    }
    .info-card,
    .visual-card {
      background: rgba(255,250,245,.84);
      border: 2px solid rgba(219,205,191,.8);
      border-radius: 40px;
      padding: 32px;
      box-shadow: 0 20px 48px rgba(47,38,34,.08);
    }
    .info-title {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 18px;
      color: var(--muted);
      letter-spacing: .06em;
    }
    .info-detail {
      font-size: 26px;
      line-height: 1.55;
      color: var(--ink);
    }
    .visual-shell {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      height: 100%;
    }
    .pose {
      border-radius: 28px;
      background:
        linear-gradient(180deg, rgba(255,255,255,.88), rgba(239,227,214,.92)),
        var(--panel);
      border: 2px solid rgba(219,205,191,.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .pose::before {
      content: "";
      position: absolute;
      width: 220px;
      height: 220px;
      border-radius: 999px;
      border: 2px dashed rgba(207,109,78,.28);
      top: 44px;
    }
    .pose-index {
      position: absolute;
      top: 18px;
      left: 18px;
      width: 56px;
      height: 56px;
      border-radius: 999px;
      background: var(--brand);
      color: #fff;
      font-size: 26px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figure {
      position: relative;
      width: 168px;
      height: 260px;
    }
    .head {
      position: absolute;
      width: 52px;
      height: 52px;
      border-radius: 999px;
      background: rgba(47,38,34,.86);
      left: 58px;
      top: 0;
    }
    .torso {
      position: absolute;
      width: 64px;
      height: 92px;
      background: rgba(207,109,78,.82);
      border-radius: 28px;
      left: 52px;
      top: 56px;
    }
    .arm,
    .leg {
      position: absolute;
      background: rgba(47,38,34,.82);
      border-radius: 999px;
      transform-origin: top center;
    }
    .arm {
      width: 18px;
      height: 92px;
      top: 68px;
    }
    .arm.left { left: 40px; transform: rotate(22deg); }
    .arm.right { right: 40px; transform: rotate(-22deg); }
    .leg {
      width: 22px;
      height: 108px;
      top: 142px;
    }
    .leg.left { left: 56px; transform: rotate(10deg); }
    .leg.right { right: 56px; transform: rotate(-10deg); }
    .pose[data-step="2"] .arm.left { transform: rotate(6deg); }
    .pose[data-step="2"] .arm.right { transform: rotate(-6deg); }
    .pose[data-step="2"] .leg.left { transform: rotate(2deg); }
    .pose[data-step="2"] .leg.right { transform: rotate(-2deg); }
    .pose[data-step="3"] .arm.left { transform: rotate(-18deg); }
    .pose[data-step="3"] .arm.right { transform: rotate(18deg); }
    .pose[data-step="3"] .leg.left { transform: rotate(-8deg); }
    .pose[data-step="3"] .leg.right { transform: rotate(8deg); }
    .pose-label {
      margin-top: 20px;
      font-size: 22px;
      font-weight: 800;
      color: var(--ink);
    }
    .pose-hint {
      margin-top: 8px;
      font-size: 16px;
      color: var(--muted);
      text-align: center;
      line-height: 1.45;
      padding: 0 12px;
      max-width: 220px;
      min-height: 72px;
    }
    .footer {
      position: absolute;
      left: 64px;
      right: 64px;
      bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: 20px;
      letter-spacing: .04em;
      z-index: 1;
    }
    .footer strong {
      color: var(--ink);
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="grid"></div>
    <div class="header">
      <div>
        <div class="eyebrow">COACHLINK ACTION REFERENCE</div>
        <h1>${escapeHtml(action.name)}</h1>
        <div class="subline">${detailText}</div>
        <div class="chip-row">${chipHtml}</div>
        <div class="chip-row">${attrHtml}</div>
      </div>
      <div class="badge">${escapeHtml(String(category))}</div>
    </div>
    <div class="content">
      <section class="info-card">
        <div class="info-title">动作说明</div>
        <div class="info-detail">
          当前标准动作暂未沉淀专用三帧参考图，先补统一参考卡，避免公共动作和小程序详情页出现空白素材位。<br />
          后续可在相同标准动作 ID 上直接覆盖为正式示意图，无需改动业务代码。
        </div>
      </section>
      <section class="visual-card">
        <div class="visual-shell">
          <div class="pose" data-step="1">
            <div class="pose-index">1</div>
            <div class="figure">
              <div class="head"></div>
              <div class="torso"></div>
              <div class="arm left"></div>
              <div class="arm right"></div>
              <div class="leg left"></div>
              <div class="leg right"></div>
            </div>
            <div class="pose-label">准备</div>
            <div class="pose-hint">起始位</div>
          </div>
          <div class="pose" data-step="2">
            <div class="pose-index">2</div>
            <div class="figure">
              <div class="head"></div>
              <div class="torso"></div>
              <div class="arm left"></div>
              <div class="arm right"></div>
              <div class="leg left"></div>
              <div class="leg right"></div>
            </div>
            <div class="pose-label">发力</div>
            <div class="pose-hint">主动作路径</div>
          </div>
          <div class="pose" data-step="3">
            <div class="pose-index">3</div>
            <div class="figure">
              <div class="head"></div>
              <div class="torso"></div>
              <div class="arm left"></div>
              <div class="arm right"></div>
              <div class="leg left"></div>
              <div class="leg right"></div>
            </div>
            <div class="pose-label">完成</div>
            <div class="pose-hint">终点位</div>
          </div>
        </div>
      </section>
    </div>
    <div class="footer">
      <div><strong>CoachLink</strong> 标准动作参考卡</div>
      <div>后续可无缝替换为正式参考图</div>
    </div>
  </div>
</body>
</html>`;
}

function buildCommunityMetaMap(rows: Array<{
  name: string | null;
  positions: string[] | null;
  attrs: string[] | null;
  detail: string | null;
}>) {
  const map = new Map<string, CommunityMeta>();
  for (const row of rows) {
    const name = String(row.name || "").trim();
    if (!name) continue;
    const current = map.get(name) || {
      positions: [],
      attrs: [],
      detail: null,
      communityActionCount: 0,
    };
    current.communityActionCount += 1;
    if (current.positions.length === 0 && Array.isArray(row.positions)) {
      current.positions = row.positions.filter(Boolean);
    }
    if (current.attrs.length === 0 && Array.isArray(row.attrs)) {
      current.attrs = row.attrs.filter(Boolean);
    }
    if (!current.detail && row.detail) {
      current.detail = row.detail;
    }
    map.set(name, current);
  }
  return map;
}

async function renderFallbackPng(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  action: CanonicalRow,
  exported: ExportAction | undefined,
  outputPath: string,
) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(buildCardHtml(action, exported), {
      waitUntil: "load",
    });
    await page.screenshot({
      path: outputPath,
      type: "png",
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadRuntimeEnv();

  const supabase = createSupabase();
  const exportedMap = readExportActions();
  const { data: communityRows, error: communityError } = await supabase
    .from("community_actions")
    .select("name,positions,attrs,detail");
  if (communityError) {
    throw new Error(`读取 community_actions 元数据失败：${communityError.message}`);
  }
  const communityMetaMap = buildCommunityMetaMap(communityRows || []);
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(ROOT, options.outputDir);
  mkdirSync(outputDir, { recursive: true });

  const { data, error } = await supabase
    .from("canonical_actions")
    .select("id,name,aliases,category,reference_image_url,created_at")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`读取 canonical_actions 失败：${error.message}`);
  }

  let actions = (data || []) as CanonicalRow[];
  if (!options.overwrite) {
    actions = actions.filter((row) => !row.reference_image_url);
  }
  if (options.limit !== undefined) {
    actions = actions.slice(0, options.limit);
  }

  const browser = await chromium.launch({ headless: true });
  const items: ManifestItem[] = [];

  try {
    for (const action of actions) {
      const exported = exportedMap.get(action.id);
      const localPngPath = path.join(
        outputDir,
        `${safeFileStem(action.name)}-${action.id}.png`,
      );
      const relativeLocalPngPath = path.relative(ROOT, localPngPath);
      const cosKey = `canonical-actions/${action.id}/fallback-reference-card.png`;
      const fallbackMeta = communityMetaMap.get(action.name) || {
        positions: [],
        attrs: [],
        detail: null,
        communityActionCount: 0,
      };
      const meta = {
        positions:
          exported?.best_public_action?.positions?.filter(Boolean) ||
          fallbackMeta.positions,
        attrs:
          exported?.best_public_action?.attrs?.filter(Boolean) ||
          fallbackMeta.attrs,
        detail:
          String(exported?.best_public_action?.detail || "").trim() ||
          fallbackMeta.detail,
        communityActionCount:
          exported?.community_action_count || fallbackMeta.communityActionCount,
      };

      if (action.reference_image_url && !options.overwrite) {
        items.push({
          id: action.id,
          name: action.name,
          category: action.category,
          previousReferenceImageUrl: action.reference_image_url,
          nextReferenceImageUrl: action.reference_image_url,
          localPngPath: null,
          cosKey: null,
          status: "skipped_existing_url",
          metadata: meta,
        });
        continue;
      }

      try {
        const exportedForRender =
          exported ||
          ({
            canonical_id: action.id,
            name: action.name,
            category: action.category,
            community_action_count: fallbackMeta.communityActionCount,
            best_public_action: {
              positions: fallbackMeta.positions,
              attrs: fallbackMeta.attrs,
              detail: fallbackMeta.detail,
              type: null,
            },
          } satisfies ExportAction);
        await renderFallbackPng(browser, action, exportedForRender, localPngPath);

        if (!options.execute) {
          items.push({
            id: action.id,
            name: action.name,
            category: action.category,
            previousReferenceImageUrl: action.reference_image_url,
            nextReferenceImageUrl: null,
            localPngPath: relativeLocalPngPath,
            cosKey,
            status: "dry_run_ready",
            metadata: meta,
          });
          continue;
        }

        const body = await fs.readFile(localPngPath);
        const uploaded = await cosUpload("action-reference-images", cosKey, body, {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        });

        let updateQuery = supabase
          .from("canonical_actions")
          .update({ reference_image_url: uploaded.url })
          .eq("id", action.id);
        if (!options.overwrite) {
          updateQuery = updateQuery.is("reference_image_url", null);
        }

        const { error: updateError } = await updateQuery;
        if (updateError) {
          throw new Error(`写回 reference_image_url 失败：${updateError.message}`);
        }

        items.push({
          id: action.id,
          name: action.name,
          category: action.category,
          previousReferenceImageUrl: action.reference_image_url,
          nextReferenceImageUrl: uploaded.url,
          localPngPath: relativeLocalPngPath,
          cosKey,
          status: "uploaded_and_updated",
          metadata: meta,
        });
      } catch (error) {
        items.push({
          id: action.id,
          name: action.name,
          category: action.category,
          previousReferenceImageUrl: action.reference_image_url,
          nextReferenceImageUrl: null,
          localPngPath: relativeLocalPngPath,
          cosKey,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
          metadata: meta,
        });
      }
    }
  } finally {
    await browser.close();
  }

  const summary = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const manifest = {
    generated_at: new Date().toISOString(),
    mode: options.execute ? "execute" : "dry-run",
    overwrite: options.overwrite,
    limit: options.limit ?? null,
    output_dir: path.relative(ROOT, outputDir),
    summary,
    items,
  };

  const manifestPath = path.isAbsolute(options.manifestPath)
    ? options.manifestPath
    : path.join(ROOT, options.manifestPath);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`mode=${manifest.mode}`);
  console.log(`manifest=${path.relative(ROOT, manifestPath)}`);
  console.log(`output_dir=${manifest.output_dir}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
