import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1")), "..");
const mappingPath = path.join(ROOT, "output/action-reference-remediation-2026-08-20/full-training-mapping.json");
const currentMappingPath = path.join(ROOT, "output/action-reference-remediation-2026-08-21/exact-corrections-mapping.json");
const outputPath = process.argv.find((value) => value.startsWith("--output="))?.slice(9)
  || "output/action-reference-remediation-2026-08-21/current-usage-audit.json";

async function main() {
  const { bootstrapEnv } = await import("./config/bootstrap-env.mjs");
  await bootstrapEnv({ mode: process.env.NODE_ENV || "development", projectRoot: ROOT });
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 Supabase URL 或 SERVICE_ROLE_KEY");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const previousMappings = JSON.parse(readFileSync(mappingPath, "utf8")) as Array<{ target_id: string }>;
  const currentMappings = existsSync(currentMappingPath)
    ? JSON.parse(readFileSync(currentMappingPath, "utf8")) as Array<{ target_id: string }>
    : [];
  const previousIds = [...new Set([...previousMappings, ...currentMappings].map((item) => item.target_id))];

  const { data: missingRows, error: missingError } = await db
    .from("canonical_actions")
    .select("id,name,category,aliases,reference_image_url")
    .is("reference_image_url", null);
  if (missingError) throw missingError;

  const ids = [...new Set([...previousIds, ...(missingRows || []).map((row) => row.id)])];
  const [{ data: canonicalRows, error: canonicalError }, { data: communityRows, error: communityError }, { data: coachRows, error: coachError }, { data: studentRows, error: studentError }] = await Promise.all([
    db.from("canonical_actions").select("id,name,category,aliases,reference_image_url").in("id", ids),
    db.from("community_actions").select("id,name,type,positions,attrs,detail,canonical_action_id").in("canonical_action_id", ids),
    db.from("coach_actions").select("id,name,type,positions,attrs,detail,canonical_action_id").in("canonical_action_id", ids),
    db.from("student_actions").select("id,name,type,positions,attrs,detail,canonical_action_id").in("canonical_action_id", ids),
  ]);
  if (canonicalError) throw canonicalError;
  if (communityError) throw communityError;
  if (coachError) throw coachError;
  if (studentError) throw studentError;

  const groupByCanonical = (rows: any[] | null) => {
    const grouped = new Map<string, any[]>();
    for (const row of rows || []) {
      const id = row.canonical_action_id;
      if (!id) continue;
      grouped.set(id, [...(grouped.get(id) || []), row]);
    }
    return grouped;
  };
  const communityByCanonical = groupByCanonical(communityRows);
  const coachByCanonical = groupByCanonical(coachRows);
  const studentByCanonical = groupByCanonical(studentRows);

  const rows = (canonicalRows || []).map((canonical) => {
    const community = communityByCanonical.get(canonical.id) || [];
    const coach = coachByCanonical.get(canonical.id) || [];
    const student = studentByCanonical.get(canonical.id) || [];
    const metadata = [...community, ...coach, ...student].map((item) => ({
      source: community.includes(item) ? "community" : coach.includes(item) ? "coach" : "student",
      id: item.id,
      name: item.name,
      type: item.type,
      positions: item.positions,
      attrs: item.attrs,
      detail: item.detail,
      status: item.status,
    }));
    return {
      ...canonical,
      was_previously_remediated: previousIds.includes(canonical.id),
      usage: {
        community: community.length,
        coach: coach.length,
        student: student.length,
        total: community.length + coach.length + student.length,
      },
      action_types: [...new Set(metadata.map((item) => item.type).filter(Boolean))],
      metadata,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));

  const report = {
    generated_at: new Date().toISOString(),
    target_host: new URL(url).host,
    summary: {
      selected: rows.length,
      previous_remediated: rows.filter((row) => row.was_previously_remediated).length,
      missing_image: rows.filter((row) => !row.reference_image_url).length,
      used_in_action_libraries: rows.filter((row) => row.usage.total > 0).length,
    },
    rows,
  };
  const resolvedOutput = path.resolve(ROOT, outputPath);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary));
  console.log(resolvedOutput);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
