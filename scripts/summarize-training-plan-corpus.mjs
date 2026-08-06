import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import readline from "node:readline";

const output = resolve(process.argv[2] || join("artifacts", "training-plan-corpus"));
const sourceIds = ["liftvault", "boostcamp", "fitness-wiki", "catalyst-athletics", "crossfit"];

function increment(map, value) {
    const key = String(value || "").trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit = 20) {
    return [...map.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([label, count]) => ({ label, count }));
}

function csvCell(value) {
    const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
    return `"${text.replaceAll("\"", "\"\"")}"`;
}

function normalizeTitle(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\b(20\d{2}|spreadsheet|template|workout|training|program|programme|plan|routine|free)\b/g, " ")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function forEachJsonl(path, visitor) {
    let count = 0;
    const input = createReadStream(path, { encoding: "utf8" });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        await visitor(row, count);
        count += 1;
    }
    return count;
}

async function fileSize(path) {
    try {
        return (await stat(path)).size;
    } catch (error) {
        if (error?.code === "ENOENT") return 0;
        throw error;
    }
}

function planCatalogRow(record) {
    return {
        source_id: record.source_id,
        catalog_kind: record.catalog_kind || record.record_kind || "reference_page",
        title: record.title || "",
        author: record.author || "",
        source_url: record.source_url,
        weeks: record.weeks_count || "",
        days_per_week: record.days_per_week || "",
        goals: record.goals || [],
        difficulties: record.difficulties || [],
        equipment: record.equipment || [],
        popularity_count: record.popularity_count || 0,
        asset_count: record.plan_asset_links?.length || 0,
        rights_status: record.rights_status,
        import_status: record.import_status,
    };
}

function reviewScore(row) {
    let score = 0;
    if (row.catalog_kind === "coach") score += 1_000_000;
    if (row.source_id === "liftvault" && row.asset_count > 0) score += 500_000;
    if (row.catalog_kind === "community") score += 100_000;
    score += Math.min(99_999, Number(row.popularity_count || 0));
    score += Math.min(10_000, Number(row.asset_count || 0) * 1_000);
    if (row.weeks) score += 100;
    if (row.days_per_week) score += 50;
    return score;
}

async function main() {
    const catalog = [];
    const titlesBySource = Object.fromEntries(sourceIds.map((sourceId) => [sourceId, new Map()]));
    const report = {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        output,
        sources: {},
        boostcamp_structure: {
            coach_programs: 0,
            community_programs: 0,
            programs_with_variations: 0,
            variations: 0,
            programmed_weeks: 0,
            workout_entries: 0,
            exercise_entries: 0,
            prescribed_sets: 0,
            goals: new Map(),
            difficulties: new Map(),
            equipment: new Map(),
        },
        liftvault_assets: {
            plan_pages_with_assets: 0,
            unique_asset_links: 0,
            downloaded: 0,
            reference_only: 0,
            failed_or_skipped: 0,
            downloaded_bytes: 0,
            file_types: new Map(),
        },
        cross_source_title_matches: [],
    };

    for (const sourceId of sourceIds) {
        const plansPath = join(output, "sources", sourceId, "plans.jsonl");
        const failuresPath = join(output, "sources", sourceId, "failures.jsonl");
        const failureCount = await forEachJsonl(failuresPath, () => {});
        const planCount = await forEachJsonl(plansPath, (record) => {
            catalog.push(planCatalogRow(record));
            const normalizedTitle = normalizeTitle(record.title);
            if (normalizedTitle) {
                const existing = titlesBySource[sourceId].get(normalizedTitle) || [];
                existing.push(record.title);
                titlesBySource[sourceId].set(normalizedTitle, existing);
            }

            if (sourceId === "liftvault" && record.plan_asset_links?.length) {
                report.liftvault_assets.plan_pages_with_assets += 1;
            }

            if (sourceId !== "boostcamp") return;
            if (record.catalog_kind === "coach") report.boostcamp_structure.coach_programs += 1;
            if (record.catalog_kind === "community") report.boostcamp_structure.community_programs += 1;
            for (const goal of record.goals || []) increment(report.boostcamp_structure.goals, goal);
            for (const difficulty of record.difficulties || []) increment(report.boostcamp_structure.difficulties, difficulty);
            for (const equipment of record.equipment || []) increment(report.boostcamp_structure.equipment, equipment);

            const content = record.plan_content || {};
            const variations = Array.isArray(content.variations) ? content.variations : [];
            if (variations.length) report.boostcamp_structure.programs_with_variations += 1;
            report.boostcamp_structure.variations += variations.length;

            const contentGroups = variations.length
                ? variations
                : [{ weeks: content.weeks || [], workouts: content.workouts || [] }];
            for (const group of contentGroups) {
                report.boostcamp_structure.programmed_weeks += group.weeks?.length || 0;
                const workouts = Array.isArray(group.workouts) ? group.workouts : [];
                report.boostcamp_structure.workout_entries += workouts.length;
                for (const workout of workouts) {
                    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
                    report.boostcamp_structure.exercise_entries += exercises.length;
                    for (const exercise of exercises) {
                        report.boostcamp_structure.prescribed_sets += exercise.sets?.length || 0;
                    }
                }
            }
        });
        report.sources[sourceId] = {
            records: planCount,
            failures: failureCount,
            plans_jsonl_bytes: await fileSize(plansPath),
        };
    }

    const assetUrls = new Set();
    await forEachJsonl(join(output, "sources", "liftvault", "plans.jsonl"), (record) => {
        for (const url of record.plan_asset_links || []) assetUrls.add(url);
    });
    report.liftvault_assets.unique_asset_links = assetUrls.size;

    await forEachJsonl(join(output, "asset-index.jsonl"), (asset) => {
        if (asset.status === "downloaded") {
            report.liftvault_assets.downloaded += 1;
            report.liftvault_assets.downloaded_bytes += Number(asset.bytes || 0);
            const extension = asset.local_path?.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || ".unknown";
            increment(report.liftvault_assets.file_types, extension);
        } else if (asset.status === "reference_only") {
            report.liftvault_assets.reference_only += 1;
        } else {
            report.liftvault_assets.failed_or_skipped += 1;
        }
    });

    for (const [sourceId, sourceTitles] of Object.entries(titlesBySource)) {
        if (sourceId === "liftvault") continue;
        for (const [normalizedTitle, titles] of sourceTitles) {
            const liftTitles = titlesBySource.liftvault.get(normalizedTitle);
            if (!liftTitles) continue;
            report.cross_source_title_matches.push({
                normalized_title: normalizedTitle,
                liftvault_titles: [...new Set(liftTitles)],
                [`${sourceId}_titles`]: [...new Set(titles)],
            });
        }
    }

    report.boostcamp_structure.goals = topEntries(report.boostcamp_structure.goals);
    report.boostcamp_structure.difficulties = topEntries(report.boostcamp_structure.difficulties);
    report.boostcamp_structure.equipment = topEntries(report.boostcamp_structure.equipment);
    report.liftvault_assets.file_types = topEntries(report.liftvault_assets.file_types);
    report.cross_source_title_matches.sort((left, right) => left.normalized_title.localeCompare(right.normalized_title));

    const columns = [
        "source_id",
        "catalog_kind",
        "title",
        "author",
        "source_url",
        "weeks",
        "days_per_week",
        "goals",
        "difficulties",
        "equipment",
        "popularity_count",
        "asset_count",
        "rights_status",
        "import_status",
    ];
    const catalogCsv = [
        columns.map(csvCell).join(","),
        ...catalog
            .sort((left, right) => left.source_id.localeCompare(right.source_id) || left.title.localeCompare(right.title))
            .map((row) => columns.map((column) => csvCell(row[column])).join(",")),
    ].join("\n");
    const reviewQueue = [...catalog].sort((left, right) => reviewScore(right) - reviewScore(left) || left.title.localeCompare(right.title));
    const reviewCsv = [
        ["review_score", ...columns].map(csvCell).join(","),
        ...reviewQueue.map((row) => [reviewScore(row), ...columns.map((column) => row[column])].map(csvCell).join(",")),
    ].join("\n");

    const totalRecords = Object.values(report.sources).reduce((sum, source) => sum + source.records, 0);
    const totalBytes = Object.values(report.sources).reduce((sum, source) => sum + source.plans_jsonl_bytes, 0);
    const markdown = `# CoachLink 训练计划语料质量报告

- 计划/目录记录：${totalRecords}
- JSONL 原始结构数据：${(totalBytes / 1024 / 1024).toFixed(1)} MB
- 抓取失败：${Object.values(report.sources).reduce((sum, source) => sum + source.failures, 0)}
- 生成时间：${report.generated_at}

## 来源

| 来源 | 记录 | 失败 | 数据大小 |
|---|---:|---:|---:|
${Object.entries(report.sources).map(([sourceId, source]) => `| ${sourceId} | ${source.records} | ${source.failures} | ${(source.plans_jsonl_bytes / 1024 / 1024).toFixed(1)} MB |`).join("\n")}

## Boostcamp 结构完整度

- 教练计划：${report.boostcamp_structure.coach_programs}
- 社区计划：${report.boostcamp_structure.community_programs}
- 有结构化变体的计划：${report.boostcamp_structure.programs_with_variations}
- 计划变体：${report.boostcamp_structure.variations}
- 已编排训练周：${report.boostcamp_structure.programmed_weeks}
- 训练课条目：${report.boostcamp_structure.workout_entries}
- 动作条目：${report.boostcamp_structure.exercise_entries}
- 处方组数：${report.boostcamp_structure.prescribed_sets}

## Lift Vault 公开附件

- 含公开附件的计划页：${report.liftvault_assets.plan_pages_with_assets}
- 唯一附件链接：${report.liftvault_assets.unique_asset_links}
- 成功下载：${report.liftvault_assets.downloaded}
- 仅保留链接：${report.liftvault_assets.reference_only}
- 失败/跳过：${report.liftvault_assets.failed_or_skipped}
- 下载体积：${(report.liftvault_assets.downloaded_bytes / 1024 / 1024).toFixed(1)} MB

## 人工整理入口

- \`catalog.csv\`：全部来源的平铺目录。
- \`review-queue.csv\`：教练计划、带公开附件的 Lift Vault 计划、热门社区计划优先。
- 原始结构只用于内部整理；公开发布或商业化前仍需逐条版权/授权复核。
`;

    await mkdir(output, { recursive: true });
    await writeFile(join(output, "QUALITY_REPORT.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(join(output, "QUALITY_REPORT.md"), markdown, "utf8");
    await writeFile(join(output, "catalog.csv"), `${catalogCsv}\n`, "utf8");
    await writeFile(join(output, "review-queue.csv"), `${reviewCsv}\n`, "utf8");
    console.log(markdown);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
