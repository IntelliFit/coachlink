export interface LongPlanInstructionChunk {
    startWeek: number;
    endWeek: number;
    text: string;
}

export interface DetailedLongPlanInstruction {
    globalBrief: string;
    chunks: LongPlanInstructionChunk[];
}

export interface LongPlanCompilationPart {
    week: number;
    dayRange: string;
    text: string;
}

export interface DeterministicLongPlanCompilation {
    script: string;
    actionCount: number;
}

interface WeekAnchor {
    week: number;
    index: number;
}

function parseChineseNumber(raw: string): number | null {
    const normalized = String(raw || "").trim();
    if (/^\d+$/.test(normalized)) return Number(normalized);

    const digitMap: Record<string, number> = {
        零: 0,
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
    };
    if (normalized === "十") return 10;
    const tenIndex = normalized.indexOf("十");
    if (tenIndex >= 0) {
        const tens = tenIndex === 0 ? 1 : digitMap[normalized[tenIndex - 1]];
        const ones = tenIndex === normalized.length - 1 ? 0 : digitMap[normalized[tenIndex + 1]];
        if (tens === undefined || ones === undefined) return null;
        return tens * 10 + ones;
    }
    if (normalized.length === 1 && digitMap[normalized] !== undefined) {
        return digitMap[normalized];
    }
    return null;
}

function hasDetailedMondaySoon(text: string, index: number): boolean {
    const nearby = text.slice(index, index + 500);
    return /(?:^|\n|#)\s*周一(?:\s*[｜|:：]|\s|$)/m.test(nearby);
}

function collectDetailedWeekAnchors(text: string, requestedWeeks: number): WeekAnchor[] {
    const candidates: WeekAnchor[] = [];
    for (const match of text.matchAll(/\bW(\d{1,2})\b/gi)) {
        const week = Number(match[1]);
        const index = match.index ?? -1;
        if (week > 0 && week <= requestedWeeks && index >= 0 && hasDetailedMondaySoon(text, index)) {
            candidates.push({ week, index });
        }
    }
    for (const match of text.matchAll(/第\s*([0-9一二三四五六七八九十两]+)\s*周/g)) {
        const week = parseChineseNumber(match[1]);
        const index = match.index ?? -1;
        if (week && week <= requestedWeeks && index >= 0 && hasDetailedMondaySoon(text, index)) {
            candidates.push({ week, index });
        }
    }

    const anchors: WeekAnchor[] = [];
    let previousIndex = -1;
    for (let week = 1; week <= requestedWeeks; week++) {
        const anchor = candidates
            .filter((candidate) => candidate.week === week && candidate.index > previousIndex)
            .sort((a, b) => a.index - b.index)[0];
        if (!anchor) return [];
        anchors.push(anchor);
        previousIndex = anchor.index;
    }
    return anchors;
}

function buildGlobalBrief(text: string, firstWeekIndex: number): string {
    const preface = text.slice(0, firstWeekIndex).trim();
    if (!preface) return "";

    const basics = preface.slice(0, 900).trim();
    const restHeadingIndex = preface.search(/#\s*四[、.，]?\s*统一休息时间/);
    const restSection = restHeadingIndex >= 0
        ? preface.slice(restHeadingIndex, restHeadingIndex + 900).trim()
        : "";
    return [basics, restSection]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1800);
}

function trimLastWeekAppendix(text: string): string {
    const appendixMatch = text.match(/\s*---(?:\s*\n|\s*#)/);
    return (appendixMatch?.index === undefined ? text : text.slice(0, appendixMatch.index)).trim();
}

function normalizeDetailedPlanLayout(instruction: string): string {
    return String(instruction || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+(?=---\s+)/g, "\n")
        .replace(/\s+(?=#{1,6}\s+)/g, "\n")
        .replace(/\s+(?=\*\s+)/g, "\n")
        .replace(/\s+(?=\d+[.、]\s+)/g, "\n")
        .trim();
}

/**
 * Detects a fully specified long plan (rather than a short request to invent one)
 * and splits it into small, contiguous week groups for reliable LLM compilation.
 */
export function splitDetailedLongPlanInstruction(
    instruction: string,
    requestedWeeks: number,
    chunkSize = 3,
): DetailedLongPlanInstruction | null {
    const normalized = normalizeDetailedPlanLayout(instruction);
    if (requestedWeeks < 8 || normalized.length < 3000) return null;

    const anchors = collectDetailedWeekAnchors(normalized, requestedWeeks);
    if (anchors.length !== requestedWeeks) return null;

    const weekSections = anchors.map((anchor, index) => {
        const nextIndex = anchors[index + 1]?.index ?? normalized.length;
        const section = normalized.slice(anchor.index, nextIndex);
        return {
            week: anchor.week,
            text: index === anchors.length - 1 ? trimLastWeekAppendix(section) : section.trim(),
        };
    });
    if (weekSections.some((section) => !section.text || section.text.length < 30)) return null;

    const chunks: LongPlanInstructionChunk[] = [];
    for (let index = 0; index < weekSections.length; index += chunkSize) {
        const group = weekSections.slice(index, index + chunkSize);
        chunks.push({
            startWeek: group[0].week,
            endWeek: group[group.length - 1].week,
            text: group.map((section) => section.text).join("\n\n"),
        });
    }

    return {
        globalBrief: buildGlobalBrief(normalized, anchors[0].index),
        chunks,
    };
}

export function splitLongPlanWeeksForCompilation(
    plan: DetailedLongPlanInstruction,
): LongPlanCompilationPart[] {
    const parts: LongPlanCompilationPart[] = [];
    for (const chunk of plan.chunks) {
        const week = chunk.startWeek;
        const fourthDayIndex = chunk.text.search(/#{2,4}\s*周四/);
        if (chunk.startWeek === chunk.endWeek && fourthDayIndex > 0) {
            const firstHalf = { week, dayRange: "D1-D3", text: chunk.text.slice(0, fourthDayIndex).trim() };
            const secondHalf = { week, dayRange: "D4-D7", text: chunk.text.slice(fourthDayIndex).trim() };
            parts.push(firstHalf, ...splitDenseSameDayPart(secondHalf));
            continue;
        }
        parts.push({ week, dayRange: "D1-D7", text: chunk.text });
    }
    return parts;
}

function splitDenseSameDayPart(part: LongPlanCompilationPart): LongPlanCompilationPart[] {
    if (countLongPlanActionPrescriptions(part.text) <= 6) return [part];

    const subheadingMatches = Array.from(part.text.matchAll(/^#{2,4}\s+.+$/gm));
    for (let index = 1; index < subheadingMatches.length; index++) {
        const splitIndex = subheadingMatches[index].index ?? -1;
        if (splitIndex <= 0) continue;
        const before = part.text.slice(0, splitIndex).trim();
        const after = part.text.slice(splitIndex).trim();
        const beforeCount = countLongPlanActionPrescriptions(before);
        const afterCount = countLongPlanActionPrescriptions(after);
        if (beforeCount > 0 && beforeCount <= 6 && afterCount > 0 && afterCount <= 6) {
            const dayMatches = Array.from(before.matchAll(/#{2,4}\s*周([一二三四五六日天])/g));
            const lastDay = dayMatches.at(-1)?.[1];
            const dayNumber = dayNumberMap[lastDay as keyof typeof dayNumberMap];
            if (!dayNumber) continue;
            return [
                { ...part, text: before },
                { week: part.week, dayRange: `D${dayNumber}-D${dayNumber}`, text: after },
            ];
        }
    }
    return [part];
}

const dayNumberMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 } as const;

function cleanPrescriptionNote(raw: string): string {
    return String(raw || "")
        .replace(/\*\*/g, "")
        .replace(/^\s*[。；;，,：:]+\s*/, "")
        .replace(/\s+/g, " ")
        .replace(/#/g, "")
        .trim();
}

function formatDeterministicAction(params: {
    name: string;
    sets: number;
    reps: number;
    weight?: number | null;
    note?: string;
}): string {
    const load = typeof params.weight === "number" ? ` @${params.weight}kg` : "";
    const note = cleanPrescriptionNote(params.note || "");
    return addDefaultRestToken(
        `${params.name.trim()} ${params.sets}x${params.reps}${load}${note ? ` #${note}` : ""}`,
    );
}

function parseDeterministicDayActions(section: string): string[] {
    const actions: string[] = [];
    const defaultWeightedAction = "负重引体（底部暂停）";

    for (const rawLine of section.split("\n")) {
        const line = rawLine.trim();
        if (!line || /^#{1,6}\s+/.test(line)) continue;
        const plain = line.replace(/\*\*/g, "");

        const explicit = plain.match(
            /^\*\s+(.+?)[：:]\s*(?:\+?\s*(\d+(?:\.\d+)?)\s*kg\s*[，,]\s*)?(\d+)\s*组\s*(\d+)\s*次/i,
        );
        if (explicit) {
            actions.push(formatDeterministicAction({
                name: explicit[1],
                weight: explicit[2] === undefined ? null : Number(explicit[2]),
                sets: Number(explicit[3]),
                reps: Number(explicit[4]),
                note: plain.slice(explicit[0].length),
            }));
            continue;
        }

        const shorthandVolume = plain.match(
            /^\*\s+\+?\s*(\d+(?:\.\d+)?)\s*kg\s*[，,]\s*(\d+)\s*组\s*(\d+)\s*次/i,
        );
        if (shorthandVolume) {
            actions.push(formatDeterministicAction({
                name: defaultWeightedAction,
                weight: Number(shorthandVolume[1]),
                sets: Number(shorthandVolume[2]),
                reps: Number(shorthandVolume[3]),
                note: plain.slice(shorthandVolume[0].length),
            }));
            continue;
        }

        const shorthandWeightedReps = plain.match(
            /^\*\s+\+?\s*(\d+(?:\.\d+)?)\s*kg\s*[：:]\s*(\d+)\s*次/i,
        );
        if (shorthandWeightedReps) {
            actions.push(formatDeterministicAction({
                name: defaultWeightedAction,
                weight: Number(shorthandWeightedReps[1]),
                sets: 1,
                reps: Number(shorthandWeightedReps[2]),
                note: plain.slice(shorthandWeightedReps[0].length),
            }));
            continue;
        }

        const simpleReps = plain.match(/^\*\s+(.+?)[：:]\s*(\d+)\s*次/i);
        if (simpleReps) {
            actions.push(formatDeterministicAction({
                name: simpleReps[1],
                sets: 1,
                reps: Number(simpleReps[2]),
                note: plain.slice(simpleReps[0].length),
            }));
            continue;
        }

        const testAttempt = plain.match(/^\d+[.、]\s*(.*)$/i);
        const testWeights = testAttempt
            ? Array.from(testAttempt[1].matchAll(/\+\s*(\d+(?:\.\d+)?)\s*kg/gi))
            : [];
        if (testAttempt && testWeights.length > 0) {
            const targetWeight = testWeights.at(-1)!;
            actions.push(formatDeterministicAction({
                name: defaultWeightedAction,
                weight: Number(targetWeight[1]),
                sets: 1,
                reps: 1,
                note: testWeights.length > 1
                    ? testAttempt[1].replace(targetWeight[0], "").trim()
                    : "",
            }));
        }
    }

    return actions;
}

function extractDeterministicDayNote(section: string): string {
    const notes: string[] = [];
    for (const rawLine of section.split("\n")) {
        const line = rawLine.trim();
        if (!line || /^#{1,6}\s+/.test(line) || /^---+$/.test(line)) continue;
        if (parseDeterministicDayActions(line).length > 0) continue;
        const note = cleanPrescriptionNote(line.replace(/^\*\s+/, ""));
        if (note) notes.push(note);
    }
    return notes.join(" ").slice(0, 1200);
}

/**
 * Compiles already fully specified Chinese Markdown plans without asking an LLM
 * to copy their prescriptions. Unsupported layouts return null and use the LLM fallback.
 */
export function compileDetailedLongPlanDeterministically(
    plan: DetailedLongPlanInstruction,
): DeterministicLongPlanCompilation | null {
    const weekScripts: string[] = [];
    let actionCount = 0;

    for (const chunk of plan.chunks) {
        if (chunk.startWeek !== chunk.endWeek) return null;
        const week = chunk.startWeek;
        const headings = Array.from(
            chunk.text.matchAll(/^#{2,4}\s*周([一二三四五六日天](?:\s*[、,，/]\s*周?[一二三四五六日天])*)[^\n]*$/gm),
        );
        if (headings.length === 0) return null;

        const dayScripts = new Map<number, string[]>();
        for (let index = 0; index < headings.length; index++) {
            const heading = headings[index];
            const start = heading.index ?? 0;
            const end = headings[index + 1]?.index ?? chunk.text.length;
            const section = chunk.text.slice(start, end).trim();
            const days = Array.from(heading[1].matchAll(/[一二三四五六日天]/g))
                .map((match) => dayNumberMap[match[0] as keyof typeof dayNumberMap]);
            const actions = parseDeterministicDayActions(section);
            const dayNote = extractDeterministicDayNote(section);
            if (days.length === 0 || (days.length > 1 && actions.length > 0)) return null;
            const isRest = /主动恢复|完全休息/.test(heading[0]) || actions.length === 0;

            for (const day of days) {
                if (dayScripts.has(day)) return null;
                dayScripts.set(
                    day,
                    isRest
                        ? [`D${day} off${dayNote ? ` #${dayNote}` : ""}`]
                        : [`D${day}`, ...(dayNote ? [`!${dayNote}`] : []), ...actions],
                );
            }
            if (!isRest) actionCount += actions.length;
        }

        for (let day = 1; day <= 7; day++) {
            if (!dayScripts.has(day)) dayScripts.set(day, [`D${day} off`]);
        }
        weekScripts.push(
            [`W${week}`, ...Array.from(dayScripts.entries())
                .sort(([a], [b]) => a - b)
                .flatMap(([, lines]) => lines)].join("\n"),
        );
    }

    const expectedActions = plan.chunks.reduce(
        (sum, chunk) => sum + countLongPlanActionPrescriptions(chunk.text),
        0,
    );
    if (actionCount !== expectedActions) return null;
    return { script: weekScripts.join("\n\n"), actionCount };
}

function addDefaultRestToken(line: string): string {
    if (!/\d+(?:-\d+)?x\d+/i.test(line) || /(?:^|\s)r\d+(?:\s|$)/i.test(line)) return line;
    const appendRest = (seconds: number) => {
        const [body, ...noteParts] = line.split("#");
        const note = noteParts.join("#").trim();
        return `${body.trim()} r${seconds}${note ? ` #${note}` : ""}`;
    };
    if (/超负荷离心/.test(line)) return appendRest(300);
    if (/爆发|自重高位|海豹划船|锤式弯举|自重引体/.test(line)) return appendRest(150);
    if (/负重引体|离心负重引体|暂停负重引体|引体向上/.test(line)) return appendRest(270);
    return line;
}

function splitSlashJoinedActionLines(line: string): string[] {
    const fragments = line.split(/\s*\/\s*/).map((item) => item.trim()).filter(Boolean);
    if (fragments.length < 2 || fragments.filter((item) => /\d+(?:-\d+)?x\d+/i.test(item)).length < 2) {
        return [line];
    }

    const expanded: string[] = [];
    let inheritedActionName = "";
    for (const fragment of fragments) {
        const volumeIndex = fragment.search(/\b\d+(?:-\d+)?x\d+\b/i);
        if (volumeIndex < 0) continue;
        const explicitName = fragment.slice(0, volumeIndex).trim();
        if (explicitName) inheritedActionName = explicitName;
        if (!inheritedActionName) return [line];
        expanded.push(`${inheritedActionName} ${fragment.slice(volumeIndex).trim()}`);
    }
    return expanded.length >= 2 ? expanded : [line];
}

export function countLongPlanActionPrescriptions(text: string): number {
    return String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((rawLine) => {
            const line = rawLine.trim();
            if (/^[-*]\s+/.test(line)) {
                return /\d+\s*组\s*\d+\s*次/.test(line) || /(?:^|[：:])\s*\*{0,2}\d+\s*次/.test(line);
            }
            return /^\d+[.、]\s+.*\+\s*\d+(?:\.\d+)?\s*kg/i.test(line);
        })
        .length;
}

/** Normalizes concise Claude output into the strict line-oriented PlanScript grammar. */
export function normalizeCompiledPlanScriptPart(raw: string, week: number): string {
    const normalized = String(raw || "")
        .replace(/\r\n/g, "\n")
        .replace(/```(?:plan|planscript|text)?/gi, "")
        .replace(/```/g, "")
        .replace(/\*\*/g, "")
        .trim();
    const weekMatch = new RegExp(`(?:^|\\n)\\s*W${week}\\b`, "i").exec(normalized);
    const candidate = weekMatch ? normalized.slice(weekMatch.index).trim() : normalized;
    const output: string[] = [];
    let currentDay: number | null = null;

    for (const rawLine of candidate.split("\n")) {
        let line = rawLine.trim().replace(/^#{1,6}\s*/, "").replace(/^[-*]\s+/, "");
        if (!line) continue;
        if (/^(?:说明|备注)[:：]/.test(line)) continue;

        const compactWeekDay = line.match(new RegExp(`^W${week}\\s*D([1-7])(.*)$`, "i"));
        if (compactWeekDay) {
            if (!output.some((item) => item.toUpperCase() === `W${week}`)) output.push(`W${week}`);
            line = `D${compactWeekDay[1]}${compactWeekDay[2] || ""}`.trim();
        }

        const weekLine = line.match(new RegExp(`^W${week}\\b[：:]?\\s*(.*)$`, "i"));
        if (weekLine) {
            if (!output.some((item) => item.toUpperCase() === `W${week}`)) output.push(`W${week}`);
            line = weekLine[1].trim();
            if (!line) continue;
        }

        const dayLine = line.match(/^D([1-7])\s*[：:]?(?:\s+(off))?(?:\s+(.+))?$/i);
        if (dayLine) {
            const day = Number(dayLine[1]);
            if (dayLine[2]) {
                if (currentDay !== day) output.push(`D${day} off`);
                currentDay = day;
                continue;
            }
            if (currentDay !== day) output.push(`D${day}`);
            currentDay = day;
            line = dayLine[3]?.trim() || "";
            if (!line) continue;
        }

        const fragments = line.split(/\s*[;；|]\s*/).filter(Boolean);
        for (let fragment of fragments) {
            fragment = fragment.trim().replace(/^[-*]\s+/, "").replace(/\s+@0kg\b/i, "");
            if (!fragment) continue;
            if (/^\/\//.test(fragment)) {
                output.push(`!${fragment.replace(/^\/+\s*/, "")}`);
                continue;
            }
            if (!/\d+(?:-\d+)?x\d+/i.test(fragment)) {
                output.push(`!${fragment.replace(/^#+\s*/, "")}`);
                continue;
            }
            for (const actionLine of splitSlashJoinedActionLines(fragment)) {
                output.push(addDefaultRestToken(actionLine));
            }
        }
    }

    if (!output.some((line) => line.toUpperCase() === `W${week}`)) output.unshift(`W${week}`);
    return output.join("\n").trim();
}

export function mergeCompiledPlanScriptParts(parts: Array<{ week: number; script: string }>): string {
    const grouped = new Map<number, string[]>();
    for (const part of parts) {
        const lines = String(part.script || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => line.toUpperCase() !== `W${part.week}`);
        grouped.set(part.week, [...(grouped.get(part.week) || []), ...lines]);
    }

    return Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, lines]) => {
            const seenDays = new Set<number>();
            const mergedLines = lines.filter((line) => {
                const dayMatch = line.match(/^D([1-7])(?:\s+off)?$/i);
                if (!dayMatch) return true;
                const day = Number(dayMatch[1]);
                if (seenDays.has(day)) return false;
                seenDays.add(day);
                return true;
            });
            return [`W${week}`, ...mergedLines].join("\n");
        })
        .join("\n\n")
        .trim();
}
