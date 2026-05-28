import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  auditSubscriptionEntitlements,
  repairFalseBlockedSubscriptionEndDates,
} from "../src/lib/subscriptionEntitlementAudit";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development" });
dotenv.config();

type CliOptions = {
  execute: boolean;
  scope: "false-blocked" | "audit";
  json: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const execute = argv.includes("--execute");
  const json = argv.includes("--json");
  const scopeArg = argv.find((arg) => arg.startsWith("--scope="));
  const scope = (scopeArg?.split("=")[1] || "audit") as CliOptions["scope"];

  if (execute && scope !== "false-blocked") {
    throw new Error("Executing data repair requires --scope=false-blocked");
  }
  if (scope !== "audit" && scope !== "false-blocked") {
    throw new Error("Unsupported --scope. Use audit or false-blocked.");
  }

  return { execute, scope, json };
}

function createSupabase() {
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Set NEXT_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function summarizeRows(rows: any[]) {
  return rows.map((row) => ({
    subscriptionId: row.subscriptionId,
    studentId: row.studentId,
    coachId: row.coachId,
    oldEndDate: row.oldEndDate,
    newEndDate: row.newEndDate,
    credits: `${row.usedCredits}/${row.totalCredits} used, ${row.remainingCredits} left`,
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabase();

  if (options.scope === "false-blocked") {
    const result = await repairFalseBlockedSubscriptionEndDates({
      supabase,
      execute: options.execute,
    });
    const output = {
      ...result,
      rows: options.json ? result.rows : summarizeRows(result.rows),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const audit = await auditSubscriptionEntitlements({ supabase });
  const grouped = {
    nowIso: audit.nowIso,
    counts: audit.counts,
    falseBlockedByStaleEndDate: audit.rows
      .filter((row) => row.categories.includes("false_blocked_by_stale_end_date"))
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        studentId: row.studentId,
        coachId: row.coachId,
        storedEndDate: row.storedEndDate,
        projectedEndDate: row.model.displayEndDate,
        credits: `${row.model.usedCredits}/${row.model.totalCredits} used, ${row.model.remainingCredits} left`,
      })),
    trueGraceOrExhaustedNotComplete: audit.rows
      .filter((row) =>
        row.categories.includes("true_grace_or_exhausted_not_complete")
      )
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        studentId: row.studentId,
        coachId: row.coachId,
        lifecycle: row.model.lifecycleStatus,
        entitlement: row.model.entitlementStatus,
        credits: `${row.model.usedCredits}/${row.model.totalCredits}`,
      })),
    shouldAutoCancel: audit.rows
      .filter((row) => row.categories.includes("should_auto_cancel"))
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        studentId: row.studentId,
        coachId: row.coachId,
      })),
    activeNoPlan: audit.rows
      .filter((row) => row.categories.includes("active_no_plan"))
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        studentId: row.studentId,
        coachId: row.coachId,
        lifecycle: row.model.lifecycleStatus,
      })),
  };
  console.log(JSON.stringify(grouped, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
