import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

async function getCurrentCoach() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  const { data: coach, error } = await (serviceRoleSupabase as any)
    .from("coaches")
    .select("id, user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !coach?.id) {
    return { error: NextResponse.json({ success: false, message: "Coach not found" }, { status: 404 }) };
  }

  return { coach: { id: String(coach.id), userId: String(coach.user_id) } };
}

function parseLimit(value: string | null) {
  const limit = Number(value || 30);
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

export async function GET(req: Request) {
  const current = await getCurrentCoach();
  if (current.error) return current.error;

  const url = new URL(req.url);
  const subscriptionId = String(url.searchParams.get("subscriptionId") || "").trim();
  const limit = parseLimit(url.searchParams.get("limit"));

  let jobsQuery = (serviceRoleSupabase as any)
    .from("coach_automation_jobs")
    .select("*")
    .eq("coach_id", current.coach!.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  let draftsQuery = (serviceRoleSupabase as any)
    .from("coach_plan_adjustment_drafts")
    .select("*")
    .eq("coach_id", current.coach!.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (subscriptionId) {
    jobsQuery = jobsQuery.eq("subscription_id", subscriptionId);
    draftsQuery = draftsQuery.eq("subscription_id", subscriptionId);
  }

  const [{ data: jobs, error: jobsError }, { data: drafts, error: draftsError }] = await Promise.all([
    jobsQuery,
    draftsQuery,
  ]);

  if (jobsError || draftsError) {
    return NextResponse.json({
      success: false,
      message: jobsError?.message || draftsError?.message || "Failed to load automation jobs",
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      jobs: jobs || [],
      drafts: drafts || [],
    },
  });
}
