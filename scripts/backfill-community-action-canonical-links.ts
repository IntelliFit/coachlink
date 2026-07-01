import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeActionNameForMatch } from "../src/lib/planImportText";
import type { Database } from "../src/types/database.types";

type CanonicalRow = Pick<
  Database["public"]["Tables"]["canonical_actions"]["Row"],
  "id" | "name" | "aliases" | "reference_image_url" | "created_at"
>;

type CommunityRow = Pick<
  Database["public"]["Tables"]["community_actions"]["Row"],
  "id" | "name" | "type" | "canonical_action_id" | "url" | "created_at"
>;

type CliOptions = {
  execute: boolean;
  type: string;
  manifestPath: string;
};

type ManifestItem = {
  actionId: string;
  actionName: string;
  type: string | null;
  previousCanonicalActionId: string | null;
  nextCanonicalActionId: string | null;
  canonicalName: string | null;
  canonicalHasImage: boolean;
  status:
    | "updated"
    | "dry_run_update"
    | "skipped_already_linked"
    | "skipped_not_found"
    | "skipped_ambiguous";
  reason?: string;
  candidates?: Array<{
    id: string;
    name: string | null;
    hasImage: boolean;
  }>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST =
  "design/image-workspace/action-library/community-canonical-link-manifest.json";

function parseArgs(argv: string[]): CliOptions {
  const manifestPath =
    argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1] ||
    DEFAULT_MANIFEST;
  const type = argv.find((arg) => arg.startsWith("--type="))?.split("=")[1] || "STRENGTH";
  return {
    execute: argv.includes("--execute"),
    type: type.trim().toUpperCase(),
    manifestPath,
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

function buildCanonicalKeyMap(rows: CanonicalRow[]) {
  const allByKey = new Map<string, CanonicalRow[]>();
  const exactByKey = new Map<string, CanonicalRow[]>();

  for (const row of rows) {
    const nameKey = normalizeActionNameForMatch(row.name || "");
    if (nameKey) {
      const exact = exactByKey.get(nameKey) || [];
      exact.push(row);
      exactByKey.set(nameKey, exact);
    }

    const keys = new Set<string>([nameKey]);
    for (const alias of row.aliases || []) {
      const aliasKey = normalizeActionNameForMatch(alias || "");
      if (aliasKey) keys.add(aliasKey);
    }

    for (const key of keys) {
      if (!key) continue;
      const bucket = allByKey.get(key) || [];
      bucket.push(row);
      allByKey.set(key, bucket);
    }
  }

  return { allByKey, exactByKey };
}

function dedupeCanonicalRows(rows: CanonicalRow[]) {
  const seen = new Set<string>();
  const out: CanonicalRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function pickPreferredCanonical(
  actionName: string,
  candidates: CanonicalRow[],
  exactMatches: CanonicalRow[],
): { row: CanonicalRow | null; reason: string } {
  if (candidates.length === 0) {
    return { row: null, reason: "未匹配到标准动作" };
  }

  if (exactMatches.length === 1) {
    return { row: exactMatches[0], reason: "动作名精确匹配唯一标准动作" };
  }

  const stableExact = exactMatches.filter((row) => !row.id.startsWith("auto_"));
  if (stableExact.length === 1) {
    return { row: stableExact[0], reason: "多个精确匹配中优先选择稳定标准 ID" };
  }

  const stableAny = candidates.filter((row) => !row.id.startsWith("auto_"));
  if (stableAny.length === 1) {
    return { row: stableAny[0], reason: "别名/精确混合匹配中优先选择稳定标准 ID" };
  }

  return {
    row: null,
    reason: `动作「${actionName}」匹配到多个标准动作，需要人工确认`,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadRuntimeEnv();

  const supabase = createSupabase();

  const { data: canonicalRows, error: canonicalError } = await supabase
    .from("canonical_actions")
    .select("id,name,aliases,reference_image_url,created_at")
    .order("created_at", { ascending: true });
  if (canonicalError) {
    throw new Error(`读取 canonical_actions 失败：${canonicalError.message}`);
  }

  const { data: communityRows, error: communityError } = await supabase
    .from("community_actions")
    .select("id,name,type,canonical_action_id,url,created_at")
    .eq("type", options.type)
    .order("created_at", { ascending: true });
  if (communityError) {
    throw new Error(`读取 community_actions 失败：${communityError.message}`);
  }

  const canonicalKeyMap = buildCanonicalKeyMap(canonicalRows || []);
  const items: ManifestItem[] = [];

  for (const action of (communityRows || []) as CommunityRow[]) {
    if (action.canonical_action_id) {
      items.push({
        actionId: action.id,
        actionName: action.name,
        type: action.type ?? null,
        previousCanonicalActionId: action.canonical_action_id,
        nextCanonicalActionId: action.canonical_action_id,
        canonicalName: null,
        canonicalHasImage: false,
        status: "skipped_already_linked",
      });
      continue;
    }

    const actionKey = normalizeActionNameForMatch(action.name || "");
    const exactMatches = dedupeCanonicalRows(canonicalKeyMap.exactByKey.get(actionKey) || []);
    const candidates = dedupeCanonicalRows(canonicalKeyMap.allByKey.get(actionKey) || []);
    const picked = pickPreferredCanonical(action.name, candidates, exactMatches);

    if (!picked.row) {
      items.push({
        actionId: action.id,
        actionName: action.name,
        type: action.type ?? null,
        previousCanonicalActionId: null,
        nextCanonicalActionId: null,
        canonicalName: null,
        canonicalHasImage: false,
        status: candidates.length === 0 ? "skipped_not_found" : "skipped_ambiguous",
        reason: picked.reason,
        candidates: candidates.map((row) => ({
          id: row.id,
          name: row.name,
          hasImage: Boolean(row.reference_image_url),
        })),
      });
      continue;
    }

    const canonicalHasImage = Boolean(picked.row.reference_image_url);
    items.push({
      actionId: action.id,
      actionName: action.name,
      type: action.type ?? null,
      previousCanonicalActionId: null,
      nextCanonicalActionId: picked.row.id,
      canonicalName: picked.row.name,
      canonicalHasImage,
      status: options.execute ? "updated" : "dry_run_update",
      reason: picked.reason,
    });

    if (options.execute) {
      const { error: updateError } = await supabase
        .from("community_actions")
        .update({ canonical_action_id: picked.row.id })
        .eq("id", action.id);
      if (updateError) {
        throw new Error(
          `更新 community_actions(${action.id}) 失败：${updateError.message}`,
        );
      }
    }
  }

  const summary = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const manifest = {
    generated_at: new Date().toISOString(),
    mode: options.execute ? "execute" : "dry-run",
    type: options.type,
    summary: {
      ...summary,
      update_with_image:
        items.filter(
          (item) =>
            (item.status === "updated" || item.status === "dry_run_update") &&
            item.canonicalHasImage,
        ).length,
      update_without_image:
        items.filter(
          (item) =>
            (item.status === "updated" || item.status === "dry_run_update") &&
            !item.canonicalHasImage,
        ).length,
    },
    items,
  };

  const manifestPath = path.isAbsolute(options.manifestPath)
    ? options.manifestPath
    : path.join(ROOT, options.manifestPath);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`mode=${manifest.mode}`);
  console.log(`type=${options.type}`);
  console.log(`manifest=${path.relative(ROOT, manifestPath)}`);
  console.log(JSON.stringify(manifest.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
