/**
 * Utilities for "Smart Import" plan text parsing.
 *
 * Goal: make action-name extraction robust by separating intensity/rest/set tokens
 * from the exercise name and filtering obvious non-action lines.
 *
 * NOTE: Only used in parse-actions (stage 1). Stage 2 (parse-template) still uses
 * the original user text to preserve intensity details.
 */

const INTENSITY_SUFFIX_RE =
    // Examples: "5RM", "10rm", "80%1RM", "70%rm", "100kg", "RPE9"
    /(?:@?\s*)?(?:\d+(?:\.\d+)?)\s*(?:(?:%|％)\s*(?:1RM|rm|RM)?|kg|公斤|lbs?|LBs?|RM|rm|RPE\s*\d+(?:\.\d+)?|rpe\s*\d+(?:\.\d+)?)/i;

const REST_SUFFIX_RE =
    // Examples: "组休 3分", "组间歇30秒", "组间休息 90s"
    /(组休|组间歇|组间休息)\s*\d+(?:\.\d+)?\s*(分|分钟|秒|s|S)\s*$/;

const SET_REP_SUFFIX_RE =
    // Examples: "3×3", "5x4", "4*8"
    /\s*\d+\s*[x×*]\s*\d+\s*$/;

const CN_SET_COUNT_SUFFIX_RE =
    // Examples: "三组", "五组", "10组"
    /\s*[一二三四五六七八九十两\d]+\s*组\s*$/;

const CN_REP_COUNT_SUFFIX_RE =
    // Examples: "30个", "40次"
    /\s*\d+\s*(个|次)\s*$/;

const LEADING_WEIGHT_RE =
    // Examples: "10公斤引体", "5kg 半程引体", "2.5kg引体"
    /^\s*\d+(?:\.\d+)?\s*(kg|公斤|lbs?|LBs?)\s*/i;

/**
 * Normalize text BEFORE LLM action extraction:
 * - Add spaces between exercise name and tokens like "5RM/70%/100kg/RPE9"
 * - Reduce "glued" words that often make the model treat intensity as part of name
 */
export function normalizeTextForActionExtraction(text: string): string {
    if (!text) return "";
    let t = text;

    // Normalize common punctuation variants
    t = t.replace(/\t/g, " ").replace(/\u3000/g, " ");

    // Insert a space between Chinese/letters and intensity tokens (e.g. "负重引体5RM" -> "负重引体 5RM")
    // Keep it conservative: only for typical intensity tokens.
    t = t.replace(
        /([\u4e00-\u9fffA-Za-z])(\d+(?:\.\d+)?\s*(?:RM|rm|RPE|rpe|%|％|kg|公斤|lbs?|LBs?))/g,
        "$1 $2",
    );

    // Insert a space between "%rm" like "70%rm" when glued to previous char
    t = t.replace(
        /([\u4e00-\u9fffA-Za-z])(\d+(?:\.\d+)?\s*(?:%|％)\s*(?:1RM|rm|RM)?)/g,
        "$1 $2",
    );

    // Split "然后" between two CJK chars into a new line to encourage separate action extraction.
    // Example: "自重引体力竭然后双手悬垂力竭" -> "自重引体力竭\n双手悬垂力竭"
    t = t.replace(/([\u4e00-\u9fff])然后([\u4e00-\u9fff])/g, "$1\n$2");

    return t;
}

/**
 * Post-process action name returned by LLM:
 * - Remove trailing intensity / rest / set-rep tokens
 * - Remove parentheses content
 * - Trim redundant suffix words like "力竭/累积" when they are plan instructions
 */
export function sanitizeActionName(name: string): string {
    const original = (name ?? "").trim();
    if (!original) return "";

    let n = original;

    // Remove brackets content (often contains intensity/notes)
    n = n.replace(/[（(][^）)]*[）)]/g, " ").trim();

    // Remove leading instruction prefixes
    n = n.replace(
        /^(备注|说明)\s*[:：]\s*/g,
        "",
    ).trim();
    n = n.replace(
        /^(同等数量|每组|然后|循环|测试新极限|第一组|第二组|第三组|第[一二三四五六七八九十两\d]+组)\s*/g,
        "",
    ).trim();

    // Handle "累积..." patterns: keep only the action part before "累积"
    // Examples: "折刀撑累积30个" -> "折刀撑"; "10公斤引体累积（极限个数×5）个" -> "10公斤引体"
    if (n.includes("累积")) {
        n = n.split("累积")[0].trim();
    }

    // Remove trailing rest descriptions
    n = n.replace(REST_SUFFIX_RE, "").trim();

    // Remove trailing RPE like "RPE9"
    n = n.replace(/\s*RPE\s*\d+(?:\.\d+)?\s*$/i, "").trim();

    // Remove trailing intensity tokens like "5RM/70%/100kg"
    // Repeat a few times because some names may end with multiple tokens.
    for (let i = 0; i < 3; i++) {
        const before = n;
        n = n.replace(new RegExp(`\\s*${INTENSITY_SUFFIX_RE.source}\\s*$`, "i"), "").trim();
        if (n === before) break;
    }

    // Remove trailing set-rep patterns
    n = n.replace(SET_REP_SUFFIX_RE, "").trim();
    n = n.replace(CN_SET_COUNT_SUFFIX_RE, "").trim();
    n = n.replace(CN_REP_COUNT_SUFFIX_RE, "").trim();

    // Remove obvious instruction suffixes if they appear at the end
    n = n.replace(/\s*(交替换手|交替)?力竭\s*$/, "").trim();
    n = n.replace(/\s*累积\s*$/, "").trim();
    n = n.replace(/\s*然后\s*$/, "").trim();

    // Special: leading weight prefix is not part of action name
    // If it's a pull-up variant like "10公斤引体", map to "负重引体" to match common libraries.
    if (LEADING_WEIGHT_RE.test(n)) {
        const withoutWeight = n.replace(LEADING_WEIGHT_RE, "").trim();
        if (withoutWeight.includes("半程引体")) {
            n = "半程引体";
        } else if (withoutWeight.includes("引体")) {
            n = "负重引体";
        } else {
            n = withoutWeight;
        }
    }

    // Collapse spaces
    n = n.replace(/\s+/g, " ").trim();

    return n || original;
}

/**
 * Heuristic filter for lines that are almost surely NOT exercise names.
 * This is intentionally conservative: we only drop very obvious non-actions.
 */
export function isLikelyNonActionName(name: string): boolean {
    const n = (name ?? "").trim();
    if (!n) return true;

    // Rest / headings
    if (/^(休|休息|休一天|休两天|休三天|休四天|休五天)/.test(n)) return true;
    if (/^W\d+D\d+/i.test(n)) return true;

    // Pure instruction phrases
    if (/^(每组|第一组|第二组|第三组|循环|然后|同等数量|测试新极限)/.test(n)) return true;
    if (/^(组休|组间歇|组间休息)\s*\d+/i.test(n)) return true;
    if (/^RPE\s*\d+/i.test(n)) return true;

    // If it contains no CJK letters and no alphabet letters, it's likely garbage
    if (!/[\u4e00-\u9fffA-Za-z]/.test(n)) return true;

    // Very short generic tokens
    if (n.length <= 1) return true;

    return false;
}

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the first original line that likely describes this action.
 * Used to decide whether reps were explicitly written.
 */
export function findFirstLineForAction(text: string, actionName: string): string | null {
    const t = (text ?? "").split(/\r?\n/);
    const name = (actionName ?? "").trim();
    if (!name) return null;

    const re = new RegExp(escapeRegExp(name));
    for (const line of t) {
        const s = line.trim();
        if (!s) continue;
        if (re.test(s)) return s;
    }
    return null;
}

/**
 * Whether a line contains explicit reps information.
 * If false, we should avoid guessing reps (e.g. don't turn "12RM" into "12次").
 */
export function lineHasExplicitReps(line: string): boolean {
    const s = (line ?? "").trim();
    if (!s) return false;

    // Common explicit forms
    // - "4x8" / "4×8" / "4*8"
    if (/\d+\s*[x×*＊]\s*\d+/i.test(s)) return true;
    // - "4组*4次" / "4 组 × 4 次" / "3组8次"
    if (/\d+\s*组\s*(?:[x×*＊]\s*)?\d+\s*(次|个)/i.test(s)) return true;
    // - "每组10个/每组 10 次"
    if (/每组\s*\d+\s*(次|个)?/i.test(s)) return true;
    // - "… * 5 次" / "… × 5 个" (常见于“动作 * 次数”的写法，未必写组数，通常等价于 1 组)
    if (/[x×*＊]\s*\d+\s*(次|个)/i.test(s)) return true;
    // - "10次 / 10个"（注意：中文场景里 \b 边界不可靠，不能用）
    if (/\d+\s*(次|个)/i.test(s)) return true;
    if (/[一二三四五六七八九十两]+\s*(次|个)/.test(s)) return true; // 十次

    // If it says failure / time record only, treat as not explicit reps
    if (/记录时间|计时|维持|悬吊|吊杠/.test(s)) return false;
    if (/力竭/.test(s)) return false;

    return false;
}

const ALLOWED_STRENGTH_ATTRS = new Set([
    "组数",
    "次数",
    "强度",
    "休息时间",
    "持续时间",
]);

/**
 * Normalize attrs returned by LLM/user into the canonical attr set.
 * Unknown attrs are dropped.
 */
export function normalizeStrengthAttrs(attrs: unknown): string[] {
    const list = Array.isArray(attrs) ? attrs : [];
    const mapped = list
        .map((x) => String(x ?? "").trim())
        .map((a) => {
            if (!a) return "";
            // Common synonyms
            if (a === "时间" || a === "时长" || a === "时长(秒)" || a === "计时") return "持续时间";
            if (a === "休息" || a === "组间" || a === "间歇") return "休息时间";
            if (a === "次数(reps)" || a === "reps") return "次数";
            if (a === "组数(sets)" || a === "sets") return "组数";
            if (a === "强度(RM)" || a === "RM") return "强度";
            return a;
        })
        .filter((a) => ALLOWED_STRENGTH_ATTRS.has(a));

    // Keep stable order
    const order = ["组数", "次数", "持续时间", "强度", "休息时间"];
    const uniq = Array.from(new Set(mapped));
    uniq.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return uniq;
}

function isTimeBasedStrengthActionName(name: string): boolean {
    const n = (name ?? "").trim();
    if (!n) return false;

    // Holds / isometrics / timed tasks
    if (/悬挂|悬垂|吊杠|死挂|支撑|平板支撑|侧桥|桥式|倒立|靠墙静蹲|墙坐|静蹲|静止|保持|维持|计时/.test(n)) {
        return true;
    }

    // Carries / walks often track time/duration in strength programming
    if (/农夫走|农夫行走|行走|负重行走|熊爬|爬行/.test(n)) {
        return true;
    }

    return false;
}

function looksLikeLoadedStrengthMovement(name: string): boolean {
    const n = (name ?? "").trim();
    if (!n) return false;
    // Heuristic: common loaded implement words / typical barbell-dumbbell lifts
    return /(杠铃|哑铃|壶铃|器械|史密斯|腿举|推举|卧推|深蹲|硬拉|划船|下拉|推|举|弯举|伸展|挺举|抓举)/.test(
        n,
    );
}

/**
 * Infer strength attrs from action name and flags.
 * Goal: avoid the "everything is sets × reps" default.
 */
export function inferStrengthAttrs(params: {
    name: string;
    needsAutoCompute?: boolean;
    llmAttrs?: unknown;
}): string[] {
    const name = (params.name ?? "").trim();
    const llmNormalized = normalizeStrengthAttrs(params.llmAttrs);

    // If LLM already indicates duration, treat as timed.
    const durationIndicated = llmNormalized.includes("持续时间");
    const timed = durationIndicated || isTimeBasedStrengthActionName(name);

    if (timed) {
        // Timed strength: sets + duration + rest
        return ["组数", "持续时间", "休息时间"];
    }

    // Default strength: sets + reps + rest (+ intensity when appropriate)
    const base: string[] = ["组数", "次数", "休息时间"];
    const shouldHaveIntensity =
        Boolean(params.needsAutoCompute) || looksLikeLoadedStrengthMovement(name);
    if (shouldHaveIntensity) base.splice(2, 0, "强度"); // before rest
    return base;
}

/**
 * Normalize action name for matching/comparison.
 * - Uses sanitizeActionName to remove intensity-like suffix
 * - Removes spaces and common punctuation
 * - Lowercases latin characters
 */
export function normalizeActionNameForMatch(name: string): string {
    const s = sanitizeActionName(name ?? "");
    return (s ?? "")
        .trim()
        .toLowerCase()
        // remove spaces
        .replace(/\s+/g, "")
        // remove common punctuation/symbols that often appear in names
        .replace(/[·•，,。\.、\/\\\-—_:+=~`'"“”‘’【】\[\]{}（）()<>《》!！?？]/g, "");
}

function makeBigrams(input: string): string[] {
    const s = input ?? "";
    if (!s) return [];
    if (s.length === 1) return [s];
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
}

/**
 * Dice coefficient over bigrams (works well for CJK strings too).
 * Returns a score in [0, 1].
 */
function diceCoefficient(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = makeBigrams(a);
    const B = makeBigrams(b);
    if (A.length === 0 || B.length === 0) return 0;

    const counts = new Map<string, number>();
    for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);

    let intersection = 0;
    for (const g of B) {
        const c = counts.get(g) ?? 0;
        if (c > 0) {
            intersection += 1;
            counts.set(g, c - 1);
        }
    }
    return (2 * intersection) / (A.length + B.length);
}

export interface ExistingActionLite {
    id: string;
    name: string;
}

/**
 * Find best existing action match for an extracted name.
 * Intentionally "reuse-friendly": prefers matching to existing actions when similarity is high.
 */
export function findBestExistingActionMatch(
    extractedName: string,
    existingActions: ExistingActionLite[],
): { id: string; name: string; score: number } | null {
    const n = normalizeActionNameForMatch(extractedName);
    if (!n) return null;

    // Very short names are too ambiguous: only allow exact/substring matches.
    const isTooShort = n.length <= 2;

    let best: { id: string; name: string; score: number } | null = null;
    for (const a of existingActions || []) {
        const an = normalizeActionNameForMatch(a.name);
        if (!an) continue;

        // Exact normalized match is strongest.
        if (an === n) {
            return { id: a.id, name: a.name, score: 1 };
        }

        let score = 0;
        // Substring bonus helps map abbreviations like "锤式" -> "锤式弯举"
        if (an.includes(n) || n.includes(an)) {
            const minLen = Math.min(an.length, n.length);
            const maxLen = Math.max(an.length, n.length);
            // Larger overlap gets a higher base
            score = Math.max(score, 0.7 + minLen / Math.max(1, maxLen) * 0.3);
        }

        if (!isTooShort) {
            score = Math.max(score, diceCoefficient(n, an));
        }

        if (!best || score > best.score) {
            best = { id: a.id, name: a.name, score };
        }
    }

    if (!best) return null;

    // Threshold: be generous enough to avoid duplicate-new actions,
    // but still avoid obviously wrong mappings.
    const threshold = isTooShort ? 0.85 : 0.78;
    return best.score >= threshold ? best : null;
}

