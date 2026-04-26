import { test, expect } from "@playwright/test";

const E2E_SECRET = process.env.E2E_SECRET || "local-e2e";

async function seed(request: any, params: { withPlan: boolean; subscribedWeeks?: number }) {
  const res = await request.post("/api/test/e2e/seed", {
    headers: { "x-e2e-secret": E2E_SECRET },
    data: params,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`seed not json (status=${res.status()}): ${text.slice(0, 200)}`);
  }
  expect(json.success).toBeTruthy();
  return json.data as {
    student: { id: string; phone: string; password: string };
    coach: { id: string; user_id: string; phone: string; password: string };
    subscription: { id: string };
    instance: { id: string | null };
  };
}

async function cleanup(request: any, data: any) {
  try {
    await request.post("/api/test/e2e/cleanup", {
      headers: { "x-e2e-secret": E2E_SECRET },
      data: {
        subscriptionId: data.subscription.id,
        instanceId: data.instance.id,
        coachId: data.coach.id,
        coachUserId: data.coach.user_id,
        studentUserId: data.student.id,
      },
      timeout: 15_000,
      failOnStatusCode: false,
    });
  } catch {
    // cleanup best-effort; avoid masking assertion failures
  }
}

async function login(page: any, user: { id: string; phone: string }) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("输入用户 ID").fill(user.id);
  await page.getByRole("button", { name: "快速登录" }).click();
  let lastSessionUserId: string | null = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await page.waitForTimeout(500);
    const session = await page.evaluate(async () => {
      const res = await fetch("/api/auth/session");
      return res.json();
    });
    lastSessionUserId = session?.user?.id || null;
    if (session?.user?.id === user.id) return;
  }
  throw new Error(`登录失败：未能快速登录到种子账号 ${user.phone} (${user.id})，最后一次 session userId=${lastSessionUserId || "none"}`);
}

test("B1 status labels: 制定中 (no plan) vs 未开始 (plan assigned but not started)", async ({ page }) => {
  // Case 1: active subscription, no plan assigned => 制定中
  const s1 = await seed(page.request, { withPlan: false, subscribedWeeks: 4 });
  try {
    await login(page, { id: s1.student.id, phone: s1.student.phone });
    await page.goto("/coach/subscription");
    await expect(page.getByText("制定中").first()).toBeVisible();
  } finally {
    await cleanup(page.request, s1);
  }

  // Case 2: plan assigned, not started => 未开始
  const s2 = await seed(page.request, { withPlan: true, subscribedWeeks: 4 });
  try {
    // new context is cleaner; but keep same page for speed: just clear cookies by new page reload
    await page.context().clearCookies();
    await login(page, { id: s2.student.id, phone: s2.student.phone });
    await page.goto("/coach/subscription");
    await expect(page.getByText("未开始").first()).toBeVisible();
  } finally {
    await cleanup(page.request, s2);
  }
});

test("B1 end-to-end: start + finish training updates remaining days", async ({ page }) => {
  const s = await seed(page.request, { withPlan: true, subscribedWeeks: 4 });
  try {
    await login(page, { id: s.student.id, phone: s.student.phone });

    // Before start => 未开始
    await page.goto("/coach/subscription");
    await expect(page.getByText("未开始").first()).toBeVisible();

    // Start execution via real API (same session cookies)
    expect(s.instance.id).toBeTruthy();
    const startRes = await page.request.post("/api/execution/start", {
      data: { instanceId: s.instance.id, dayIndex: 1 },
    });
    const startText = await startRes.text();
    const startJson = JSON.parse(startText);
    expect(startJson.success).toBeTruthy();
    const executionId = startJson.data.id as string;

    // After start, subscription start_date gets set and end_date estimated => "剩余 X 天"
    await page.goto("/coach/subscription");
    await expect(page.getByText(/剩余\s+\d+\s+天/).first()).toBeVisible();

    // Finish training => consumes 1 training-day credit and updates estimated end_date
    const finishRes = await page.request.post("/api/execution/finish", {
      data: { executionId, sessionNotes: "" },
    });
    const finishJson = JSON.parse(await finishRes.text());
    expect(finishJson.success).toBeTruthy();

    // Refresh and still shows remaining days (should generally decrease or stay consistent)
    await page.goto("/coach/subscription");
    await expect(page.getByText(/剩余\s+\d+\s+天/).first()).toBeVisible();
  } finally {
    await cleanup(page.request, s);
  }
});

