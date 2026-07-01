import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

type CommunityRow = Pick<
  Database["public"]["Tables"]["community_actions"]["Row"],
  "id" | "name" | "type" | "canonical_action_id" | "url" | "positions" | "attrs" | "detail"
>;

type CliOptions = {
  execute: boolean;
  type: string;
  manifestPath: string;
};

type ManifestItem = {
  actionId: string;
  actionName: string;
  actionType: string | null;
  previousCanonicalActionId: string | null;
  nextCanonicalActionId: string | null;
  status:
    | "linked_existing_manual"
    | "created_new_canonical"
    | "dry_run_link_existing_manual"
    | "dry_run_create_new_canonical"
    | "skipped_already_linked";
  detail: string | null;
  positions: string[] | null;
  attrs: string[] | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST =
  "design/image-workspace/action-library/community-canonical-bootstrap-manifest.json";

const MANUAL_EXISTING_MAP: Record<string, string> = {
  高位下拉: "auto_51a8b04a029c8f92ae1b5a0e",
  锤式弯举: "auto_32ef06d728b5ac37783d4964",
};

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

function inferCategoryFromPositions(
  positions: string[] | null,
  attrs: string[] | null,
): string | null {
  const joined = [...(positions || []), ...(attrs || [])].join(" ");
  if (!joined) return null;
  if (/胸|肩|三头|推/.test(joined)) return "推";
  if (/背|二头|拉|引体|划船|下拉/.test(joined)) return "拉";
  if (/股|臀|腿|髋|提踵|深蹲|硬拉/.test(joined)) return "下肢";
  if (/核心|腹/.test(joined)) return "核心";
  if (/举重|爆发/.test(joined)) return "爆发";
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadRuntimeEnv();
  const supabase = createSupabase();

  const { data, error } = await supabase
    .from("community_actions")
    .select("id,name,type,canonical_action_id,url,positions,attrs,detail")
    .eq("type", options.type)
    .is("canonical_action_id", null)
    .is("url", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`读取 community_actions 失败：${error.message}`);
  }

  const actions = (data || []) as CommunityRow[];
  const items: ManifestItem[] = [];

  for (const action of actions) {
    if (action.canonical_action_id) {
      items.push({
        actionId: action.id,
        actionName: action.name,
        actionType: action.type ?? null,
        previousCanonicalActionId: action.canonical_action_id,
        nextCanonicalActionId: action.canonical_action_id,
        status: "skipped_already_linked",
        detail: action.detail ?? null,
        positions: action.positions ?? null,
        attrs: action.attrs ?? null,
      });
      continue;
    }

    const manualCanonicalId = MANUAL_EXISTING_MAP[action.name];
    if (manualCanonicalId) {
      items.push({
        actionId: action.id,
        actionName: action.name,
        actionType: action.type ?? null,
        previousCanonicalActionId: null,
        nextCanonicalActionId: manualCanonicalId,
        status: options.execute
          ? "linked_existing_manual"
          : "dry_run_link_existing_manual",
        detail: action.detail ?? null,
        positions: action.positions ?? null,
        attrs: action.attrs ?? null,
      });

      if (options.execute) {
        const { error: updateError } = await supabase
          .from("community_actions")
          .update({ canonical_action_id: manualCanonicalId })
          .eq("id", action.id);
        if (updateError) {
          throw new Error(
            `更新 community_actions(${action.id}) 手工映射失败：${updateError.message}`,
          );
        }
      }
      continue;
    }

    const canonicalId = `public_tpl_${action.id}`;
    items.push({
      actionId: action.id,
      actionName: action.name,
      actionType: action.type ?? null,
      previousCanonicalActionId: null,
      nextCanonicalActionId: canonicalId,
      status: options.execute
        ? "created_new_canonical"
        : "dry_run_create_new_canonical",
      detail: action.detail ?? null,
      positions: action.positions ?? null,
      attrs: action.attrs ?? null,
    });

    if (!options.execute) {
      continue;
    }

    const category = inferCategoryFromPositions(
      action.positions ?? null,
      action.attrs ?? null,
    );
    const { error: insertError } = await supabase
      .from("canonical_actions")
      .insert({
        id: canonicalId,
        name: action.name,
        aliases: [],
        category,
        reference_image_url: null,
      });
    if (insertError) {
      throw new Error(
        `插入 canonical_actions(${canonicalId}) 失败：${insertError.message}`,
      );
    }

    const { error: linkError } = await supabase
      .from("community_actions")
      .update({ canonical_action_id: canonicalId })
      .eq("id", action.id);
    if (linkError) {
      throw new Error(
        `回写 community_actions(${action.id}) -> ${canonicalId} 失败：${linkError.message}`,
      );
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
    summary,
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
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
