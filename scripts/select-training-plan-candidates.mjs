#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CORPUS_ROOT = path.join(REPO_ROOT, "artifacts", "training-plan-corpus");

function parseArgs(argv) {
    const options = {
        corpusRoot: DEFAULT_CORPUS_ROOT,
        limit: 200,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--corpus-root") {
            options.corpusRoot = path.resolve(argv[index + 1]);
            index += 1;
        } else if (arg === "--limit") {
            options.limit = Math.max(1, Number(argv[index + 1] || 200));
            index += 1;
        }
    }
    return options;
}

function normalizeText(value) {
    return String(value || "").trim();
}

function slugify(value) {
    return normalizeText(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 82);
}

function csvCell(value) {
    const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

function flattenExercises(items) {
    const result = [];
    for (const item of Array.isArray(items) ? items : []) {
        if (normalizeText(item?.name)) result.push(item);
        if (Array.isArray(item?.supersets)) {
            for (const child of item.supersets) {
                if (normalizeText(child?.name)) result.push(child);
            }
        }
    }
    return result;
}

function getVariation(record) {
    const variations = Array.isArray(record?.plan_content?.variations)
        ? record.plan_content.variations
        : [];
    return variations
        .filter((variation) => Array.isArray(variation?.workouts) && variation.workouts.length > 0)
        .sort((left, right) => {
            const leftExercises = left.workouts.reduce(
                (total, workout) => total + flattenExercises(workout?.exercises).length,
                0,
            );
            const rightExercises = right.workouts.reduce(
                (total, workout) => total + flattenExercises(workout?.exercises).length,
                0,
            );
            return rightExercises - leftExercises;
        })[0] || null;
}

function getRepresentativeWorkouts(variation) {
    if (!variation) return [];
    const grouped = new Map();
    for (const workout of variation.workouts || []) {
        const week = Number.isFinite(Number(workout?.week)) ? Number(workout.week) : 0;
        if (!grouped.has(week)) grouped.set(week, []);
        grouped.get(week).push(workout);
    }

    return [...grouped.values()]
        .sort((left, right) => {
            const score = (workouts) => {
                const distinctDays = new Set(workouts.map((workout) => Number(workout?.day || 0))).size;
                const exerciseCount = workouts.reduce(
                    (total, workout) => total + flattenExercises(workout?.exercises).length,
                    0,
                );
                return distinctDays * 100 + exerciseCount;
            };
            return score(right) - score(left);
        })[0] || [];
}

function classify(record) {
    const goals = new Set((record.goals || []).map((goal) => normalizeText(goal).toLowerCase()));
    if (goals.has("olympic weightlifting")) return "olympic-weightlifting";
    if (goals.has("bodyweight fitness")) return "bodyweight";
    if (goals.has("athletics")) return "athletics";
    if (goals.has("women's")) return "womens-fitness";
    if (goals.has("strength") && goals.has("muscle")) return "strength-and-muscle";
    if (goals.has("strength")) return "strength";
    if (goals.has("muscle")) return "hypertrophy";
    return "general-fitness";
}

const CATEGORY_QUOTAS = {
    "strength-and-muscle": 58,
    hypertrophy: 34,
    strength: 28,
    athletics: 24,
    "womens-fitness": 20,
    bodyweight: 20,
    "olympic-weightlifting": 12,
    "general-fitness": 4,
};

function qualityScore(record, representativeWorkouts) {
    const exercises = representativeWorkouts.reduce(
        (total, workout) => total + flattenExercises(workout?.exercises).length,
        0,
    );
    const prescribedSets = representativeWorkouts.reduce(
        (total, workout) => total + flattenExercises(workout?.exercises)
            .reduce((sum, exercise) => sum + Math.max(1, exercise?.sets?.length || 0), 0),
        0,
    );
    return Math.round(
        Math.log10(Math.max(0, Number(record.popularity_count || 0)) + 1) * 100 +
        (record.catalog_kind === "coach" ? 80 : 0) +
        (record.author_verified ? 30 : 0) +
        Math.min(80, representativeWorkouts.length * 10) +
        Math.min(80, exercises * 3) +
        Math.min(50, prescribedSets) +
        Math.min(30, normalizeText(record.description).length / 100) +
        Math.min(20, (record.goals || []).length * 5),
    );
}

function setTarget(set) {
    const target = set?.target;
    const targetType = normalizeText(set?.target_type).toLowerCase();
    const unit = normalizeText(set?.target_unit);
    if (target === undefined || target === null || target === "") return "";
    if (targetType === "time") return `${target}${unit ? ` ${unit}` : " 秒"}`;
    if (targetType === "distance") return `${target}${unit ? ` ${unit}` : ""}`;
    if (targetType === "amrap") return `${target}+ AMRAP`;
    if (targetType === "reps_max") return `${target}+`;
    return String(target);
}

function setIntensityText(set) {
    const value = set?.intensity;
    if (value === undefined || value === null || value === "") return "";

    const unit = normalizeText(set?.intensity_unit);
    const normalizedUnit = unit.toLowerCase();
    const formattedValue = Array.isArray(value)
        ? value.map((item) => normalizeText(item)).filter(Boolean).join("–")
        : normalizeText(value);
    if (!formattedValue) return "";

    if (normalizedUnit === "%" || normalizedUnit === "percent" || normalizedUnit === "percentage") {
        return `${formattedValue}%`;
    }
    if (normalizedUnit === "rpe" || normalizedUnit === "rpe_range") {
        return `RPE ${formattedValue}`;
    }
    return `${formattedValue}${unit ? ` ${unit}` : ""}`;
}

function setRestSeconds(set, exercise) {
    const raw = set?.rest_seconds ?? set?.rest_time ??
        exercise?.rest_seconds ?? exercise?.rest_time ?? 90;
    return Math.max(15, Number(raw) || 90);
}

function buildSetPrescriptions(exercise) {
    return (Array.isArray(exercise?.sets) ? exercise.sets : []).map((set, index) => ({
        setIndex: index + 1,
        target: set?.target ?? null,
        targetType: normalizeText(set?.target_type) || "reps",
        targetUnit: normalizeText(set?.target_unit) || null,
        reps: setTarget(set) || "按动作质量完成",
        intensity: setIntensityText(set),
        intensityValue: set?.intensity ?? null,
        intensityUnit: normalizeText(set?.intensity_unit) || null,
        restSeconds: setRestSeconds(set, exercise),
    }));
}

function prescribedReps(sets) {
    const targets = (Array.isArray(sets) ? sets : []).map(setTarget).filter(Boolean);
    if (targets.length === 0) return "按动作质量完成";
    const unique = [...new Set(targets)];
    if (unique.length === 1) return unique[0];
    return "逐组见详情";
}

function prescribedIntensity(sets) {
    const values = (Array.isArray(sets) ? sets : [])
        .map(setIntensityText)
        .filter(Boolean);
    const unique = [...new Set(values)];
    if (unique.length === 0) return "按动作质量调整";
    return unique.length === 1 ? unique[0] : "逐组见详情";
}

function mapItemType(exercise) {
    const type = normalizeText(exercise?.type).toLowerCase();
    const name = normalizeText(exercise?.name).toLowerCase();
    const hasDistanceTarget = (exercise?.sets || []).some(
        (set) => normalizeText(set?.target_type).toLowerCase() === "distance",
    );
    if (
        type.includes("cardio") ||
        type.includes("run") ||
        type.includes("bike") ||
        hasDistanceTarget ||
        /\b(run|running|sprint|jog|jogging|bike|cycling|rower|rowing|swim|swimming|elliptical)\b|jump rope|shadow boxing|punching bag/.test(name)
    ) return "CARDIO";
    return "STRENGTH";
}

function isExecutableExercise(exercise) {
    const name = normalizeText(exercise?.name);
    if (!name) return false;
    return !/^(rest|rest day|休息)$/i.test(name);
}

function normalizeWeekday(value, fallback, occupied) {
    const raw = Number(value);
    let day = Number.isFinite(raw) ? raw : fallback;
    if (day === 0) day = 7;
    day = Math.min(7, Math.max(1, day));
    while (occupied.has(day) && day < 7) day += 1;
    while (occupied.has(day) && day > 1) day -= 1;
    return day;
}

function toImportPlan(candidate, index) {
    const { record, variation, representativeWorkouts, category } = candidate;
    const weekdays = Array.isArray(variation?.weekdays) ? variation.weekdays : [];
    const occupied = new Set();
    const byDay = new Map();

    const sortedWorkouts = [...representativeWorkouts].sort(
        (left, right) => Number(left?.day || 0) - Number(right?.day || 0),
    );
    for (let workoutIndex = 0; workoutIndex < sortedWorkouts.length; workoutIndex += 1) {
        const workout = sortedWorkouts[workoutIndex];
        const workoutDay = Number(workout?.day || workoutIndex);
        const weekday = normalizeWeekday(weekdays[workoutDay], workoutIndex + 1, occupied);
        occupied.add(weekday);
        const actionSets = flattenExercises(workout?.exercises)
            .filter(isExecutableExercise)
            .slice(0, 16)
            .map((exercise) => {
                const setPrescriptions = buildSetPrescriptions(exercise);
                return {
                    type: "no-filter",
                    itemType: mapItemType(exercise),
                    actionName: normalizeText(exercise.name),
                    setName: normalizeText(exercise.name),
                    sets: Math.max(1, setPrescriptions.length || 1),
                    reps: prescribedReps(exercise?.sets),
                    rest_seconds: setRestSeconds(null, exercise),
                    intensity: prescribedIntensity(exercise?.sets),
                    params: {
                        source_note: normalizeText(exercise?.notes),
                        source_exercise_id: normalizeText(exercise?.id),
                        source_exercise_type: normalizeText(exercise?.type),
                        setPrescriptions,
                    },
                };
            })
            .filter((exercise) => exercise.actionName);
        if (actionSets.length === 0) continue;
        byDay.set(weekday, {
            dayIndex: weekday,
            type: "training",
            note: normalizeText(workout?.notes) || `来源计划代表训练日 ${workoutIndex + 1}`,
            actionSets,
        });
    }

    const trainingDays = Array.from({ length: 7 }, (_, dayOffset) => {
        const dayIndex = dayOffset + 1;
        return byDay.get(dayIndex) || {
            dayIndex,
            type: "rest",
            note: "休息或按个人恢复情况安排低强度活动。",
            actionSets: [],
        };
    });
    const actualDaysPerWeek = trainingDays.filter((day) => day.type === "training").length;
    const sourceSlug = slugify(record.slug || record.title) || `plan-${index + 1}`;
    const sourceDescription = normalizeText(record.tagline || record.description)
        .replace(/\s+/g, " ")
        .slice(0, 360);

    return {
        slug: `candidate-boostcamp-${sourceSlug}`.slice(0, 100),
        name: normalizeText(record.title),
        description: sourceDescription || `${record.author || "原作者"}发布的训练计划候选。`,
        sport: category === "olympic-weightlifting" ? "奥林匹克举重" : "力量与体能训练",
        goal: (record.goals || []).join(" / ") || "综合体能",
        level: (record.difficulties || []).includes("Beginner")
            ? "beginner"
            : (record.difficulties || []).includes("Advanced")
                ? "advanced"
                : "intermediate",
        weeks: Math.max(1, Number(record.weeks_count || 4)),
        daysPerWeek: actualDaysPerWeek,
        equipment: record.equipment || [],
        tags: [
            ...(record.goals || []),
            ...(record.difficulties || []),
            `category:${category}`,
            "source:boostcamp",
            "rights:review-required",
        ],
        suitableFor: (record.difficulties || []).includes("Beginner") ? "beginner" : "intermediate",
        audience: `${record.author || "原作者"}计划的 CoachLink 内部候选版本，尚未完成公开发布授权复核。`,
        notes: [
            `原作者：${record.author || "未标注"}`,
            `来源：${record.source_url}`,
            "当前状态：仅供内部选品与结构校对，不得在授权复核前公开发布。",
            "结构说明：训练日取自原计划中信息最完整的代表周；正式发布前需由教练复核周期进阶。",
        ],
        trainingDays,
        templateKind: "fixed",
        parameterSchema: {
            provenance: {
                source_id: record.source_id,
                source_plan_id: record.source_plan_id,
                source_url: record.source_url,
                author: record.author,
                collected_at: record.collected_at,
                rights_status: record.rights_status,
                import_status: "candidate_draft_pending_rights_review",
            },
        },
        actionSlots: [],
        specialtyKey: category.replaceAll("-", "_"),
        specialtyLabel: {
            "strength-and-muscle": "力量与增肌",
            hypertrophy: "肌肥大",
            strength: "力量",
            athletics: "运动表现",
            "womens-fitness": "女性训练",
            bodyweight: "自重训练",
            "olympic-weightlifting": "奥林匹克举重",
            "general-fitness": "综合体能",
        }[category],
        specialtyPriority: 100 + index,
        sortOrder: index,
        status: "draft",
    };
}

async function readCandidates(inputFile) {
    const candidates = [];
    const lines = readline.createInterface({
        input: fs.createReadStream(inputFile, "utf8"),
        crlfDelay: Infinity,
    });
    for await (const line of lines) {
        if (!line.trim()) continue;
        const record = JSON.parse(line);
        const variation = getVariation(record);
        const representativeWorkouts = getRepresentativeWorkouts(variation);
        const exerciseCount = representativeWorkouts.reduce(
            (total, workout) => total + flattenExercises(workout?.exercises).length,
            0,
        );
        const isPremium = normalizeText(record?.pricing?.type).toLowerCase() === "premium";
        if (
            !record.public_access_at_collection ||
            record.public_view_right === false ||
            isPremium ||
            !variation ||
            representativeWorkouts.length === 0 ||
            exerciseCount < 3
        ) {
            continue;
        }
        const category = classify(record);
        candidates.push({
            record,
            variation,
            representativeWorkouts,
            category,
            score: qualityScore(record, representativeWorkouts),
            exerciseCount,
        });
    }
    return candidates;
}

function selectDiverse(candidates, limit) {
    const sorted = [...candidates].sort((left, right) =>
        right.score - left.score ||
        Number(right.record.popularity_count || 0) - Number(left.record.popularity_count || 0),
    );
    const selected = [];
    const selectedIds = new Set();
    const normalizedTitles = new Set();

    function tryAdd(candidate) {
        const id = normalizeText(candidate.record.source_plan_id || candidate.record.source_url);
        const titleKey = normalizeText(candidate.record.title).toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (!id || selectedIds.has(id) || normalizedTitles.has(titleKey)) return false;
        selected.push(candidate);
        selectedIds.add(id);
        normalizedTitles.add(titleKey);
        return true;
    }

    for (const [category, requestedQuota] of Object.entries(CATEGORY_QUOTAS)) {
        const quota = Math.round((requestedQuota / 200) * limit);
        let used = 0;
        for (const candidate of sorted) {
            if (used >= quota || selected.length >= limit) break;
            if (candidate.category === category && tryAdd(candidate)) used += 1;
        }
    }
    for (const candidate of sorted) {
        if (selected.length >= limit) break;
        tryAdd(candidate);
    }
    return selected.slice(0, limit);
}

function buildMetadata(candidate, rank) {
    const { record, category, score, representativeWorkouts, exerciseCount } = candidate;
    return {
        rank,
        quality_score: score,
        category,
        source_id: record.source_id,
        source_plan_id: record.source_plan_id,
        source_url: record.source_url,
        title: record.title,
        author: record.author,
        catalog_kind: record.catalog_kind,
        goals: record.goals || [],
        difficulties: record.difficulties || [],
        equipment: record.equipment || [],
        weeks: record.weeks_count,
        days_per_week: record.days_per_week,
        popularity_count: record.popularity_count || 0,
        representative_workouts: representativeWorkouts.length,
        representative_exercises: exerciseCount,
        rights_status: record.rights_status,
        import_status: "candidate_draft_pending_rights_review",
        planned_publication_status: "draft",
    };
}

function buildReferenceCatalogItem(candidate, rank) {
    const { record, category } = candidate;
    const sourceSlug = slugify(record.slug || record.title) || `plan-${rank}`;
    const level = (record.difficulties || []).includes("Beginner")
        ? "beginner"
        : (record.difficulties || []).includes("Advanced")
            ? "advanced"
            : "intermediate";
    const specialtyLabel = {
        "strength-and-muscle": "力量与增肌",
        hypertrophy: "肌肥大",
        strength: "力量",
        athletics: "运动表现",
        "womens-fitness": "女性训练",
        bodyweight: "自重训练",
        "olympic-weightlifting": "奥林匹克举重",
        "general-fitness": "综合体能",
    }[category];
    const goals = record.goals || [];
    return {
        id: `boostcamp-${record.source_plan_id}`,
        slug: `reference-boostcamp-${sourceSlug}`.slice(0, 100),
        name: normalizeText(record.title),
        description: `${record.author || "原作者"}发布的${record.weeks_count || 4}周计划，侧重${goals.join("、") || "综合体能"}。`,
        sport: category === "olympic-weightlifting" ? "奥林匹克举重" : "力量与体能训练",
        goal: goals.join(" / ") || "综合体能",
        level,
        weeks: Math.max(1, Number(record.weeks_count || 4)),
        daysPerWeek: Math.max(1, Number(record.days_per_week || 3)),
        equipment: record.equipment || [],
        tags: [...goals, ...(record.difficulties || []), `category:${category}`],
        suitableFor: level,
        audience: null,
        notes: [`作者：${record.author || "未标注"}`, "本条目为来源索引，不复制第三方完整处方。"],
        templateKind: "fixed",
        parameterSchema: {},
        actionSlots: [],
        specialtyKey: category.replaceAll("-", "_"),
        specialtyLabel,
        specialtyPriority: 500 + rank,
        trainingDayCount: Math.max(1, Number(record.weeks_count || 4)) *
            Math.max(1, Number(record.days_per_week || 3)),
        sortOrder: rank,
        entryKind: "reference",
        author: record.author || null,
        sourceName: "Boostcamp",
        sourceUrl: record.source_url,
        rightsStatus: record.rights_status,
        canCopy: false,
    };
}

function buildActionReview(planTemplates) {
    const actions = new Map();
    for (const plan of planTemplates) {
        for (const day of plan.trainingDays || []) {
            for (const actionSet of day.actionSets || []) {
                const name = normalizeText(actionSet.actionName || actionSet.setName);
                const itemType = normalizeText(actionSet.itemType).toUpperCase() || "STRENGTH";
                if (!name) continue;
                const key = `${itemType}:${name.toLowerCase()}`;
                const current = actions.get(key) || {
                    name,
                    itemType,
                    occurrences: 0,
                    planSlugs: new Set(),
                    sourceExerciseTypes: new Set(),
                    targetTypes: new Set(),
                    intensityUnits: new Set(),
                };
                current.occurrences += 1;
                current.planSlugs.add(plan.slug);
                current.sourceExerciseTypes.add(normalizeText(actionSet.params?.source_exercise_type));
                for (const prescription of actionSet.params?.setPrescriptions || []) {
                    current.targetTypes.add(normalizeText(prescription?.targetType));
                    current.intensityUnits.add(normalizeText(prescription?.intensityUnit));
                }
                actions.set(key, current);
            }
        }
    }

    return [...actions.values()]
        .map((action) => ({
            name: action.name,
            itemType: action.itemType,
            occurrences: action.occurrences,
            planCount: action.planSlugs.size,
            sourceExerciseTypes: [...action.sourceExerciseTypes].filter(Boolean).sort(),
            targetTypes: [...action.targetTypes].filter(Boolean).sort(),
            intensityUnits: [...action.intensityUnits].filter(Boolean).sort(),
            reviewFlags: [
                /^(optional|choose|pick)\b/i.test(action.name) ? "placeholder-like" : "",
                /\s(?:or|and)\s|\s\/\s|\+|superset|circuit/i.test(action.name)
                    ? "compound-or-alternative"
                    : "",
            ].filter(Boolean),
            status: "needs-canonical-review",
        }))
        .sort((left, right) =>
            right.planCount - left.planCount ||
            right.occurrences - left.occurrences ||
            left.name.localeCompare(right.name),
        );
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const inputFile = path.join(options.corpusRoot, "sources", "boostcamp", "plans.jsonl");
    if (!fs.existsSync(inputFile)) {
        throw new Error(`未找到 Boostcamp 语料：${inputFile}`);
    }

    const outputDir = path.join(options.corpusRoot, "curated-200");
    fs.mkdirSync(outputDir, { recursive: true });

    const candidates = await readCandidates(inputFile);
    const selected = selectDiverse(candidates, options.limit);
    if (selected.length < options.limit) {
        throw new Error(`可转换候选只有 ${selected.length} 套，少于目标 ${options.limit} 套`);
    }

    const generatedAt = new Date().toISOString();
    const metadata = selected.map((candidate, index) => buildMetadata(candidate, index + 1));
    const importBundle = {
        metadata: {
            generatedAt,
            source: "artifacts/training-plan-corpus/sources/boostcamp/plans.jsonl",
            selectedCount: selected.length,
            publicationPolicy: "draft-only-pending-rights-review",
            warning: "该文件仅用于内部选品和导入草稿。未经作者/平台授权复核，不得把候选改为 published。",
        },
        planTemplates: selected.map(toImportPlan),
    };
    const actionReview = buildActionReview(importBundle.planTemplates);

    const countsByCategory = Object.fromEntries(
        [...new Set(metadata.map((item) => item.category))]
            .sort()
            .map((category) => [
                category,
                metadata.filter((item) => item.category === category).length,
            ]),
    );

    fs.writeFileSync(
        path.join(outputDir, "selected-plans.json"),
        `${JSON.stringify({ generatedAt, selectedCount: metadata.length, countsByCategory, plans: metadata }, null, 2)}\n`,
    );
    const csvColumns = [
        "rank", "quality_score", "category", "title", "author", "catalog_kind",
        "source_url", "weeks", "days_per_week", "goals", "difficulties", "equipment",
        "popularity_count", "representative_workouts", "representative_exercises",
        "rights_status", "import_status", "planned_publication_status",
    ];
    const csvLines = [
        csvColumns.map(csvCell).join(","),
        ...metadata.map((item) => csvColumns.map((column) => csvCell(item[column])).join(",")),
    ];
    fs.writeFileSync(path.join(outputDir, "selected-plans.csv"), `${csvLines.join("\n")}\n`);
    fs.writeFileSync(
        path.join(outputDir, "admin-import.draft.json"),
        `${JSON.stringify(importBundle, null, 2)}\n`,
    );
    fs.writeFileSync(
        path.join(outputDir, "action-library.review.json"),
        `${JSON.stringify({
            generatedAt,
            source: importBundle.metadata.source,
            actionCount: actionReview.length,
            status: "review-required-before-publication",
            actions: actionReview,
        }, null, 2)}\n`,
    );
    const referenceCatalogPath = path.join(REPO_ROOT, "src", "data", "curatedTrainingPlanReferences.json");
    fs.mkdirSync(path.dirname(referenceCatalogPath), { recursive: true });
    fs.writeFileSync(
        referenceCatalogPath,
        `${JSON.stringify({
            version: 1,
            publicationMode: "reference-only",
            source: "Boostcamp",
            rightsPolicy: "metadata-and-source-link-only-until-rights-review",
            items: selected.map(buildReferenceCatalogItem),
        }, null, 2)}\n`,
    );
    fs.writeFileSync(
        path.join(outputDir, "README.md"),
        [
            "# CoachLink 训练计划候选 200",
            "",
            `- 生成时间：${generatedAt}`,
            `- 候选数量：${metadata.length}`,
            "- 来源：Boostcamp 公开计划语料",
            "- 当前状态：全部为内部草稿，等待来源作者、授权范围、中文动作和周期进阶复核",
            "- 禁止操作：不要在未完成权利复核前将 `admin-import.draft.json` 中的状态改为 `published`",
            "",
            "## 类别分布",
            "",
            ...Object.entries(countsByCategory).map(([category, count]) => `- ${category}: ${count}`),
            "",
            "## 文件",
            "",
            "- `selected-plans.csv`：人工初筛队列",
            "- `selected-plans.json`：结构化选品元数据",
            "- `admin-import.draft.json`：CoachLink 管理端兼容的草稿导入包",
            "- `action-library.review.json`：动作库映射、类型和变体人工复核队列",
            "",
            "导入包中的训练日是用于结构校对的代表周，不等于已经完成教练审核的最终周期。",
            "",
        ].join("\n"),
    );

    console.log(JSON.stringify({
        outputDir,
        referenceCatalogPath,
        eligibleCandidates: candidates.length,
        selected: selected.length,
        countsByCategory,
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
