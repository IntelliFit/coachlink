import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  KNOWLEDGE_BOOK_RIGHTS_NOTICE,
  appendKnowledgeBookRightsNotice,
  type ImagePrompt,
  type KnowledgeBookWorkspaceBundle,
  type KnowledgeBookWorkspaceNote,
} from "../src/content/knowledgeBooks/schema";
import { loadKnowledgeBookWorkspaceBundle } from "../src/lib/knowledgeBookWorkspace";

type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type GeneratedNotePayload = {
  title?: string;
  summary?: string;
  markdown?: string;
  imagePrompts?: ImagePrompt[];
};

type GenerationLogItem = {
  slug: string;
  noteType: "overview" | "chapter";
  sourceExcerptLength: number;
  updatedTitle: string;
  updatedSummaryLength: number;
  imagePromptCount: number;
};

type IndexedLine = {
  normalized: string;
  start: number;
};

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeForSearch(input: string) {
  return input
    .replace(/\r/g, "")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, ":")
    .trim();
}

function safeSummary(input: string, fallback: string) {
  const value = input.trim().replace(/\s+/g, " ");
  if (!value) return fallback;
  return value.slice(0, 140);
}

function safeTitle(input: string, fallback: string) {
  const value = input.trim().replace(/\s+/g, " ");
  return value || fallback;
}

function safeImagePrompts(
  imagePrompts: ImagePrompt[] | undefined,
  chapterTitle: string
) {
  const valid = (imagePrompts || []).filter(
    (item) => item?.title?.trim() || item?.prompt?.trim()
  );

  if (valid.length > 0) {
    return valid.map((item, index) => ({
      title: item.title?.trim() || `${chapterTitle} 配图 ${index + 1}`,
      intent: item.intent?.trim() || "用于文章配图",
      prompt: item.prompt?.trim() || "",
    }));
  }

  return [
    {
      title: `${chapterTitle} 配图`,
      intent: "用于文章配图",
      prompt: "",
    },
  ];
}

function safeMarkdown(input: string, fallback: string) {
  const normalized = input.trim();
  if (!normalized) {
    return appendKnowledgeBookRightsNotice(fallback);
  }

  return appendKnowledgeBookRightsNotice(normalized);
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response does not contain a JSON object.");
  }

  return JSON.parse(text.slice(start, end + 1)) as GeneratedNotePayload;
}

function trimExcerpt(text: string, maxLength: number) {
  const normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}\n\n[内容已截断，仅供写作参考]`;
}

function extractOverviewExcerpt(sourceText: string) {
  return trimExcerpt(sourceText, 12000);
}

function buildIndexedLines(sourceText: string) {
  const lines: IndexedLine[] = [];
  let cursor = 0;

  for (const line of sourceText.split(/\r?\n/)) {
    const start = cursor;

    lines.push({
      normalized: normalizeForSearch(line),
      start,
    });

    cursor = start + line.length + 1;
  }

  return lines;
}

function findHeadingLineIndexes(
  lines: IndexedLine[],
  heading: string,
  startLineIndex = 0
) {
  const normalizedHeading = normalizeForSearch(heading);
  const matches: number[] = [];
  if (!normalizedHeading) {
    return matches;
  }

  for (let index = startLineIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.normalized) continue;

    if (line.normalized === normalizedHeading) {
      matches.push(index);
      continue;
    }

    if (
      line.normalized.includes(normalizedHeading) ||
      normalizedHeading.includes(line.normalized)
    ) {
      matches.push(index);
    }
  }

  return matches;
}

function findNextHeadingLineIndex(
  lines: IndexedLine[],
  headings: string[],
  startLineIndex: number
) {
  let best = -1;

  for (const heading of headings) {
    const candidates = findHeadingLineIndexes(lines, heading, startLineIndex);
    const candidate = candidates.length > 0 ? candidates[0] : -1;
    if (candidate === -1) continue;
    if (best === -1 || candidate < best) {
      best = candidate;
    }
  }

  return best;
}

function extractChapterExcerpt(
  sourceText: string,
  note: KnowledgeBookWorkspaceNote,
  allNotes: KnowledgeBookWorkspaceNote[]
) {
  const lines = buildIndexedLines(sourceText);
  const startLineIndexes = findHeadingLineIndexes(lines, note.chapterTitle);

  if (startLineIndexes.length === 0) {
    return trimExcerpt(sourceText, 9000);
  }

  const nextNotes = allNotes
    .filter((item) => item.chapterOrder > note.chapterOrder)
    .sort((a, b) => a.chapterOrder - b.chapterOrder);
  const nextHeadings = nextNotes.map((item) => item.chapterTitle);

  let chosenExcerpt = "";
  for (const startLineIndex of startLineIndexes) {
    const nextLineIndex = findNextHeadingLineIndex(
      lines,
      nextHeadings,
      startLineIndex + 1
    );
    const endOffset =
      nextLineIndex === -1 ? sourceText.length : lines[nextLineIndex].start;
    const excerpt = sourceText.slice(lines[startLineIndex].start, endOffset);

    if (excerpt.trim().length >= 500) {
      chosenExcerpt = excerpt;
      break;
    }

    if (excerpt.trim().length > chosenExcerpt.trim().length) {
      chosenExcerpt = excerpt;
    }
  }

  return trimExcerpt(chosenExcerpt || sourceText, 9000);
}

function buildSystemPrompt() {
  return [
    "你是 Coachlink 的书籍解读编辑。",
    "你的任务是把原书内容改写成适合知识库发布的深度阅读笔记，而不是复述或搬运原文。",
    "必须遵守：",
    "1. 只能写解读、重述、结构化提炼、应用转译，不要直接复制原书原句。",
    "2. 文风要成体系、深入浅出、足够通俗，但不能空泛。",
    "3. 文章要像真正可发布的知识库内容，而不是提纲或课堂便签。",
    "4. 输出必须是 JSON，不能带 markdown 代码块。",
    "5. markdown 正文里不要再加版权声明，系统会自动补到文章末尾。",
    "6. 每篇给出 2-3 条适合 AI 出图的中文提示词。",
  ].join("\n");
}

function buildUserPrompt(input: {
  bundle: KnowledgeBookWorkspaceBundle;
  note: KnowledgeBookWorkspaceNote;
  noteTemplate: string;
  sourceExcerpt: string;
}) {
  const { bundle, note, noteTemplate, sourceExcerpt } = input;
  const isOverview = note.noteType === "overview";
  const chapterList = bundle.notes
    .filter((item) => item.noteType === "chapter")
    .map((item) => `${item.chapterOrder}. ${item.chapterTitle}`)
    .join("\n");

  const lengthHint = isOverview
    ? "正文尽量写成 1800-2800 字的扎实总览。"
    : "正文尽量写成 1400-2400 字的扎实章节解读。";

  return [
    `书名：${bundle.source.title}`,
    `作者：${bundle.source.authors.join("、") || "未知"}`,
    `当前文章类型：${isOverview ? "总览" : "章节解读"}`,
    `当前文章标题：${note.title}`,
    `当前章节名：${note.chapterTitle}`,
    "",
    "全书章节清单：",
    chapterList || "- 暂无",
    "",
    "写作要求：",
    "- 保持读起来像成熟知识库文章，不要只是罗列。",
    "- 解释清楚“这部分在解决什么问题”。",
    "- 多用通俗解释、实际例子、常见误区、落地建议。",
    "- 允许重组表达顺序，但不要偏离这本书真正的主题。",
    `- ${lengthHint}`,
    "",
    "当前文章建议骨架：",
    noteTemplate.trim(),
    "",
    "仅供理解主题的原书摘取文本（禁止直接照抄原句）：",
    sourceExcerpt,
    "",
    "请严格返回 JSON，格式如下：",
    JSON.stringify(
      {
        title: "文章标题",
        summary: "100字以内摘要",
        markdown: "# 正文\n\n完整 markdown 内容",
        imagePrompts: [
          {
            title: "配图标题",
            intent: "用途说明",
            prompt: "中文出图提示词",
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

async function callOpenAiCompatible(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: DeepSeekMessage[];
}) {
  const response = await fetch(`${input.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: false,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`万界方舟请求失败: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("万界方舟响应缺少内容。");
  }

  return content;
}

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

  const collectionSlug =
    process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--")) || null;

  if (!collectionSlug) {
    console.log("Usage:");
    console.log(
      "  npx tsx scripts/generate-knowledge-book-drafts.ts <collection-slug> [--api-key xxx] [--base-url https://maas-openapi.wanjiedata.com/api/v1] [--model <万界方舟模型ID>] [--notes overview,chapter-01] [--max-notes 3] [--overwrite]"
    );
    process.exit(1);
  }

  const apiKey = getArgValue("--api-key") || process.env.WANJIE_ARK_API_KEY || "";
  if (!apiKey.trim()) {
    throw new Error("缺少万界方舟 API Key。请传 --api-key 或配置 WANJIE_ARK_API_KEY。");
  }

  const baseUrl = getArgValue("--base-url") || process.env.WANJIE_ARK_BASE_URL || "https://maas-openapi.wanjiedata.com/api/v1";
  const model = getArgValue("--model") || process.env.KNOWLEDGE_BOOK_LLM_MODEL || process.env.WANJIE_ARK_MODEL || "";
  if (!model.trim()) {
    throw new Error("缺少模型 ID。请传 --model 或配置 KNOWLEDGE_BOOK_LLM_MODEL / WANJIE_ARK_MODEL。");
  }
  const overwrite = process.argv.includes("--overwrite");
  const maxNotes = Number(getArgValue("--max-notes") || "0") || 0;
  const noteSlugFilter = (getArgValue("--notes") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const { workspaceDir, tempDir, bundle } = loadKnowledgeBookWorkspaceBundle(collectionSlug);
  const sourcePath = path.join(tempDir, "source.txt");
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source text not found: ${sourcePath}`);
  }

  const sourceText = fs.readFileSync(sourcePath, "utf8");
  const allNotes = bundle.notes;
  const selectedNotes = allNotes
    .filter((note) => noteSlugFilter.length === 0 || noteSlugFilter.includes(note.slug))
    .slice(0, maxNotes > 0 ? maxNotes : allNotes.length);

  const logItems: GenerationLogItem[] = [];

  for (const note of selectedNotes) {
    const notePath = path.join(workspaceDir, note.file);
    const currentMarkdown = fs.existsSync(notePath)
      ? fs.readFileSync(notePath, "utf8")
      : "";

    if (!overwrite && currentMarkdown.trim() && !currentMarkdown.includes("用 2-3 段大白话")) {
      continue;
    }

    const sourceExcerpt =
      note.noteType === "overview"
        ? extractOverviewExcerpt(sourceText)
        : extractChapterExcerpt(sourceText, note, allNotes);

    const content = await callOpenAiCompatible({
      apiKey,
      baseUrl,
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt({
            bundle,
            note,
            noteTemplate: currentMarkdown,
            sourceExcerpt,
          }),
        },
      ],
    });

    const generated = extractJsonObject(content);
    const finalMarkdown = safeMarkdown(generated.markdown || "", currentMarkdown);

    fs.writeFileSync(notePath, finalMarkdown, "utf8");

    note.title = safeTitle(generated.title || note.title, note.title);
    note.summary = safeSummary(generated.summary || note.summary, note.summary);
    note.imagePrompts = safeImagePrompts(
      generated.imagePrompts,
      note.chapterTitle || note.title
    );

    logItems.push({
      slug: note.slug,
      noteType: note.noteType,
      sourceExcerptLength: sourceExcerpt.length,
      updatedTitle: note.title,
      updatedSummaryLength: note.summary.length,
      imagePromptCount: note.imagePrompts.length,
    });
  }

  fs.writeFileSync(
    path.join(workspaceDir, "book.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempDir, "generation-log.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model,
        noteCount: logItems.length,
        rightsNotice: KNOWLEDGE_BOOK_RIGHTS_NOTICE,
        items: logItems,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        workspaceDir,
        tempDir,
        model,
        generatedNotes: logItems.length,
        items: logItems,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to generate knowledge book drafts:");
  console.error(error);
  process.exit(1);
});
