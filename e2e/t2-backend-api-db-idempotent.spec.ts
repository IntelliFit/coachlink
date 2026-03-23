import { expect, test } from "@playwright/test";
import { getDevUsers, pickDevUserByKeyword } from "./_helpers/devUsers";

const E2E_SECRET = process.env.E2E_SECRET || "local-e2e";

type SeedData = {
  student: { id: string; phone: string; password: string };
  coach: { id: string; user_id: string; phone: string; password: string };
  subscription: { id: string };
  instance: { id: string | null };
};

type FavoriteCrudResult = { favoriteId: string | null };
type CoachTemplateCrudResult = { templateId: string | null };

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

async function runStudentFavoriteCrud(page: any): Promise<FavoriteCrudResult> {
  let favoriteId: string | null = null;

  const trainingDays = [
    { dayIndex: 1, type: "training", note: "", actionSets: [] },
  ];

  const createRes = await page.request.post("/api/student/plan-lib/save-favorite", {
    data: {
      name: "E2E 学员常用计划",
      description: "用于后端 CRUD 测试",
      training_days: trainingDays,
    },
  });
  const createJson = JSON.parse(await createRes.text());
  expect(createJson.success).toBeTruthy();
  favoriteId = createJson.data.favorite.id;

  const getRes = await page.request.post("/api/student/plan-lib/get-favorite", {
    data: { id: favoriteId },
  });
  const getJson = JSON.parse(await getRes.text());
  expect(getJson.success).toBeTruthy();
  expect(getJson.data.favorite.name).toBe("E2E 学员常用计划");

  const updateRes = await page.request.post("/api/student/plan-lib/update-favorite", {
    data: { id: favoriteId, name: "E2E 学员常用计划-已更新" },
  });
  const updateJson = JSON.parse(await updateRes.text());
  expect(updateJson.success).toBeTruthy();
  expect(updateJson.data.favorite.name).toBe("E2E 学员常用计划-已更新");

  const deleteRes = await page.request.post("/api/student/plan-lib/delete-favorite", {
    data: { id: favoriteId },
  });
  const deleteJson = JSON.parse(await deleteRes.text());
  expect(deleteJson.success).toBeTruthy();
  favoriteId = null;

  return { favoriteId };
}

async function runCoachTemplateCrud(page: any): Promise<CoachTemplateCrudResult> {
  let templateId: string | null = null;
  const trainingDays = [
    { dayIndex: 1, type: "training", note: "", actionSets: [] },
  ];

  const createRes = await page.request.post("/api/plan-lib/create-template", {
    data: {
      name: "E2E 教练模板",
      description: "用于后端 CRUD 测试",
      tags: ["e2e"],
      suitableFor: "beginner",
      trainingDays,
    },
  });
  const createJson = JSON.parse(await createRes.text());
  expect(createJson.success).toBeTruthy();
  templateId = createJson.data.template.id;

  const getRes = await page.request.post("/api/plan-lib/get-template", {
    data: { id: templateId },
  });
  const getJson = JSON.parse(await getRes.text());
  expect(getJson.success).toBeTruthy();
  expect(getJson.data.template.name).toBe("E2E 教练模板");

  const updateRes = await page.request.post("/api/plan-lib/update-template", {
    data: {
      id: templateId,
      name: "E2E 教练模板-已更新",
      trainingDays,
    },
  });
  const updateJson = JSON.parse(await updateRes.text());
  expect(updateJson.success).toBeTruthy();
  expect(updateJson.data.template.name).toBe("E2E 教练模板-已更新");

  const deleteRes = await page.request.post("/api/plan-lib/delete-template", {
    data: { id: templateId },
  });
  const deleteJson = JSON.parse(await deleteRes.text());
  expect(deleteJson.success).toBeTruthy();
  templateId = null;

  return { templateId };
}

test("后端接口+数据库：学员个人计划与教练模板基础 CRUD（幂等）", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const data = await seed(request, { withPlan: false, subscribedWeeks: 4 });
  let leakedFavoriteId: string | null = null;
  let leakedTemplateId: string | null = null;

  try {
    const envStudent = pickDevUserByKeyword("学员");
    const envCoach = pickDevUserByKeyword("教练");

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginByUI(studentPage, {
      phone: envStudent?.phone || data.student.phone,
      password: envStudent?.password || data.student.password,
    });
    const studentResult = await runStudentFavoriteCrud(studentPage);
    leakedFavoriteId = studentResult.favoriteId;
    await studentContext.close();

    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();
    await loginByUI(coachPage, {
      phone: envCoach?.phone || data.coach.phone,
      password: envCoach?.password || data.coach.password,
    });
    const coachResult = await runCoachTemplateCrud(coachPage);
    leakedTemplateId = coachResult.templateId;
    await coachContext.close();
  } finally {
    // 双重清理：确保用例失败时也无残留数据
    if (leakedFavoriteId) {
      const cleanupStudentContext = await browser.newContext();
      const cleanupStudentPage = await cleanupStudentContext.newPage();
      await loginByUI(cleanupStudentPage, {
        phone: data.student.phone,
        password: data.student.password,
      });
      await cleanupStudentPage.request.post("/api/student/plan-lib/delete-favorite", {
        data: { id: leakedFavoriteId },
      });
      await cleanupStudentContext.close();
    }

    if (leakedTemplateId) {
      const cleanupCoachContext = await browser.newContext();
      const cleanupCoachPage = await cleanupCoachContext.newPage();
      await loginByUI(cleanupCoachPage, {
        phone: data.coach.phone,
        password: data.coach.password,
      });
      await cleanupCoachPage.request.post("/api/plan-lib/delete-template", {
        data: { id: leakedTemplateId },
      });
      await cleanupCoachContext.close();
    }

    await cleanup(request, data);
  }
});
