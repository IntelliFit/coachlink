import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { hashPassword } from "@/app/api/auth/[...nextauth]/verify";

function assertE2EAllowed(req: NextRequest) {
  // Only allow in dev/test
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    return { ok: false as const, message: "E2E seed only allowed in development/test" };
  }
  const secret = process.env.E2E_SECRET;
  // Local dev convenience: if E2E_SECRET is not set, allow seeding (dev only).
  // In CI/hosted envs, set E2E_SECRET and we will enforce it.
  if (secret) {
    const provided = req.headers.get("x-e2e-secret");
    if (provided !== secret) {
      return { ok: false as const, message: "Invalid e2e secret" };
    }
  }
  return { ok: true as const };
}

function makeTrainingDays(params: { weeks: number; sessionsPerWeek: number }) {
  const days: any[] = [];
  for (let w = 0; w < params.weeks; w++) {
    for (let d = 1; d <= 7; d++) {
      const dayIndex = w * 7 + d;
      days.push({
        dayIndex,
        type: d <= params.sessionsPerWeek ? "training" : "rest",
        note: "",
        actionSets: [],
      });
    }
  }
  return days;
}

export async function POST(req: NextRequest) {
  const gate = assertE2EAllowed(req);
  if (!gate.ok) {
    return NextResponse.json({ success: false, message: gate.message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    withPlan?: boolean;
    subscribedWeeks?: number;
  };

  const withPlan = body.withPlan !== false;
  const subscribedWeeks = Number(body.subscribedWeeks || 4);

  const ts = Date.now();
  const nonce = Math.floor(Math.random() * 10000);
  const uniq = String(ts + nonce).slice(-8);
  const studentPhone = `139${uniq}`; // valid CN phone format
  const coachPhone = `138${uniq}`;
  const password = "test12345";
  const nowIso = new Date().toISOString();

  // 1) create student
  const { data: studentUser, error: studentErr } = await serviceRoleSupabase
    .from("users")
    .insert({
      phone: studentPhone,
      password_hash: hashPassword(password),
      is_coach: false,
      created_at: nowIso,
      last_login_at: nowIso,
      primary_role: "student",
    } as any)
    .select("id, phone")
    .single();

  if (studentErr || !studentUser?.id) {
    return NextResponse.json({ success: false, message: `seed student failed: ${studentErr?.message}` }, { status: 500 });
  }

  // 2) create coach user + coach row
  const { data: coachUser, error: coachUserErr } = await serviceRoleSupabase
    .from("users")
    .insert({
      phone: coachPhone,
      password_hash: hashPassword(password),
      is_coach: true,
      created_at: nowIso,
      last_login_at: nowIso,
      primary_role: "coach",
    } as any)
    .select("id, phone")
    .single();

  if (coachUserErr || !coachUser?.id) {
    return NextResponse.json({ success: false, message: `seed coach user failed: ${coachUserErr?.message}` }, { status: 500 });
  }

  const { data: coachRow, error: coachErr } = await serviceRoleSupabase
    .from("coaches")
    .insert({
      user_id: coachUser.id,
      name: `E2E Coach ${String(ts).slice(-4)}`,
      status: "approved",
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
    .select("id, user_id, name")
    .single();

  if (coachErr || !coachRow?.id) {
    return NextResponse.json({ success: false, message: `seed coach failed: ${coachErr?.message}` }, { status: 500 });
  }

  // 3) create subscription (active, not started => start_date null)
  const { data: sub, error: subErr } = await serviceRoleSupabase
    .from("coach_subscriptions")
    .insert({
      student_id: studentUser.id,
      coach_id: coachRow.id,
      tier: 1,
      monthly_price: 0,
      status: "active",
      subscribed_weeks: subscribedWeeks,
      start_date: null,
      end_date: null,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
    .select("id")
    .single();

  if (subErr || !sub?.id) {
    return NextResponse.json({ success: false, message: `seed subscription failed: ${subErr?.message}` }, { status: 500 });
  }

  // 4) optionally assign plan instance
  let instanceId: string | null = null;
  if (withPlan) {
    const trainingDays = makeTrainingDays({ weeks: 8, sessionsPerWeek: 3 });
    const { data: inst, error: instErr } = await serviceRoleSupabase
      .from("coach_plan_instances")
      .insert({
        name: "E2E Plan",
        description: "E2E seeded plan",
        coach_subscription_id: sub.id,
        coach_id: coachRow.id,
        student_id: studentUser.id,
        status: "active",
        training_days: trainingDays,
        start_execution_day: 1,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
      .select("id")
      .single();

    if (instErr || !inst?.id) {
      return NextResponse.json({ success: false, message: `seed instance failed: ${instErr?.message}` }, { status: 500 });
    }
    instanceId = inst.id;
  }

  return NextResponse.json({
    success: true,
    data: {
      student: { id: studentUser.id, phone: studentPhone, password },
      coach: { id: coachRow.id, user_id: coachUser.id, phone: coachPhone, password },
      subscription: { id: sub.id },
      instance: { id: instanceId },
    },
  });
}

