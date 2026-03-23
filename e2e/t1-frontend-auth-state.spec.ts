import { expect, test } from "@playwright/test";
import { getDevUsers } from "./_helpers/devUsers";

const E2E_SECRET = process.env.E2E_SECRET || "local-e2e";

type SeedData = {
  student: { id: string; phone: string; password: string };
  coach: { id: string; user_id: string; phone: string; password: string };
  subscription: { id: string };
  instance: { id: string | null };
};

async function seed(request: any, params: { withPlan: boolean; subscribedWeeks?: number }) {
  const res = await request.post("/api/test/e2e/seed", {
    headers: { "x-e2e-secret": E2E_SECRET },
    data: params,
  });
  const json = JSON.parse(await res.text());
  expect(json.success).toBeTruthy();
  return json.data as SeedData;
}

async function cleanup(request: any, data: SeedData) {
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

async function loginByUI(page: any, user: { phone: string; password: string }) {
  const candidates = [
    user,
    ...getDevUsers().map((u) => ({ phone: u.phone, password: u.password })),
  ];
  for (const c of candidates) {
    await page.goto("/login");
    await page.getByPlaceholder("手机号或邮箱").fill(c.phone);
    await page.getByPlaceholder("输入登录密码").fill(c.password);
    await page.getByRole("button", { name: "立即登录" }).click();
    await page.waitForTimeout(1200);
    const session = await page.evaluate(async () => {
      const res = await fetch("/api/auth/session");
      return res.json();
    });
    if (session?.user?.id) return;
  }
  throw new Error("登录失败：已尝试种子账号与 .env.development 测试账号");
}

test("前端登录与会话维持：刷新后仍保持已登录", async ({ page }) => {
  const data = await seed(page.request, { withPlan: false, subscribedWeeks: 4 });
  try {
    await loginByUI(page, {
      phone: data.student.phone,
      password: data.student.password,
    });

    const sessionBeforeReload = await page.evaluate(async () => {
      const res = await fetch("/api/auth/session");
      return res.json();
    });
    expect(sessionBeforeReload?.user?.id).toBe(data.student.id);

    await page.reload();

    const sessionAfterReload = await page.evaluate(async () => {
      const res = await fetch("/api/auth/session");
      return res.json();
    });
    expect(sessionAfterReload?.user?.id).toBe(data.student.id);
  } finally {
    await cleanup(page.request, data);
  }
});
