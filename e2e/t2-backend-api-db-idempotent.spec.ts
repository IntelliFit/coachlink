import { expect, test } from "@playwright/test";

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
    // Cleanup is best-effort; do not mask assertion failures.
  }
}

async function loginByUI(page: any, user: { id: string; phone: string }) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("input").first().fill(user.id);
  await page.locator("xpath=(//input)[1]/following::button[1]").click();
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
  throw new Error(`E2E login failed for seeded user ${user.phone} (${user.id}); last session userId=${lastSessionUserId || "none"}`);
}

async function runStudentFavoriteCrud(page: any): Promise<FavoriteCrudResult> {
  let favoriteId: string | null = null;
  const trainingDays = [{ dayIndex: 1, type: "training", note: "", actionSets: [] }];

  const createRes = await page.request.post("/api/student/plan-lib/save-favorite", {
    data: {
      name: "E2E student favorite plan",
      description: "E2E backend CRUD test",
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
  expect(getJson.data.favorite.name).toBe("E2E student favorite plan");

  const updateRes = await page.request.post("/api/student/plan-lib/update-favorite", {
    data: { id: favoriteId, name: "E2E student favorite plan updated" },
  });
  const updateJson = JSON.parse(await updateRes.text());
  expect(updateJson.success).toBeTruthy();
  expect(updateJson.data.favorite.name).toBe("E2E student favorite plan updated");

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
  const trainingDays = [{ dayIndex: 1, type: "training", note: "", actionSets: [] }];

  const createRes = await page.request.post("/api/plan-lib/create-template", {
    data: {
      name: "E2E coach template",
      description: "E2E backend CRUD test",
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
  expect(getJson.data.template.name).toBe("E2E coach template");

  const updateRes = await page.request.post("/api/plan-lib/update-template", {
    data: {
      id: templateId,
      name: "E2E coach template updated",
      trainingDays,
    },
  });
  const updateJson = JSON.parse(await updateRes.text());
  expect(updateJson.success).toBeTruthy();
  expect(updateJson.data.template.name).toBe("E2E coach template updated");

  const deleteRes = await page.request.post("/api/plan-lib/delete-template", {
    data: { id: templateId },
  });
  const deleteJson = JSON.parse(await deleteRes.text());
  expect(deleteJson.success).toBeTruthy();
  templateId = null;

  return { templateId };
}

test("backend API and DB CRUD stays idempotent", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const data = await seed(request, { withPlan: false, subscribedWeeks: 4 });
  let leakedFavoriteId: string | null = null;
  let leakedTemplateId: string | null = null;

  try {
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginByUI(studentPage, data.student);
    const studentResult = await runStudentFavoriteCrud(studentPage);
    leakedFavoriteId = studentResult.favoriteId;
    await studentContext.close();

    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();
    await loginByUI(coachPage, { id: data.coach.user_id, phone: data.coach.phone });
    const coachResult = await runCoachTemplateCrud(coachPage);
    leakedTemplateId = coachResult.templateId;
    await coachContext.close();
  } finally {
    if (leakedFavoriteId) {
      const cleanupStudentContext = await browser.newContext();
      const cleanupStudentPage = await cleanupStudentContext.newPage();
      await loginByUI(cleanupStudentPage, data.student);
      await cleanupStudentPage.request.post("/api/student/plan-lib/delete-favorite", {
        data: { id: leakedFavoriteId },
      });
      await cleanupStudentContext.close();
    }

    if (leakedTemplateId) {
      const cleanupCoachContext = await browser.newContext();
      const cleanupCoachPage = await cleanupCoachContext.newPage();
      await loginByUI(cleanupCoachPage, { id: data.coach.user_id, phone: data.coach.phone });
      await cleanupCoachPage.request.post("/api/plan-lib/delete-template", {
        data: { id: leakedTemplateId },
      });
      await cleanupCoachContext.close();
    }

    await cleanup(request, data);
  }
});
