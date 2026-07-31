import { request } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const e2eSecret = process.env.E2E_SECRET || "local-e2e";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function json(response, label) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${label} returned invalid JSON (${response.status()}): ${text.slice(0, 500)}`);
    }
}

async function expectSuccess(response, label) {
    const body = await json(response, label);
    if (!response.ok() || !body?.success) {
        throw new Error(`${label} failed (${response.status()}): ${body?.message || JSON.stringify(body)}`);
    }
    return body.data;
}

async function loginAsStudent(api, student) {
    const csrf = await json(await api.get("/api/auth/csrf"), "load csrf");
    assert(csrf?.csrfToken, "load csrf did not return csrfToken");

    const response = await api.post("/api/auth/callback/credentials?json=true", {
        form: {
            csrfToken: csrf.csrfToken,
            userId: student.id,
            redirect: "false",
            callbackUrl: "/",
        },
    });
    assert(response.ok(), `student login failed (${response.status()})`);

    const session = await json(await api.get("/api/auth/session"), "load session");
    assert(session?.user?.id === student.id, `session user mismatch: ${session?.user?.id || "none"}`);
}

async function listStudentActions(api) {
    return expectSuccess(await api.post("/api/student/action-lib/list-actions", {
        data: { page: 1, limit: 100 },
    }), "list student actions");
}

async function main() {
    const api = await request.newContext({ baseURL });
    let seed = null;
    let favoriteId = null;

    try {
        seed = await expectSuccess(await api.post("/api/test/e2e/seed", {
            headers: { "x-e2e-secret": e2eSecret },
            data: { withPlan: false, subscribedWeeks: 4 },
        }), "seed e2e student");

        await loginAsStudent(api, seed.student);

        const beforeActions = await listStudentActions(api);
        assert(beforeActions.totalCount === 0, `seeded student action library is not empty: ${beforeActions.totalCount}`);

        const catalog = await expectSuccess(await api.get("/api/knowledge/training-plans?limit=50"), "load plan catalog");
        const template = catalog.plans.find((plan) => plan?.entryKind === "template" && plan?.canCopy);
        assert(template?.id || template?.slug, "no published CoachLink template is available for pipeline verification");

        const templateId = template.id || template.slug;
        const copied = await expectSuccess(await api.post(
            `/api/knowledge/training-plans/${encodeURIComponent(templateId)}/copy-to-favorite`,
            { data: {} },
        ), "copy plan to favorites");
        favoriteId = copied.favorite?.id || null;
        assert(favoriteId, "copy response did not include favorite id");

        const trainingDays = Array.isArray(copied.favorite?.training_days)
            ? copied.favorite.training_days
            : [];
        const firstTrainingDay = trainingDays.find((day) =>
            String(day?.type || "training").toLowerCase() === "training" &&
            Array.isArray(day?.actionSets) && day.actionSets.length > 0
        );
        assert(firstTrainingDay, "copied favorite has no executable training day");
        assert(
            firstTrainingDay.actionSets.every((actionSet) =>
                Boolean(actionSet?.actionId || actionSet?.action_id) &&
                Boolean(actionSet?.actionName || actionSet?.set_name)
            ),
            "copied favorite contains an unbound action",
        );

        const afterActions = await listStudentActions(api);
        assert(afterActions.totalCount > 0, "copy did not populate the empty student action library");

        const applied = await expectSuccess(await api.post("/api/student/plan-lib/apply-favorite", {
            data: { favoriteId },
        }), "apply favorite plan");
        const instanceId = applied.planInstanceId;
        assert(instanceId, "apply response did not include plan instance id");

        const started = await expectSuccess(await api.post("/api/execution/start", {
            data: { instanceId, dayIndex: Number(firstTrainingDay.dayIndex) },
        }), "start training execution");
        assert(started?.id, "start response did not include execution id");
        assert(Array.isArray(started.action_executions) && started.action_executions.length > 0, "execution has no actions");
        assert(started.total_sets > 0, "execution has no completable sets/items");

        const firstAction = started.action_executions[0];
        assert(firstAction?.action_id, "execution action is missing its student action id");
        assert(Array.isArray(firstAction?.sets) && firstAction.sets.length > 0, "execution action has no sets/items");

        const itemType = String(firstAction.item_type || "STRENGTH").toUpperCase();
        if (itemType === "STRENGTH") {
            const firstSet = firstAction.sets[0];
            const plannedReps = Number.parseInt(String(firstSet?.planned_reps || ""), 10);
            const completed = await expectSuccess(await api.post("/api/execution/complete-set", {
                data: {
                    executionId: started.id,
                    actionIndex: 0,
                    setIndex: 0,
                    actionId: firstAction.action_id,
                    actualWeight: Number(firstSet?.planned_weight) || 0,
                    actualReps: Number.isFinite(plannedReps) ? plannedReps : 1,
                },
            }), "complete first strength set");
            assert(completed.completedSets >= 1, "completing first set did not advance execution progress");
        } else {
            const completed = await expectSuccess(await api.post("/api/execution/complete-item", {
                data: {
                    executionId: started.id,
                    actionIndex: 0,
                    itemType,
                    completed: true,
                },
            }), "complete first non-strength item");
            assert(completed.completedItems >= 1, "completing first item did not advance execution progress");
        }

        console.log(JSON.stringify({
            ok: true,
            templateId,
            favoriteId,
            instanceId,
            executionId: started.id,
            studentActionsCreated: afterActions.totalCount,
            executionActions: started.action_executions.length,
            executionItems: started.total_sets,
            completedFirstItem: true,
        }, null, 2));
    } finally {
        try {
            if (favoriteId) {
                await api.post("/api/student/plan-lib/delete-favorite", {
                    data: { id: favoriteId },
                    failOnStatusCode: false,
                });
            }
            if (seed) {
                const cleanup = await api.post("/api/test/e2e/cleanup", {
                    headers: { "x-e2e-secret": e2eSecret },
                    data: {
                        subscriptionId: seed.subscription.id,
                        instanceId: seed.instance.id,
                        coachId: seed.coach.id,
                        coachUserId: seed.coach.user_id,
                        studentUserId: seed.student.id,
                    },
                    failOnStatusCode: false,
                });
                const cleanupBody = await json(cleanup, "cleanup e2e student");
                if (!cleanup.ok() || !cleanupBody?.success) {
                    console.error("pipeline cleanup failed", cleanupBody);
                }
            }
        } finally {
            await api.dispose();
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
