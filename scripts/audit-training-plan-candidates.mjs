#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const curatedDir = path.join(repoRoot, "artifacts", "training-plan-corpus", "curated-200");
const bundlePath = path.join(curatedDir, "admin-import.draft.json");
const reviewPath = path.join(curatedDir, "action-library.review.json");
const referencesPath = path.join(repoRoot, "src", "data", "curatedTrainingPlanReferences.json");

for (const filePath of [bundlePath, reviewPath, referencesPath]) {
    if (!fs.existsSync(filePath)) throw new Error(`缺少审计输入文件：${filePath}`);
}

const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const references = JSON.parse(fs.readFileSync(referencesPath, "utf8"));
const plans = Array.isArray(bundle?.planTemplates) ? bundle.planTemplates : [];
const errors = [];
const slugs = new Set();
let actionOccurrences = 0;
let setPrescriptionCount = 0;
const itemTypes = new Map();

for (const plan of plans) {
    if (!plan?.slug || slugs.has(plan.slug)) errors.push(`计划 slug 缺失或重复：${plan?.slug || plan?.name}`);
    slugs.add(plan?.slug);
    if (plan?.status !== "draft") errors.push(`${plan?.name}: 外部候选必须保持 draft`);
    if (!Array.isArray(plan?.trainingDays) || plan.trainingDays.length !== 7) {
        errors.push(`${plan?.name}: 代表周必须是 7 天`);
        continue;
    }

    plan.trainingDays.forEach((day, dayOffset) => {
        if (Number(day?.dayIndex) !== dayOffset + 1) {
            errors.push(`${plan?.name}: dayIndex 在第 ${dayOffset + 1} 项不连续`);
        }
        const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        if (day?.type === "training" && actionSets.length === 0) {
            errors.push(`${plan?.name}: 第 ${dayOffset + 1} 天是空训练日`);
        }
        for (const action of actionSets) {
            actionOccurrences += 1;
            const actionName = String(action?.actionName || "").trim();
            if (!actionName || /^(rest|rest day|休息)$/i.test(actionName)) {
                errors.push(`${plan?.name}: 非法可执行动作「${actionName || "空名称"}」`);
            }
            const itemType = String(action?.itemType || "STRENGTH").toUpperCase();
            itemTypes.set(itemType, (itemTypes.get(itemType) || 0) + 1);
            const prescriptions = action?.params?.setPrescriptions;
            if (!Array.isArray(prescriptions) || prescriptions.length !== Number(action?.sets || 0)) {
                errors.push(`${plan?.name}: ${actionName} 的逐组处方数量与 sets 不一致`);
                continue;
            }
            setPrescriptionCount += prescriptions.length;
            prescriptions.forEach((prescription, index) => {
                if (!String(prescription?.reps || "").trim()) {
                    errors.push(`${plan?.name}: ${actionName} 第 ${index + 1} 组缺少 reps`);
                }
                if (!(Number(prescription?.restSeconds) > 0)) {
                    errors.push(`${plan?.name}: ${actionName} 第 ${index + 1} 组休息时间无效`);
                }
            });
        }
    });
}

if (plans.length !== 200) errors.push(`候选计划应为 200，实际 ${plans.length}`);
if (!Array.isArray(references?.items) || references.items.length !== plans.length) {
    errors.push(`来源索引数量与草稿不一致：${references?.items?.length || 0}/${plans.length}`);
}
for (const item of references?.items || []) {
    if (item?.entryKind !== "reference" || item?.canCopy !== false) {
        errors.push(`来源索引不得可复制：${item?.name || item?.slug}`);
    }
}
if (Number(review?.actionCount || 0) !== Number(review?.actions?.length || 0)) {
    errors.push("动作复核清单 actionCount 与实际条目数量不一致");
}

const summary = {
    ok: errors.length === 0,
    plans: plans.length,
    referenceItems: references?.items?.length || 0,
    actionOccurrences,
    setPrescriptionCount,
    uniqueActionsForReview: review?.actionCount || 0,
    reviewFlaggedActions: (review?.actions || []).filter((action) => action?.reviewFlags?.length).length,
    itemTypes: Object.fromEntries(itemTypes),
    errors: errors.slice(0, 50),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length > 0) process.exitCode = 1;
