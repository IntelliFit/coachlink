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
        sources: ["liftvault", "boostcamp", "fitness-wiki", "catalyst-athletics", "crossfit"],
        output: DEFAULT_OUTPUT,
        downloadAssets: false,
        concurrency: 6,
        delayMs: 0,
        maxPlans: 0,
        maxAssets: 0,
        retryFailures: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === "--sources") args.sources = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
        else if (value === "--output") args.output = resolve(argv[++index]);
        else if (value === "--download-assets") args.downloadAssets = true;
        else if (value === "--concurrency") args.concurrency = Math.max(1, Number(argv[++index]) || 1);
        else if (value === "--delay-ms") args.delayMs = Math.max(0, Number(argv[++index]) || 0);
        else if (value === "--max-plans") args.maxPlans = Math.max(0, Number(argv[++index]) || 0);
        else if (value === "--max-assets") args.maxAssets = Math.max(0, Number(argv[++index]) || 0);
        else if (value === "--retry-failures") args.retryFailures = true;
        else if (value === "--help") {
            console.log(`
Usage:
  node scripts/training-plan-collector.mjs [options]

Options:
  --sources liftvault,boostcamp,fitness-wiki
  --output <directory>
  --download-assets
  --concurrency <number>
  --delay-ms <number>
  --max-plans <number>   0 means no limit
  --max-assets <number>  0 means no limit
  --retry-failures       retry only URLs in the existing source failures file
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

function extractSitemapEntries(xml) {
    return [...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => {
        const body = match[1];
        return {
            loc: decodeHtml(body.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1] || "").trim(),
            lastmod: decodeHtml(body.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1] || "").trim() || null,
        };
    }).filter((entry) => entry.loc);
}

async function readJsonl(path) {
    try {
        const body = await readFile(path, "utf8");
        return body.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
        if (error?.code === "ENOENT") return [];
        throw error;
    }
}

async function collectLiftVault(context) {
    console.log("[liftvault] Fetching official sitemaps...");
    const sitemapIndex = await fetchText("https://liftvault.com/sitemap_index.xml");
    const postSitemaps = extractSitemapLocs(sitemapIndex.text).filter((url) => /\/post-sitemap\d*\.xml$/i.test(url));
    const sitemapBodies = await Promise.all(postSitemaps.map((url) => fetchText(url)));
    let urls = [...new Set(
        sitemapBodies
            .flatMap(({ text }) => extractSitemapLocs(text))
            .filter((url) => new URL(url).pathname.startsWith("/programs/")),
    )];
    if (context.args.maxPlans) urls = urls.slice(0, context.args.maxPlans);
    console.log(`[liftvault] Fetching ${urls.length} public program pages...`);

    let lastProgress = 0;
    const results = await mapLimit(urls, Math.min(4, context.args.concurrency), async (url) => {
        const { text: html } = await fetchText(url);
        const articleMatch = html.match(/<article\b([^>]*)>([\s\S]*?)<\/article>/i);
        const articleAttributes = articleMatch?.[1] || "";
        const contentHtml = articleMatch?.[2] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
        const allLinks = extractLinks(contentHtml, url);
        const assetLinks = allLinks.filter(isPlanAssetUrl);
        const articleClasses = decodeHtml(articleAttributes.match(/\bclass=["']([^"']*)["']/i)?.[1] || "")
            .split(/\s+/)
            .filter((className) => /^(category|tag|day_count|experience_level|week_count|progression_rate|program_goal|focus_lift|periodization)-/.test(className));
        const rawTitle = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).pathname);
        return {
            ...sourceRecordBase("liftvault", url, context.collectedAt),
            source_plan_id: sha256(url).slice(0, 16),
            slug: new URL(url).pathname.split("/").filter(Boolean).at(-1),
            title: rawTitle.replace(/\s*[|–-]\s*Lift Vault\s*$/i, "").trim(),
            summary: extractMeta(html, "description") || extractMeta(html, "og:description"),
            article_text: redactPersonalData(stripHtml(contentHtml)),
            published_at: extractMeta(html, "article:published_time") || null,
            source_updated_at: extractMeta(html, "article:modified_time") || null,
            record_kind: assetLinks.length > 0 ? "program_with_public_asset" : "training_program_page",
            taxonomy_classes: articleClasses,
            plan_asset_links: assetLinks,
            outbound_links: allLinks,
        };
    }, (completed, total) => {
        const percent = Math.floor((completed / total) * 100);
        if (percent >= lastProgress + 10 || completed === total) {
            lastProgress = percent;
            console.log(`[liftvault] ${completed}/${total} (${percent}%)`);
        }
    });

    const records = results.filter((result) => result && !result.error);
    const failures = results.filter((result) => result?.error);
    console.log(`[liftvault] Collected ${records.length} pages and found ${new Set(records.flatMap((row) => row.plan_asset_links)).size} unique plan assets; ${failures.length} failed.`);
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
        title: redactPersonalData(
            program.title ||
            new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ||
            "Untitled program",
        ),
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
    let urls = context.urlOverrides?.boostcamp?.length
        ? context.urlOverrides.boostcamp
        : sitemapBodies.flatMap(({ text }) => extractSitemapLocs(text));
    if (context.args.maxPlans) urls = urls.slice(0, context.args.maxPlans);
    console.log(`[boostcamp] Fetching ${urls.length} public program pages...`);

    let lastProgress = 0;
    const results = await mapLimit(urls, context.args.concurrency, async (url) => {
        if (context.args.delayMs) await sleep(context.args.delayMs);
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

function fieldFromHtml(html, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`<strong>${escaped}:<\\/strong>\\s*([\\s\\S]*?)(?=<br|<\\/div>)`, "i"));
    return stripHtml(match?.[1] || "");
}

async function collectCatalystAthletics(context) {
    const url = "https://www.catalystathletics.com/olympic-weightlifting-workouts/training-programs/";
    console.log("[catalyst-athletics] Fetching public program catalog...");
    const { text: html } = await fetchText(url);
    let chunks = [...html.matchAll(/<div class="program_list_container">([\s\S]*?)(?=<div class="program_list_container">|<!-- eof|$)/gi)]
        .map((match) => match[1]);
    if (context.args.maxPlans) chunks = chunks.slice(0, context.args.maxPlans);
    const records = [];

    for (const chunk of chunks) {
        const anchor = chunk.match(/<h1><a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/h1>/i);
        if (!anchor) continue;
        const sourceUrl = new URL(decodeHtml(anchor[1]), url).href;
        const infoLine = stripHtml(chunk.match(/<span class="programs_list_infoline">([\s\S]*?)<\/span>/i)?.[1] || "");
        const price = infoLine.match(/\$\s*([0-9.]+)/)?.[1] || (/\bfree\b/i.test(infoLine) ? "free" : null);
        const tags = fieldFromHtml(chunk, "Tags").split(",").map((tag) => tag.trim()).filter(Boolean);
        records.push({
            ...sourceRecordBase("catalyst-athletics", sourceUrl, context.collectedAt),
            source_plan_id: sourceUrl.match(/\/training-program\/(\d+)\//)?.[1] || sha256(sourceUrl).slice(0, 16),
            catalog_kind: "coach_catalog",
            title: stripHtml(anchor[2]),
            author: "Greg Everett / Catalyst Athletics",
            formats: infoLine.replace(/\s*\|[\s\S]*$/, "").replace(/^Formats:\s*/i, "").split(",").map((item) => item.trim()).filter(Boolean),
            price_usd: price === "free" ? 0 : (price ? Number(price) : null),
            duration: fieldFromHtml(chunk, "Duration"),
            days_per_week_text: fieldFromHtml(chunk, "Days/Week"),
            volume: fieldFromHtml(chunk, "Volume"),
            intensity: fieldFromHtml(chunk, "Intensity"),
            focus: fieldFromHtml(chunk, "Focus"),
            tags,
            summary: redactPersonalData(stripHtml(chunk)),
            content_availability: "catalog_metadata_only",
            import_status: "metadata_only_not_publishable",
        });
    }
    console.log(`[catalyst-athletics] Collected ${records.length} program catalog entries.`);
    return { records, failures: [] };
}

function crossfitDateFromSlug(slug) {
    if (!/^\d{6}$/.test(slug)) return null;
    const year = Number(slug.slice(0, 2));
    const month = Number(slug.slice(2, 4));
    const day = Number(slug.slice(4, 6));
    const fullYear = year >= 90 ? 1900 + year : 2000 + year;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function collectCrossfit(context) {
    console.log("[crossfit] Fetching official daily WOD sitemap...");
    const { text: xml } = await fetchText("https://www.crossfit.com/cfdaily-sitemap.xml");
    let entries = extractSitemapEntries(xml);
    if (context.args.maxPlans) entries = entries.slice(0, context.args.maxPlans);
    const records = entries.map((entry) => {
        const slug = new URL(entry.loc).pathname.split("/").filter(Boolean).at(-1) || "";
        const workoutDate = crossfitDateFromSlug(slug);
        return {
            ...sourceRecordBase("crossfit", entry.loc, context.collectedAt),
            source_plan_id: slug || sha256(entry.loc).slice(0, 16),
            slug,
            catalog_kind: "daily_wod",
            title: workoutDate ? `CrossFit Workout of the Day ${workoutDate}` : `CrossFit Workout of the Day ${slug}`,
            workout_date: workoutDate,
            source_updated_at: entry.lastmod,
            content_availability: "catalog_metadata_only",
            import_status: "metadata_only_needs_detail_fetch_and_rights_review",
        };
    });
    console.log(`[crossfit] Collected ${records.length} daily WOD catalog entries.`);
    return { records, failures: [] };
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
        "catalyst-athletics": collectCatalystAthletics,
        crossfit: collectCrossfit,
    };
    const unknown = args.sources.filter((sourceId) => !collectors[sourceId]);
    if (unknown.length) throw new Error(`No collector implemented for: ${unknown.join(", ")}`);

    const context = {
        args,
        output,
        collectedAt: new Date().toISOString(),
        urlOverrides: {},
    };
    const results = {};

    for (const sourceId of args.sources) {
        const source = sourceById.get(sourceId);
        if (!source) throw new Error(`Source missing from registry: ${sourceId}`);
        const sourceDirectory = join(output, "sources", sourceId);
        const existingRecords = args.retryFailures
            ? await readJsonl(join(sourceDirectory, "plans.jsonl"))
            : [];
        if (args.retryFailures) {
            const existingFailures = await readJsonl(join(sourceDirectory, "failures.jsonl"));
            context.urlOverrides[sourceId] = existingFailures.map((failure) => failure.input).filter((input) => typeof input === "string");
            if (context.urlOverrides[sourceId].length === 0) {
                console.log(`[${sourceId}] No existing failures to retry.`);
                results[sourceId] = { records: existingRecords, failures: [] };
                continue;
            }
            console.log(`[${sourceId}] Retrying ${context.urlOverrides[sourceId].length} failed URLs.`);
        }
        const result = await collectors[sourceId](context);
        const mergedRecords = args.retryFailures
            ? [...new Map([...existingRecords, ...result.records].map((record) => [record.source_url, record])).values()]
            : result.records;
        results[sourceId] = { records: mergedRecords, failures: result.failures };
        await writeJsonl(join(sourceDirectory, "plans.jsonl"), mergedRecords);
        await writeJsonl(join(sourceDirectory, "failures.jsonl"), result.failures);
    }

    let assetResults = [];
    if (args.downloadAssets && results.liftvault) {
        assetResults = await downloadLiftVaultAssets(results.liftvault.records, context);
        await writeJsonl(join(output, "asset-index.jsonl"), assetResults);
    }

    const summarySourceIds = [];
    for (const sourceId of Object.keys(collectors)) {
        const plansPath = join(output, "sources", sourceId, "plans.jsonl");
        const records = results[sourceId]?.records || await readJsonl(plansPath);
        if (records.length === 0) continue;
        const failures = results[sourceId]?.failures || await readJsonl(join(output, "sources", sourceId, "failures.jsonl"));
        results[sourceId] = { records, failures };
        summarySourceIds.push(sourceId);
    }
    if (!args.downloadAssets) {
        assetResults = await readJsonl(join(output, "asset-index.jsonl"));
    }
    const summaries = summarySourceIds.map((sourceId) => sourceSummary(sourceById.get(sourceId), results[sourceId]));
    const manifest = {
        schema_version: 1,
        collected_at: context.collectedAt,
        output,
        command: {
            sources: args.sources,
            download_assets: args.downloadAssets,
            concurrency: args.concurrency,
            delay_ms: args.delayMs,
            max_plans: args.maxPlans,
            max_assets: args.maxAssets,
            retry_failures: args.retryFailures,
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
