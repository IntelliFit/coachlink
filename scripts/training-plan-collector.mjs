import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
    mkdir,
    readFile,
    rename,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DEFAULT_USER_AGENT = "CoachLinkTrainingPlanCollector/0.1 (+https://coachlink.fit)";
const DEFAULT_OUTPUT = resolve("artifacts", "training-plan-corpus");
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function parseArgs(argv) {
    const args = {
        sources: ["liftvault", "boostcamp", "fitness-wiki"],
        output: DEFAULT_OUTPUT,
        downloadAssets: false,
        concurrency: 6,
        maxPlans: 0,
        maxAssets: 0,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === "--sources") args.sources = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
        else if (value === "--output") args.output = resolve(argv[++index]);
        else if (value === "--download-assets") args.downloadAssets = true;
        else if (value === "--concurrency") args.concurrency = Math.max(1, Number(argv[++index]) || 1);
        else if (value === "--max-plans") args.maxPlans = Math.max(0, Number(argv[++index]) || 0);
        else if (value === "--max-assets") args.maxAssets = Math.max(0, Number(argv[++index]) || 0);
        else if (value === "--help") {
            console.log(`
Usage:
  node scripts/training-plan-collector.mjs [options]

Options:
  --sources liftvault,boostcamp,fitness-wiki
  --output <directory>
  --download-assets
  --concurrency <number>
  --max-plans <number>   0 means no limit
  --max-assets <number>  0 means no limit
`);
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${value}`);
        }
    }

    return args;
}

function sleep(ms) {
    return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchWithRetry(url, options = {}) {
    const attempts = options.attempts ?? 4;
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
        try {
            const response = await fetch(url, {
                redirect: "follow",
                ...options.fetch,
                headers: {
                    "user-agent": DEFAULT_USER_AGENT,
                    accept: "*/*",
                    ...(options.fetch?.headers || {}),
                },
                signal: controller.signal,
            });
            if (response.ok) return response;
            if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
                throw new Error(`${response.status} ${response.statusText}`);
            }
            lastError = new Error(`${response.status} ${response.statusText}`);
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timeout);
        }
        await sleep(Math.min(8_000, 500 * (2 ** (attempt - 1))));
    }

    throw new Error(`Fetch failed: ${url}: ${lastError?.message || "unknown error"}`);
}

async function fetchText(url, options) {
    const response = await fetchWithRetry(url, options);
    return {
        response,
        text: await response.text(),
    };
}

async function fetchJson(url, options = {}) {
    let lastError;
    for (let attempt = 1; attempt <= (options.attempts ?? 4); attempt += 1) {
        try {
            const response = await fetchWithRetry(url, {
                ...options,
                attempts: 1,
                fetch: {
                    ...options.fetch,
                    headers: {
                        accept: "application/json",
                        ...(options.fetch?.headers || {}),
                    },
                },
            });
            const contentType = response.headers.get("content-type") || "";
            const body = await response.text();
            if (!contentType.includes("json") && /^\s*</.test(body)) {
                throw new Error(`Expected JSON but received ${contentType || "HTML"}`);
            }
            return { response, data: JSON.parse(body) };
        } catch (error) {
            lastError = error;
            await sleep(Math.min(8_000, 750 * (2 ** (attempt - 1))));
        }
    }
    throw new Error(`JSON fetch failed: ${url}: ${lastError?.message || "unknown error"}`);
}

async function mapLimit(items, limit, worker, onProgress) {
    const results = new Array(items.length);
    let cursor = 0;
    let completed = 0;

    async function run() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            try {
                results[index] = await worker(items[index], index);
            } catch (error) {
                results[index] = { error: error?.message || String(error), input: items[index] };
            }
            completed += 1;
            onProgress?.(completed, items.length);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
    return results;
}

function decodeHtml(value = "") {
    const named = {
        amp: "&",
        apos: "'",
        gt: ">",
        hellip: "…",
        ldquo: "“",
        lsquo: "‘",
        lt: "<",
        nbsp: " ",
        ndash: "–",
        quot: "\"",
        rdquo: "”",
        rsquo: "’",
    };
    return String(value)
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function stripHtml(value = "") {
    return decodeHtml(
        String(value)
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
            .replace(/<[^>]+>/g, " "),
    )
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function redactPersonalData(value = "") {
    return String(value).replace(EMAIL_PATTERN, "[email redacted]");
}

function deepRedact(value) {
    if (typeof value === "string") return redactPersonalData(value);
    if (Array.isArray(value)) return value.map(deepRedact);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRedact(item)]));
    }
    return value;
}

function extractLinks(html = "", baseUrl) {
    const links = [];
    const pattern = /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
    for (const match of String(html).matchAll(pattern)) {
        const raw = decodeHtml(match[1] || match[2] || match[3] || "").trim();
        if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) continue;
        try {
            links.push(new URL(raw, baseUrl).href);
        } catch {
            // Ignore malformed source links.
        }
    }
    return [...new Set(links)];
}

function extractMeta(html, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
        new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return decodeHtml(match[1]).trim();
    }
    return "";
}

function extractSitemapLocs(xml) {
    return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
        .map((match) => decodeHtml(match[1]).trim())
        .filter(Boolean);
}

function safeSlug(value) {
    return String(value || "item")
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90)
        .toLowerCase() || "item";
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

function sourceRecordBase(sourceId, sourceUrl, collectedAt) {
    return {
        source_id: sourceId,
        source_url: sourceUrl,
        collected_at: collectedAt,
        public_access_at_collection: true,
        rights_status: "review_before_republication",
        import_status: "raw_needs_curator_review",
    };
}

function isPlanAssetUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }
    const path = url.pathname.toLowerCase();
    return (
        /\.(pdf|xlsx?|csv|ods)(?:$|[?#])/i.test(rawUrl) ||
        url.hostname === "docs.google.com" && (
            path.includes("/spreadsheets/") ||
            path.includes("/document/")
        ) ||
        url.hostname === "drive.google.com" ||
        url.hostname.endsWith("dropbox.com")
    );
}

function downloadableAssetUrl(rawUrl) {
    const url = new URL(rawUrl);
    if (url.hostname === "docs.google.com") {
        const sheetMatch = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);
        if (sheetMatch) return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=xlsx`;
        return null;
    }
    if (url.hostname === "drive.google.com") {
        const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
        const id = fileMatch?.[1] || url.searchParams.get("id");
        return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
    }
    if (url.hostname.endsWith("dropbox.com")) {
        url.searchParams.set("dl", "1");
        return url.href;
    }
    return url.href;
}

function inferExtension(url, contentType, contentDisposition) {
    const dispositionName = contentDisposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1];
    const candidate = dispositionName ? decodeURIComponent(dispositionName.replace(/"/g, "")) : basename(new URL(url).pathname);
    const extension = extname(candidate).toLowerCase();
    if (/^\.(pdf|xlsx?|csv|ods)$/.test(extension)) return extension;
    if (contentType?.includes("application/pdf")) return ".pdf";
    if (contentType?.includes("spreadsheetml")) return ".xlsx";
    if (contentType?.includes("ms-excel")) return ".xls";
    if (contentType?.includes("text/csv")) return ".csv";
    return ".bin";
}

async function writeJson(path, value) {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeJsonl(path, rows) {
    await mkdir(resolve(path, ".."), { recursive: true });
    const body = rows.map((row) => JSON.stringify(row)).join("\n");
    await writeFile(path, body ? `${body}\n` : "", "utf8");
}

async function collectLiftVault(context) {
    console.log("[liftvault] Fetching WordPress catalog...");
    const endpoint = new URL("https://liftvault.com/wp-json/wp/v2/posts");
    endpoint.searchParams.set("per_page", "100");
    endpoint.searchParams.set("page", "1");
    endpoint.searchParams.set("orderby", "id");
    endpoint.searchParams.set("order", "asc");
    endpoint.searchParams.set("_embed", "wp:term");
    endpoint.searchParams.set("_fields", "id,date,modified,slug,link,title,excerpt,content,_links,_embedded");
    const first = await fetchJson(endpoint.href);
    const firstRows = first.data;
    const discoveredTotalPages = Number(first.response.headers.get("x-wp-totalpages") || 1);
    const requiredPages = context.args.maxPlans
        ? Math.min(discoveredTotalPages, Math.ceil(context.args.maxPlans / 100))
        : discoveredTotalPages;
    const remainingPages = Array.from({ length: requiredPages - 1 }, (_, index) => index + 2);
    const pageResults = await mapLimit(remainingPages, Math.min(2, context.args.concurrency), async (page) => {
        const url = new URL(endpoint);
        url.searchParams.set("page", String(page));
        await sleep(350);
        return (await fetchJson(url.href)).data;
    });
    const posts = [firstRows, ...pageResults.filter(Array.isArray)].flat();
    const limited = context.args.maxPlans ? posts.slice(0, context.args.maxPlans) : posts;
    const records = [];
    const failures = pageResults.filter((result) => !Array.isArray(result));

    for (const post of limited) {
        const contentHtml = post.content?.rendered || "";
        const termGroups = post._embedded?.["wp:term"] || [];
        const terms = termGroups.flat().map((term) => ({
            taxonomy: term.taxonomy,
            name: decodeHtml(term.name),
            slug: term.slug,
        }));
        const allLinks = extractLinks(contentHtml, post.link);
        const assetLinks = allLinks.filter(isPlanAssetUrl);
        const taxonomyText = terms.map((term) => `${term.taxonomy}:${term.slug}`).join(" ");
        const looksLikePlan = (
            assetLinks.length > 0 ||
            /program|routine|workout|spreadsheet|template/i.test(`${post.slug} ${post.title?.rendered || ""}`) ||
            /program|routine|workout/i.test(taxonomyText)
        );
        records.push({
            ...sourceRecordBase("liftvault", post.link, context.collectedAt),
            source_plan_id: String(post.id),
            slug: post.slug,
            title: decodeHtml(post.title?.rendered || post.slug),
            summary: stripHtml(post.excerpt?.rendered || ""),
            article_text: redactPersonalData(stripHtml(contentHtml)),
            published_at: post.date,
            source_updated_at: post.modified,
            record_kind: looksLikePlan ? "training_plan_or_program_page" : "supporting_article",
            taxonomies: terms,
            plan_asset_links: assetLinks,
            outbound_links: allLinks,
        });
    }

    console.log(`[liftvault] Collected ${records.length} pages and found ${new Set(records.flatMap((row) => row.plan_asset_links)).size} unique plan assets.`);
    return { records, failures };
}

function boostcampProgramRecord(pageUrl, pageProps, collectedAt) {
    const program = pageProps.programData || pageProps.program;
    if (!program) throw new Error("No program object in __NEXT_DATA__");
    const isCoach = Boolean(pageProps.programData);
    const variations = Array.isArray(program.variations) ? program.variations : [];
    const topLevelWeeks = Array.isArray(program.weeks) ? program.weeks : [];
    const variationWeekCounts = variations.map((variation) => variation?.weeks?.length || 0);
    const daysPerWeekCandidates = [
        Number(program.days_per_week || 0),
        Array.isArray(program.weekdays) ? program.weekdays.length : 0,
        ...variations.map((variation) => Array.isArray(variation?.weekdays) ? variation.weekdays.length : 0),
        ...variations.flatMap((variation) => (variation?.weeks || []).map((week) => week?.days?.length || 0)),
        ...topLevelWeeks.map((week) => week?.days?.length || 0),
    ].filter((value) => value > 0);

    const content = deepRedact({
        weekdays: program.weekdays || [],
        weeks: topLevelWeeks,
        variations,
        links: program.links || [],
    });

    return {
        ...sourceRecordBase("boostcamp", pageUrl, collectedAt),
        source_plan_id: program.id,
        catalog_kind: isCoach ? "coach" : "community",
        slug: program.slug || new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1),
        title: redactPersonalData(program.title || extractMeta(pageProps, "og:title")),
        author: redactPersonalData(program.instructor_name || ""),
        author_verified: Boolean(program.instructor_verified),
        tagline: redactPersonalData(stripHtml(program.tagline || "")),
        description: redactPersonalData(stripHtml(program.description || program.short_description || "")),
        ai_summary: redactPersonalData(stripHtml(program.ai_summary || "")),
        goals: Array.isArray(program.goals) ? program.goals : [],
        difficulties: Array.isArray(program.difficulties) ? program.difficulties : [],
        equipment: Array.isArray(program.equipments) ? program.equipments : [program.equipments].filter(Boolean),
        duration_minutes: Number(program.workout_duration || program.time_per_workout || 0) || null,
        weeks_count: Math.max(topLevelWeeks.length, ...variationWeekCounts, 0),
        days_per_week: Math.max(...daysPerWeekCandidates, 0) || null,
        popularity_count: Number(program.count_people_done || program.join_count || 0),
        source_updated_at: program.updated_at || null,
        public_view_right: program.has_view_right !== false,
        pricing: program.pricing || {},
        plan_content: content,
    };
}

async function collectBoostcamp(context) {
    const sitemapUrls = [
        "https://www.boostcamp.app/sitemap/coaches-program-sitemap.xml",
        "https://www.boostcamp.app/sitemap/users-program-sitemap.xml",
    ];
    const sitemapBodies = await Promise.all(sitemapUrls.map((url) => fetchText(url)));
    let urls = sitemapBodies.flatMap(({ text }) => extractSitemapLocs(text));
    if (context.args.maxPlans) urls = urls.slice(0, context.args.maxPlans);
    console.log(`[boostcamp] Fetching ${urls.length} public program pages...`);

    let lastProgress = 0;
    const results = await mapLimit(urls, context.args.concurrency, async (url) => {
        const { text: html } = await fetchText(url);
        const rawJson = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
        if (!rawJson) throw new Error("Missing __NEXT_DATA__");
        const data = JSON.parse(rawJson);
        return boostcampProgramRecord(url, data?.props?.pageProps || {}, context.collectedAt);
    }, (completed, total) => {
        const percent = Math.floor((completed / total) * 100);
        if (percent >= lastProgress + 10 || completed === total) {
            lastProgress = percent;
            console.log(`[boostcamp] ${completed}/${total} (${percent}%)`);
        }
    });

    const records = results.filter((result) => result && !result.error);
    const failures = results.filter((result) => result?.error);
    console.log(`[boostcamp] Collected ${records.length} programs; ${failures.length} failed.`);
    return { records, failures };
}

function relevantFitnessWikiUrl(url) {
    const path = new URL(url).pathname.toLowerCase();
    return (
        path === "/routines/" ||
        path.startsWith("/routines/") ||
        path.includes("program-review") ||
        path.includes("recommended-routines")
    );
}

async function collectFitnessWiki(context) {
    const root = await fetchText("https://thefitness.wiki/sitemap.xml");
    const childMaps = extractSitemapLocs(root.text).filter((url) => !url.includes("image-sitemap"));
    const children = await Promise.all(childMaps.map((url) => fetchText(url)));
    let urls = [...new Set(children.flatMap(({ text }) => extractSitemapLocs(text)).filter(relevantFitnessWikiUrl))];
    if (context.args.maxPlans) urls = urls.slice(0, context.args.maxPlans);
    console.log(`[fitness-wiki] Fetching ${urls.length} routine/index pages...`);

    const results = await mapLimit(urls, Math.min(4, context.args.concurrency), async (url) => {
        const { text: html } = await fetchText(url);
        const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).pathname);
        const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
        const articleHtml = articleMatch?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
        return {
            ...sourceRecordBase("fitness-wiki", url, context.collectedAt),
            source_plan_id: sha256(url).slice(0, 16),
            slug: new URL(url).pathname.split("/").filter(Boolean).join("-") || "home",
            title: title.replace(/\s*[|–-]\s*The Fitness Wiki\s*$/i, "").trim(),
            summary: extractMeta(html, "description") || extractMeta(html, "og:description"),
            article_text: redactPersonalData(stripHtml(articleHtml)),
            outbound_links: extractLinks(articleHtml, url),
        };
    });
    const records = results.filter((result) => result && !result.error);
    const failures = results.filter((result) => result?.error);
    console.log(`[fitness-wiki] Collected ${records.length} pages; ${failures.length} failed.`);
    return { records, failures };
}

async function downloadAsset(asset, context, index) {
    const downloadUrl = downloadableAssetUrl(asset.url);
    if (!downloadUrl) {
        return { ...asset, status: "reference_only", reason: "No safe direct download URL" };
    }

    let response;
    try {
        response = await fetchWithRetry(downloadUrl, {
            timeoutMs: 90_000,
            fetch: { headers: { accept: "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*/*" } },
        });
    } catch (error) {
        return { ...asset, download_url: downloadUrl, status: "failed", reason: error.message };
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    const contentType = response.headers.get("content-type") || "";
    if (contentLength > MAX_ASSET_BYTES) {
        return { ...asset, download_url: downloadUrl, status: "skipped", reason: `Asset exceeds ${MAX_ASSET_BYTES} bytes` };
    }
    if (contentType.includes("text/html")) {
        return { ...asset, download_url: downloadUrl, status: "reference_only", reason: "Server returned HTML instead of a downloadable plan file" };
    }

    const extension = inferExtension(
        response.url || downloadUrl,
        contentType,
        response.headers.get("content-disposition") || "",
    );
    const stem = `${String(index + 1).padStart(4, "0")}-${safeSlug(asset.title)}-${sha256(asset.url).slice(0, 10)}`;
    const finalPath = join(context.output, "assets", "liftvault", `${stem}${extension}`);
    const tempPath = `${finalPath}.part`;
    await mkdir(resolve(finalPath, ".."), { recursive: true });

    try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
        const fileStats = await stat(tempPath);
        if (fileStats.size > MAX_ASSET_BYTES) {
            await rm(tempPath, { force: true });
            return { ...asset, download_url: downloadUrl, status: "skipped", reason: `Downloaded asset exceeds ${MAX_ASSET_BYTES} bytes` };
        }
        const bytes = await readFile(tempPath);
        await rename(tempPath, finalPath);
        return {
            ...asset,
            download_url: downloadUrl,
            final_url: response.url,
            status: "downloaded",
            content_type: contentType,
            bytes: fileStats.size,
            sha256: sha256(bytes),
            local_path: relative(context.output, finalPath).replaceAll("\\", "/"),
        };
    } catch (error) {
        await rm(tempPath, { force: true });
        return { ...asset, download_url: downloadUrl, status: "failed", reason: error.message };
    }
}

async function downloadLiftVaultAssets(records, context) {
    const byUrl = new Map();
    for (const record of records) {
        for (const url of record.plan_asset_links || []) {
            const existing = byUrl.get(url);
            if (existing) {
                existing.source_pages.push(record.source_url);
                continue;
            }
            byUrl.set(url, {
                url,
                title: record.title,
                source_pages: [record.source_url],
            });
        }
    }

    let assets = [...byUrl.values()];
    if (context.args.maxAssets) assets = assets.slice(0, context.args.maxAssets);
    console.log(`[assets] Downloading ${assets.length} Lift Vault public plan assets...`);
    let lastProgress = 0;
    const results = await mapLimit(assets, Math.min(3, context.args.concurrency), (asset, index) => (
        downloadAsset(asset, context, index)
    ), (completed, total) => {
        const percent = Math.floor((completed / total) * 100);
        if (percent >= lastProgress + 10 || completed === total) {
            lastProgress = percent;
            console.log(`[assets] ${completed}/${total} (${percent}%)`);
        }
    });
    return results;
}

function sourceSummary(source, result) {
    return {
        source_id: source.id,
        source_name: source.name,
        records: result.records.length,
        failures: result.failures.length,
        rights_mode: source.rightsMode,
        acquisition_mode: source.acquisitionMode,
    };
}

function buildMarkdownReport(manifest, sourceRegistry) {
    const lines = [
        "# CoachLink 训练计划采集报告",
        "",
        `- 采集时间：${manifest.collected_at}`,
        `- 输出目录：\`${manifest.output}\``,
        `- 计划/目录记录：${manifest.totals.records}`,
        `- 页面失败：${manifest.totals.failures}`,
        `- 公开文件已下载：${manifest.totals.assets_downloaded}`,
        `- 公开文件仅保留链接：${manifest.totals.assets_reference_only}`,
        `- 文件下载失败/跳过：${manifest.totals.assets_failed_or_skipped}`,
        "",
        "## 来源统计",
        "",
        "| 来源 | 记录 | 失败 | 获取模式 | 再发布状态 |",
        "|---|---:|---:|---|---|",
        ...manifest.sources.map((source) => (
            `| ${source.source_name} | ${source.records} | ${source.failures} | ${source.acquisition_mode} | ${source.rights_mode} |`
        )),
        "",
        "## 使用边界",
        "",
        `- ${sourceRegistry.policy.defaultRule}`,
        `- ${sourceRegistry.policy.republishingRule}`,
        "- 当前数据是原始语料层，不等于 CoachLink 可直接发布的公共模板。",
        "- 下一步需要做去重、动作名称映射、周期/训练日展开、强度规则保真、来源署名与授权复核。",
        "",
        "## 输出文件",
        "",
        "- `sources/<source-id>/plans.jsonl`：逐条原始计划/目录记录。",
        "- `sources/<source-id>/failures.jsonl`：抓取失败记录，可重复运行补齐。",
        "- `assets/liftvault/`：公开可下载的表格/PDF。",
        "- `asset-index.jsonl`：下载状态、来源页、校验和与本地路径。",
        "- `manifest.json`：本次运行机器可读汇总。",
        "",
    ];
    return `${lines.join("\n")}\n`;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const output = resolve(args.output);
    await mkdir(output, { recursive: true });
    const sourceRegistry = JSON.parse(await readFile(resolve("config", "training-plan-sources.json"), "utf8"));
    const sourceById = new Map(sourceRegistry.sources.map((source) => [source.id, source]));
    const collectors = {
        liftvault: collectLiftVault,
        boostcamp: collectBoostcamp,
        "fitness-wiki": collectFitnessWiki,
    };
    const unknown = args.sources.filter((sourceId) => !collectors[sourceId]);
    if (unknown.length) throw new Error(`No collector implemented for: ${unknown.join(", ")}`);

    const context = {
        args,
        output,
        collectedAt: new Date().toISOString(),
    };
    const results = {};

    for (const sourceId of args.sources) {
        const source = sourceById.get(sourceId);
        if (!source) throw new Error(`Source missing from registry: ${sourceId}`);
        const result = await collectors[sourceId](context);
        results[sourceId] = result;
        await writeJsonl(join(output, "sources", sourceId, "plans.jsonl"), result.records);
        await writeJsonl(join(output, "sources", sourceId, "failures.jsonl"), result.failures);
    }

    let assetResults = [];
    if (args.downloadAssets && results.liftvault) {
        assetResults = await downloadLiftVaultAssets(results.liftvault.records, context);
        await writeJsonl(join(output, "asset-index.jsonl"), assetResults);
    }

    const summaries = args.sources.map((sourceId) => sourceSummary(sourceById.get(sourceId), results[sourceId]));
    const manifest = {
        schema_version: 1,
        collected_at: context.collectedAt,
        output,
        command: {
            sources: args.sources,
            download_assets: args.downloadAssets,
            concurrency: args.concurrency,
            max_plans: args.maxPlans,
            max_assets: args.maxAssets,
        },
        sources: summaries,
        totals: {
            records: summaries.reduce((sum, source) => sum + source.records, 0),
            failures: summaries.reduce((sum, source) => sum + source.failures, 0),
            assets_downloaded: assetResults.filter((asset) => asset.status === "downloaded").length,
            assets_reference_only: assetResults.filter((asset) => asset.status === "reference_only").length,
            assets_failed_or_skipped: assetResults.filter((asset) => ["failed", "skipped"].includes(asset.status)).length,
        },
    };
    await writeJson(join(output, "source-registry.snapshot.json"), sourceRegistry);
    await writeJson(join(output, "manifest.json"), manifest);
    await writeFile(join(output, "REPORT.md"), buildMarkdownReport(manifest, sourceRegistry), "utf8");
    console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
