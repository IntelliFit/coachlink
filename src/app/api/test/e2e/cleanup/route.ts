import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

function assertE2EAllowed(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    return { ok: false as const, message: "E2E cleanup only allowed in development/test" };
  }
  const secret = process.env.E2E_SECRET;
  // Local dev convenience: if E2E_SECRET is not set, allow cleanup (dev only).
  if (secret) {
    const provided = req.headers.get("x-e2e-secret");
    if (provided !== secret) return { ok: false as const, message: "Invalid e2e secret" };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const gate = assertE2EAllowed(req);
  if (!gate.ok) {
    return NextResponse.json({ success: false, message: gate.message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subscriptionId?: string;
    instanceId?: string | null;
    coachId?: string;
    coachUserId?: string;
    studentUserId?: string;
  };

  const { subscriptionId, instanceId, coachId, coachUserId, studentUserId } = body;

  try {
    if (instanceId) {
      await serviceRoleSupabase
        .from("plan_instance_executions")
        .delete()
        .eq("instance_id", instanceId);

      await serviceRoleSupabase
        .from("coach_plan_instances")
        .delete()
        .eq("id", instanceId);
    }

    if (subscriptionId) {
      await serviceRoleSupabase
        .from("coach_subscriptions")
        .delete()
        .eq("id", subscriptionId);
    }

    if (coachId) {
      await serviceRoleSupabase
        .from("coaches")
        .delete()
        .eq("id", coachId);
    }

    if (coachUserId) {
      await serviceRoleSupabase
        .from("users")
        .delete()
        .eq("id", coachUserId);
    }

    if (studentUserId) {
      await serviceRoleSupabase
        .from("users")
        .delete()
        .eq("id", studentUserId);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "cleanup failed" }, { status: 500 });
  }
}

