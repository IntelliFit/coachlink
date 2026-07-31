import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
    actionIdentityKey,
    normalizeActionNameIdentity,
} from "@/lib/actionNameIdentity";

type TrainingLevel = "beginner" | "intermediate" | "advanced";
type TemplateKind = "fixed" | "parameterized";
type TemplateStatus = "draft" | "published" | "archived";
type KnowledgeNodeType = "domain" | "category" | "topic" | "article" | "video";

export type TrainingPlanImportActionSet = {
    type?: string;
    itemType?: string;
    item_type?: string;
    actionName?: string;
    action_name?: string;
    setName?: string;
    set_name?: string;
    params?: Record<string, unknown>;
    sets?: number | string;
    reps?: number | string;
    rest_seconds?: number | string;
    intensity?: number | string;
    slotKey?: string;
    slot_key?: string;
};

export type TrainingPlanImportDay = {
    dayIndex?: number;
    day_index?: number;
    type?: "training" | "rest";
    note?: string;
    actionSets?: TrainingPlanImportActionSet[];
    action_sets?: TrainingPlanImportActionSet[];
};

export type TrainingPlanTemplateImport = {
    slug: string;
    name: string;
    description?: string;
    sport: string;
    goal: string;
    level: TrainingLevel;
    weeks: number;
    daysPerWeek: number;
    equipment?: string[];
    tags?: string[];
    suitableFor?: TrainingLevel;
    audience?: string;
    notes?: string[];
    trainingDays: TrainingPlanImportDay[];
    templateKind?: TemplateKind;
    parameterSchema?: Record<string, unknown>;
    actionSlots?: unknown[];
    specialtyKey?: string;
    specialtyLabel?: string;
    specialtyPriority?: number;
    sortOrder?: number;
    status?: TemplateStatus;
};

export type KnowledgeBookImport = {
    title: string;
    author?: string;
    coverImage?: string;
    summary?: string;
    audioUrl?: string;
    content: string | Record<string, unknown>;
    isFree?: boolean;
    isPublished?: boolean;
    sortOrder?: number;
};

export type KnowledgeArticleImport = {
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    content: string | Record<string, unknown>;
    nodeType?: KnowledgeNodeType;
    bodyRegion?: string[];
    equipment?: string[];
    difficulty?: number;
    isFree?: boolean;
    isPublished?: boolean;
    sortOrder?: number;
};

export type AdminContentImportBundle = {
    planTemplates?: TrainingPlanTemplateImport[];
    books?: KnowledgeBookImport[];
    articles?: KnowledgeArticleImport[];
};

type NormalizedTrainingPlan = Required<
    Omit<
        TrainingPlanTemplateImport,
        "description" | "equipment" | "tags" | "suitableFor" | "audience" | "notes" |
        "templateKind" | "parameterSchema" | "actionSlots" | "specialtyKey" |
        "specialtyLabel" | "specialtyPriority" | "sortOrder" | "status"
    >
> & {
    description: string | null;
    equipment: string[];
    tags: string[];
    suitableFor: TrainingLevel;
    audience: string | null;
    notes: string[];
    templateKind: TemplateKind;
    parameterSchema: Record<string, unknown>;
    actionSlots: unknown[];
    specialtyKey: string;
    specialtyLabel: string;
    specialtyPriority: number;
    sortOrder: number;
    status: TemplateStatus;
};

type NormalizedBundle = {
    planTemplates: NormalizedTrainingPlan[];
    books: KnowledgeBookImport[];
    articles: KnowledgeArticleImport[];
};

export type AdminContentImportResult = {
    ok: boolean;
    dryRun: boolean;
    errors: string[];
    summary: {
        planTemplates: { validated: number; upserted: number };
        books: { validated: number; upserted: number };
        articles: { validated: number; upserted: number };
    };
    rows?: {
        planTemplates?: Array<{ id?: string; slug?: string; name?: string; status?: string }>;
        books?: Array<{ id?: string; title?: string }>;
        articles?: Array<{ id?: string; slug?: string; title?: string }>;
    };
};

const VALID_LEVELS = new Set<TrainingLevel>(["beginner", "intermediate", "advanced"]);
const VALID_TEMPLATE_KINDS = new Set<TemplateKind>(["fixed", "parameterized"]);
const VALID_STATUSES = new Set<TemplateStatus>(["draft", "published", "archived"]);
const VALID_NODE_TYPES = new Set<KnowledgeNodeType>(["domain", "category", "topic", "article", "video"]);

function cleanString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value: unknown) {
    const text = cleanString(value);
    return text ? text : null;
}

function cleanStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => cleanString(item)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};
}

function normalizeNumber(value: unknown, fallback: number) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizePositiveInt(value: unknown, fallback: number) {
    const numberValue = Math.floor(normalizeNumber(value, fallback));
    return numberValue > 0 ? numberValue : fallback;
}

function normalizeLevel(value: unknown, fallback: TrainingLevel): TrainingLevel {
    const raw = cleanString(value) as TrainingLevel;
    return VALID_LEVELS.has(raw) ? raw : fallback;
}

function normalizeTemplateStatus(value: unknown, publish: boolean): TemplateStatus {
    if (publish) return "published";
    const raw = cleanString(value) as TemplateStatus;
    return VALID_STATUSES.has(raw) ? raw : "draft";
}

function normalizeTemplateKind(value: unknown): TemplateKind {
    const raw = cleanString(value) as TemplateKind;
    return VALID_TEMPLATE_KINDS.has(raw) ? raw : "fixed";
}

function valueFromParams(actionSet: TrainingPlanImportActionSet, key: string, cnKey: string) {
    const params = asRecord(actionSet.params);
    return actionSet[key as keyof TrainingPlanImportActionSet] ?? params[key] ?? params[cnKey];
}

function normalizeSetPrescriptions(
    value: unknown,
    errors: string[],
    prefix: string,
) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        errors.push(`${prefix}: params.setPrescriptions 必须是数组`);
        return [];
    }

    return value.map((raw, index) => {
        const prescription = asRecord(raw);
        const reps = String(prescription.reps ?? "").trim();
        const restSeconds = normalizeNumber(
            prescription.restSeconds ?? prescription.rest_seconds,
            90,
        );
        if (!reps) errors.push(`${prefix}: 第 ${index + 1} 组缺少 reps`);
        if (!Number.isFinite(restSeconds) || restSeconds <= 0) {
            errors.push(`${prefix}: 第 ${index + 1} 组 restSeconds 必须大于 0`);
        }
        return {
            ...prescription,
            setIndex: index + 1,
            reps,
            intensity: String(prescription.intensity ?? "").trim(),
            targetType: cleanString(prescription.targetType ?? prescription.target_type) || "reps",
            targetUnit: cleanNullableString(prescription.targetUnit ?? prescription.target_unit),
            intensityUnit: cleanNullableString(
                prescription.intensityUnit ?? prescription.intensity_unit,
            ),
            restSeconds,
        };
    });
}

function normalizeActionSet(
    actionSet: TrainingPlanImportActionSet,
    errors: string[],
    prefix: string,
) {
    const actionName = cleanString(
        actionSet.actionName ||
        actionSet.action_name ||
        actionSet.setName ||
        actionSet.set_name,
    );
    if (!actionName) {
        errors.push(`${prefix}: actionName/setName 不能为空`);
    }

    const setsRaw = valueFromParams(actionSet, "sets", "组数");
    const repsRaw = valueFromParams(actionSet, "reps", "次数");
    const restRaw = valueFromParams(actionSet, "rest_seconds", "休息时间");
    const intensityRaw = valueFromParams(actionSet, "intensity", "强度");

    if (setsRaw === undefined || setsRaw === null || String(setsRaw).trim() === "") {
        errors.push(`${prefix}: 缺少组数 sets`);
    }
    if (repsRaw === undefined || repsRaw === null || String(repsRaw).trim() === "") {
        errors.push(`${prefix}: 缺少次数 reps`);
    }
    if (restRaw === undefined || restRaw === null || String(restRaw).trim() === "") {
        errors.push(`${prefix}: 缺少休息 rest_seconds`);
    }
    if (intensityRaw === undefined || intensityRaw === null || String(intensityRaw).trim() === "") {
        errors.push(`${prefix}: 缺少强度 intensity`);
    }

    const itemTypeRaw = cleanString(actionSet.itemType || actionSet.item_type).toUpperCase();
    const itemType = ["STRENGTH", "CARDIO", "DIET", "HABIT"].includes(itemTypeRaw)
        ? itemTypeRaw
        : "STRENGTH";
    const sets = normalizeNumber(setsRaw, 1);
    const reps = String(repsRaw ?? "").trim();
    const restSeconds = normalizeNumber(restRaw, 90);
    const intensity = String(intensityRaw ?? "").trim();
    const rawParams = asRecord(actionSet.params);
    const setPrescriptions = normalizeSetPrescriptions(
        rawParams.setPrescriptions ?? rawParams.set_prescriptions,
        errors,
        prefix,
    );
    const params = {
        ...rawParams,
        sets,
        reps,
        rest_seconds: restSeconds,
        intensity,
        "组数": sets,
        "次数": reps,
        "休息时间": restSeconds,
        "强度": intensity,
        ...(setPrescriptions.length > 0 ? { setPrescriptions } : {}),
    };

    return {
        ...actionSet,
        type: actionSet.type || "no-filter",
        itemType,
        item_type: itemType,
        actionId: "",
        action_id: "",
        actionName,
        action_name: actionName,
        setName: cleanString(actionSet.setName || actionSet.set_name) || actionName,
        set_name: cleanString(actionSet.set_name || actionSet.setName) || actionName,
        sets,
        reps,
        rest_seconds: restSeconds,
        intensity,
        params,
    };
}

function normalizeTrainingDays(days: unknown, errors: string[], planLabel: string) {
    if (!Array.isArray(days) || days.length === 0) {
        errors.push(`${planLabel}: trainingDays 不能为空`);
        return [];
    }

    return days.map((rawDay, index) => {
        const day = asRecord(rawDay) as TrainingPlanImportDay;
        const dayIndex = normalizePositiveInt(day.dayIndex ?? day.day_index, index + 1);
        if (dayIndex !== index + 1) {
            errors.push(`${planLabel}: dayIndex 必须从 1 开始连续，当前第 ${index + 1} 项是 ${dayIndex}`);
        }

        const type: "training" | "rest" = day.type === "rest" ? "rest" : "training";
        const rawActionSets = Array.isArray(day.actionSets)
            ? day.actionSets
            : Array.isArray(day.action_sets)
                ? day.action_sets
                : [];
        if (type === "training" && rawActionSets.length === 0) {
            errors.push(`${planLabel} 第 ${dayIndex} 天: 训练日 actionSets 不能为空`);
        }

        const actionSets = rawActionSets.map((actionSet, actionIndex) =>
            normalizeActionSet(
                actionSet,
                errors,
                `${planLabel} 第 ${dayIndex} 天动作 #${actionIndex + 1}`,
            ),
        );

        return {
            ...day,
            dayIndex,
            type,
            note: cleanString(day.note),
            actionSets,
            actionSetsCount: actionSets.length,
        };
    });
}

function normalizePlanTemplate(
    plan: TrainingPlanTemplateImport,
    index: number,
    publish: boolean,
    errors: string[],
): NormalizedTrainingPlan {
    const label = cleanString(plan.slug) || cleanString(plan.name) || `planTemplates[${index}]`;
    const slug = cleanString(plan.slug);
    const name = cleanString(plan.name);
    const sport = cleanString(plan.sport);
    const goal = cleanString(plan.goal);
    const level = normalizeLevel(plan.level, "intermediate");
    const weeks = normalizePositiveInt(plan.weeks, 4);
    const daysPerWeek = normalizePositiveInt(plan.daysPerWeek, 3);

    if (!slug) errors.push(`${label}: slug 不能为空`);
    if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(slug)) {
        errors.push(`${label}: slug 只能使用小写字母、数字和连字符，且长度 3-101`);
    }
    if (!name) errors.push(`${label}: name 不能为空`);
    if (!sport) errors.push(`${label}: sport 不能为空`);
    if (!goal) errors.push(`${label}: goal 不能为空`);
    if (!VALID_LEVELS.has(plan.level)) {
        errors.push(`${label}: level 必须是 beginner/intermediate/advanced`);
    }

    const trainingDays = normalizeTrainingDays(plan.trainingDays, errors, label);
    const actualTrainingDaysPerWeek = trainingDays.filter((day) => day.type !== "rest").length;
    if (actualTrainingDaysPerWeek !== daysPerWeek) {
        errors.push(`${label}: daysPerWeek=${daysPerWeek}，但 trainingDays 里训练日数量是 ${actualTrainingDaysPerWeek}`);
    }

    const suitableFor = normalizeLevel(plan.suitableFor || plan.level, level);

    return {
        slug,
        name,
        description: cleanNullableString(plan.description),
        sport,
        goal,
        level,
        weeks,
        daysPerWeek,
        equipment: cleanStringArray(plan.equipment),
        tags: cleanStringArray(plan.tags),
        suitableFor,
        audience: cleanNullableString(plan.audience),
        notes: cleanStringArray(plan.notes),
        trainingDays,
        templateKind: normalizeTemplateKind(plan.templateKind),
        parameterSchema: asRecord(plan.parameterSchema),
        actionSlots: Array.isArray(plan.actionSlots) ? plan.actionSlots : [],
        specialtyKey: cleanString(plan.specialtyKey) || "strength_general",
        specialtyLabel: cleanString(plan.specialtyLabel) || "通用力量",
        specialtyPriority: Math.floor(normalizeNumber(plan.specialtyPriority, 800)),
        sortOrder: Math.floor(normalizeNumber(plan.sortOrder, 0)),
        status: normalizeTemplateStatus(plan.status, publish),
    };
}

function normalizeBooks(value: unknown, errors: string[]) {
    if (!Array.isArray(value)) return [];
    return value.map((book, index) => {
        const normalized = book as KnowledgeBookImport;
        if (!cleanString(normalized?.title)) errors.push(`books[${index}]: title 不能为空`);
        if (
            normalized?.content === undefined ||
            normalized?.content === null ||
            (typeof normalized.content === "string" && cleanString(normalized.content) === "")
        ) {
            errors.push(`books[${index}]: content 不能为空`);
        }
        return normalized;
    });
}

function normalizeArticles(value: unknown, errors: string[]) {
    if (!Array.isArray(value)) return [];
    return value.map((article, index) => {
        const normalized = article as KnowledgeArticleImport;
        const nodeType = normalized.nodeType || "article";
        if (!cleanString(normalized?.slug)) errors.push(`articles[${index}]: slug 不能为空`);
        if (!cleanString(normalized?.title)) errors.push(`articles[${index}]: title 不能为空`);
        if (!VALID_NODE_TYPES.has(nodeType)) {
            errors.push(`articles[${index}]: nodeType 必须是 domain/category/topic/article/video`);
        }
        if (
            normalized?.content === undefined ||
            normalized?.content === null ||
            (typeof normalized.content === "string" && cleanString(normalized.content) === "")
        ) {
            errors.push(`articles[${index}]: content 不能为空`);
        }
        return normalized;
    });
}

export function normalizeAdminContentBundle(
    input: AdminContentImportBundle,
    options: { publish: boolean },
): { normalized: NormalizedBundle; errors: string[] } {
    const errors: string[] = [];
    const rawPlans = Array.isArray(input?.planTemplates) ? input.planTemplates : [];
    const planTemplates = rawPlans.map((plan, index) =>
        normalizePlanTemplate(plan, index, options.publish, errors),
    );
    const books = normalizeBooks(input?.books, errors);
    const articles = normalizeArticles(input?.articles, errors);

    if (planTemplates.length === 0 && books.length === 0 && articles.length === 0) {
        errors.push("导入包为空：至少需要 planTemplates、books 或 articles 中的一类内容");
    }

    return {
        normalized: { planTemplates, books, articles },
        errors,
    };
}

function isExternalTrainingPlan(plan: NormalizedTrainingPlan) {
    const provenance = asRecord(plan.parameterSchema?.provenance);
    return plan.tags.some((tag) => tag.startsWith("source:")) ||
        Boolean(cleanString(provenance.source_url || provenance.source_id));
}

function validateExternalPlanPublication(plans: NormalizedTrainingPlan[]) {
    const errors: string[] = [];
    const externalPlans = plans.filter(isExternalTrainingPlan);
    if (externalPlans.length === 0) return errors;

    const rightsBlocked = externalPlans.filter((plan) => {
        const provenance = asRecord(plan.parameterSchema?.provenance);
        const importStatus = cleanString(provenance.import_status).toLowerCase();
        return plan.tags.includes("rights:review-required") || importStatus.includes("pending_rights");
    });
    if (rightsBlocked.length > 0) {
        errors.push(
            `有 ${rightsBlocked.length} 套外部计划尚未完成授权复核，禁止发布：${rightsBlocked
                .slice(0, 8)
                .map((plan) => plan.name)
                .join("、")}${rightsBlocked.length > 8 ? " 等" : ""}`,
        );
    }

    const prescriptionProblems: string[] = [];
    for (const plan of externalPlans) {
        for (const day of plan.trainingDays as any[]) {
            for (const actionSet of day?.actionSets || []) {
                const actionName = cleanString(
                    actionSet?.actionName || actionSet?.action_name || actionSet?.setName,
                );
                if (/^(rest|rest day|休息)$/i.test(actionName)) {
                    prescriptionProblems.push(`${plan.name}: 「${actionName}」不能作为可执行动作`);
                    continue;
                }

                const params = asRecord(actionSet?.params);
                const prescriptions = Array.isArray(params.setPrescriptions)
                    ? params.setPrescriptions
                    : [];
                const expectedSets = normalizePositiveInt(
                    actionSet?.sets ?? params.sets ?? params["组数"],
                    1,
                );
                if (prescriptions.length !== expectedSets) {
                    prescriptionProblems.push(
                        `${plan.name}: ${actionName || "未命名动作"} 的逐组处方 ${prescriptions.length}/${expectedSets}`,
                    );
                }
            }
        }
    }
    if (prescriptionProblems.length > 0) {
        errors.push(
            `外部计划逐组处方未就绪（${prescriptionProblems.length} 处）：${prescriptionProblems
                .slice(0, 12)
                .join("；")}${prescriptionProblems.length > 12 ? "；等" : ""}`,
        );
    }

    return errors;
}

async function validateExternalActionLibraryCoverage(plans: NormalizedTrainingPlan[]) {
    const externalPlans = plans.filter(isExternalTrainingPlan);
    if (externalPlans.length === 0) return [];

    const canonicalRows: any[] = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await (serviceRoleSupabase as any)
            .from("canonical_actions")
            .select("id,name,aliases")
            .range(from, from + 999);
        if (error) {
            return [`发布前读取标准动作库失败: ${error.message}`];
        }
        canonicalRows.push(...(data || []));
        if ((data || []).length < 1000) break;
    }

    const canonicalIdentities = new Set<string>();
    for (const row of canonicalRows) {
        for (const name of [row?.name, ...(Array.isArray(row?.aliases) ? row.aliases : [])]) {
            const identity = normalizeActionNameIdentity(name);
            if (identity) canonicalIdentities.add(identity);
        }
    }

    const missingByIdentity = new Map<string, string>();
    for (const plan of externalPlans) {
        for (const day of plan.trainingDays as any[]) {
            for (const actionSet of day?.actionSets || []) {
                const actionName = cleanString(
                    actionSet?.actionName || actionSet?.action_name || actionSet?.setName,
                );
                const identity = normalizeActionNameIdentity(actionName);
                if (identity && !canonicalIdentities.has(identity)) {
                    missingByIdentity.set(
                        actionIdentityKey(actionSet?.itemType || actionSet?.item_type, actionName),
                        actionName,
                    );
                }
            }
        }
    }

    if (missingByIdentity.size === 0) return [];
    const examples = Array.from(missingByIdentity.values()).slice(0, 30);
    return [
        `外部计划还有 ${missingByIdentity.size} 个动作未进入标准动作库：${examples.join("、")}${
            missingByIdentity.size > examples.length ? " 等" : ""
        }`,
    ];
}

function contentToJson(content: string | Record<string, unknown>, fallbackTags: string[] = []) {
    if (typeof content === "string") {
        return {
            format: "markdown",
            body: content,
            tags: fallbackTags,
            source: "admin-content-import",
        };
    }
    return {
        ...content,
        tags: Array.isArray((content as any).tags) ? (content as any).tags : fallbackTags,
        source: cleanString((content as any).source) || "admin-content-import",
    };
}

async function upsertTrainingPlans(plans: NormalizedTrainingPlan[]) {
    if (plans.length === 0) return [];
    const rows = plans.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        sport: plan.sport,
        goal: plan.goal,
        level: plan.level,
        weeks: plan.weeks,
        days_per_week: plan.daysPerWeek,
        equipment: plan.equipment,
        tags: plan.tags,
        suitable_for: plan.suitableFor,
        audience: plan.audience,
        notes: plan.notes,
        training_days: plan.trainingDays,
        template_kind: plan.templateKind,
        parameter_schema: plan.parameterSchema,
        action_slots: plan.actionSlots,
        specialty_key: plan.specialtyKey,
        specialty_label: plan.specialtyLabel,
        specialty_priority: plan.specialtyPriority,
        status: plan.status,
        sort_order: plan.sortOrder,
        updated_at: new Date().toISOString(),
    }));

    const { data, error } = await (serviceRoleSupabase as any)
        .from("public_training_plan_templates")
        .upsert(rows, { onConflict: "slug" })
        .select("id, slug, name, status");

    if (error) throw new Error(`训练计划导入失败: ${error.message}`);
    return data || [];
}

async function upsertBooks(books: KnowledgeBookImport[], publish: boolean) {
    if (books.length === 0) return [];
    const titles = books.map((book) => cleanString(book.title)).filter(Boolean);
    const { data: existingRows, error: existingError } = await (serviceRoleSupabase as any)
        .from("knowledge_books")
        .select("id,title")
        .in("title", titles);
    if (existingError) throw new Error(`读取书籍失败: ${existingError.message}`);

    const existingByTitle = new Map<string, any>((existingRows || []).map((row: any) => [row.title, row]));
    const results: any[] = [];

    for (const book of books) {
        const title = cleanString(book.title);
        const payload = {
            title,
            author: cleanNullableString(book.author),
            cover_image: cleanNullableString(book.coverImage),
            summary: cleanNullableString(book.summary),
            audio_url: cleanNullableString(book.audioUrl),
            content: contentToJson(book.content),
            is_free: book.isFree ?? true,
            is_published: publish ? true : Boolean(book.isPublished),
            sort_order: Math.floor(normalizeNumber(book.sortOrder, 0)),
            updated_at: new Date().toISOString(),
        };
        const existing = existingByTitle.get(title);
        const query = existing
            ? (serviceRoleSupabase as any).from("knowledge_books").update(payload).eq("id", existing.id)
            : (serviceRoleSupabase as any).from("knowledge_books").insert(payload);
        const { data, error } = await query.select("id,title").single();
        if (error) throw new Error(`书籍 ${title} 导入失败: ${error.message}`);
        results.push(data);
    }

    return results;
}

async function ensureSelfClosure(nodeId: string) {
    await (serviceRoleSupabase as any)
        .from("knowledge_node_closures")
        .upsert({
            ancestor_id: nodeId,
            descendant_id: nodeId,
            depth: 0,
        }, { onConflict: "ancestor_id,descendant_id" });
}

async function upsertArticles(articles: KnowledgeArticleImport[], publish: boolean, adminUserId: string) {
    if (articles.length === 0) return [];
    const slugs = articles.map((article) => cleanString(article.slug)).filter(Boolean);
    const { data: existingRows, error: existingError } = await (serviceRoleSupabase as any)
        .from("knowledge_nodes")
        .select("id,slug")
        .in("slug", slugs);
    if (existingError) throw new Error(`读取文章失败: ${existingError.message}`);

    const existingBySlug = new Map<string, any>((existingRows || []).map((row: any) => [row.slug, row]));
    const results: any[] = [];

    for (const article of articles) {
        const slug = cleanString(article.slug);
        const title = cleanString(article.title);
        const payload = {
            node_type: article.nodeType || "article",
            title,
            slug,
            description: cleanNullableString(article.description),
            icon: cleanNullableString(article.icon),
            content: contentToJson(article.content, cleanStringArray((article.content as any)?.tags)),
            body_region: cleanStringArray(article.bodyRegion),
            equipment: cleanStringArray(article.equipment),
            difficulty: Math.min(5, Math.max(1, normalizePositiveInt(article.difficulty, 2))),
            is_free: article.isFree ?? true,
            is_published: publish ? true : Boolean(article.isPublished),
            sort_order: Math.floor(normalizeNumber(article.sortOrder, 0)),
            updated_at: new Date().toISOString(),
        };
        const existing = existingBySlug.get(slug);
        const query = existing
            ? (serviceRoleSupabase as any).from("knowledge_nodes").update(payload).eq("id", existing.id)
            : (serviceRoleSupabase as any).from("knowledge_nodes").insert({
                ...payload,
                created_by: adminUserId,
                created_at: new Date().toISOString(),
            });
        const { data, error } = await query.select("id,slug,title").single();
        if (error) throw new Error(`文章 ${title} 导入失败: ${error.message}`);
        if (data?.id) await ensureSelfClosure(data.id);
        results.push(data);
    }

    return results;
}

export async function importAdminContentBundle(
    input: AdminContentImportBundle,
    options: { adminUserId: string; publish?: boolean; dryRun?: boolean },
): Promise<AdminContentImportResult> {
    const publish = options.publish ?? false;
    const dryRun = options.dryRun === true;
    const { normalized, errors } = normalizeAdminContentBundle(input, { publish });
    if (publish) {
        errors.push(...validateExternalPlanPublication(normalized.planTemplates));
        errors.push(...await validateExternalActionLibraryCoverage(normalized.planTemplates));
    }
    const resultBase = {
        dryRun,
        errors,
        summary: {
            planTemplates: { validated: normalized.planTemplates.length, upserted: 0 },
            books: { validated: normalized.books.length, upserted: 0 },
            articles: { validated: normalized.articles.length, upserted: 0 },
        },
    };

    if (errors.length > 0) {
        return { ok: false, ...resultBase };
    }
    if (dryRun) {
        return { ok: true, ...resultBase };
    }

    try {
        const planRows = await upsertTrainingPlans(normalized.planTemplates);
        const bookRows = await upsertBooks(normalized.books, publish);
        const articleRows = await upsertArticles(normalized.articles, publish, options.adminUserId);

        return {
            ok: true,
            dryRun,
            errors: [],
            summary: {
                planTemplates: { validated: normalized.planTemplates.length, upserted: planRows.length },
                books: { validated: normalized.books.length, upserted: bookRows.length },
                articles: { validated: normalized.articles.length, upserted: articleRows.length },
            },
            rows: {
                planTemplates: planRows,
                books: bookRows,
                articles: articleRows,
            },
        };
    } catch (error: any) {
        return {
            ok: false,
            ...resultBase,
            errors: [error?.message || "内容导入失败"],
        };
    }
}
