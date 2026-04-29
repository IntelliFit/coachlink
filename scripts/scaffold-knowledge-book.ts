import fs from "node:fs";
import path from "node:path";

import mammoth from "mammoth";

import { KNOWLEDGE_BOOK_WORKSPACE_ROOT } from "../src/lib/knowledgeBookWorkspace";
import type {
  ImagePrompt,
  KnowledgeBookWorkspaceBundle,
  KnowledgeBookWorkspaceNote,
} from "../src/content/knowledgeBooks/schema";

const DEFAULT_DISCLAIMER =
  "本内容为基于原书主题、结构与训练思想重新整理的解读型阅读笔记，仅保留知识框架、方法论和实践转译，不提供原书全文、逐章替代或大段摘录。";
const LOCAL_SOURCE_ROOT = path.resolve(
  process.cwd(),
  "temp_dir/knowledge-book-workspaces"
);

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `book-notes-${Date.now()}`;
}

function deriveTitleFromFilePath(filePath: string) {
  return path.basename(filePath, path.extname(filePath));
}

function collapseChineseSpacing(input: string) {
  let value = input;
  let previous = "";

  while (value !== previous) {
    previous = value;
    value = value.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2");
  }

  return value;
}

function cleanHeading(rawHeading: string) {
  return collapseChineseSpacing(
    rawHeading
      .replace(/\t+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+\d+$/g, "")
      .trim()
  );
}

async function readSourceText(sourcePath: string) {
  const ext = path.extname(sourcePath).toLowerCase();

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: sourcePath });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(sourcePath, "utf8");
  }

  throw new Error(`Unsupported source file: ${ext}. Use .docx, .txt or .md`);
}

function detectChapterHeadings(text: string) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 2 && line.length <= 60);

  const chapterPatterns = [
    /^第[一二三四五六七八九十百千万零\d]+[章节篇部卷][：:\s-]?\S.*$/,
    /^(chapter|part)\s+\d+\b.*$/i,
    /^(?:\d+|[一二三四五六七八九十]+)[\.、]\s*\S.*$/,
    /^附录[：:\s-]?\S.*$/,
  ];

  const headings: string[] = [];
  for (const line of lines) {
    if (!chapterPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    const cleaned = cleanHeading(line);
    if (!cleaned || /^[\d.\-/:：]+$/.test(cleaned)) {
      continue;
    }

    if (headings[headings.length - 1] === cleaned) {
      continue;
    }

    headings.push(cleaned);
  }

  return Array.from(new Set(headings)).slice(0, 20);
}

function buildOverviewTemplate(title: string, chapterTitles: string[]) {
  const chapterList = chapterTitles.length
    ? chapterTitles.map((chapter) => `- ${chapter}`).join("\n")
    : "- 待补充章节结构";

  return `# 先用一篇总览读懂《${title}》

## 这本书到底在讲什么

用 2-3 段大白话说明整本书的核心问题、适合人群和最重要的价值。

## 全书结构地图

${chapterList}

## 读这本书最容易抓错的地方

- 误区 1：
- 误区 2：
- 误区 3：

## 普通人应该先看什么

按“先总览、后章节”的顺序，给出建议阅读路径。

## 一句话收尾

用一句短句收住全书的判断框架。
`;
}

function buildChapterTemplate(chapterTitle: string) {
  return `# ${chapterTitle}

## 这一章到底在解决什么

用 1-2 段先讲这一章的核心问题。

## 用大白话解释

把书里的概念翻译成小白能立刻听懂的话。

## 关键逻辑

- 逻辑 1：
- 逻辑 2：
- 逻辑 3：

## 常见误区

- 误区 1：
- 误区 2：

## 怎么落地

给出 3-5 条普通读者可以立刻拿去用的做法。

## 一句话收尾

用一句短句把这一章最该带走的判断收住。
`;
}

function buildDefaultImagePrompts(chapterTitle: string): ImagePrompt[] {
  return [
    {
      title: `${chapterTitle} 配图`,
      intent: "用于这篇章节文章的首图或解释图",
      prompt: "",
    },
  ];
}

function buildNotes(title: string, chapterHeadings: string[]) {
  const safeHeadings =
    chapterHeadings.length > 0
      ? chapterHeadings
      : ["章节01", "章节02", "章节03", "章节04"];

  const overviewNote: KnowledgeBookWorkspaceNote = {
    slug: "overview",
    file: "notes/00-overview.md",
    noteType: "overview",
    chapterOrder: 0,
    chapterTitle: "总览",
    title: `《${title}》总览：先把这本书真正的主线读懂`,
    summary: "用一篇总览先讲清楚整本书的核心问题、阅读路径和应用框架。",
    sortOrder: 10,
    imagePrompts: buildDefaultImagePrompts("总览"),
  };

  const chapterNotes = safeHeadings.map((heading, index) => ({
    slug: `chapter-${String(index + 1).padStart(2, "0")}`,
    file: `notes/${String(index + 1).padStart(2, "0")}.md`,
    noteType: "chapter" as const,
    chapterOrder: index + 1,
    chapterTitle: heading,
    title: `《${title}》${heading}：这一部分到底在讲什么`,
    summary: `围绕“${heading}”做一篇深入浅出的章节解读。`,
    sortOrder: 11 + index,
    imagePrompts: buildDefaultImagePrompts(heading),
  }));

  return [overviewNote, ...chapterNotes];
}

function buildReadme(bundle: KnowledgeBookWorkspaceBundle, localSourceDir: string) {
  return `# ${bundle.source.title}

这个目录是书籍笔记的工作目录。目标不是搬运原书，而是产出可发布到知识库的“解读型笔记”。

## 你要填的文件

- \`book.json\`：整本书的元信息和每篇文章索引
- \`notes/00-overview.md\`：整本书总览
- \`notes/*.md\`：各章节 / 主题分篇

## 建议流程

1. 先看本地临时素材目录：\`${localSourceDir}\`
2. 先写总览，再逐篇补章节
3. 每篇都讲成“通俗解释 + 关键逻辑 + 常见误区 + 落地做法”
4. 图片不用真的生成，只要把提示词写进 \`book.json\`

## 本地临时素材

- 原书抽取文本：\`${path.join(localSourceDir, "source.txt")}\`
- 自动章节探测：\`${path.join(localSourceDir, "outline.md")}\`

这些文件只用于本地整理，不应该作为可发布内容提交或入库。

## 导入命令

\`\`\`bash
npx tsx scripts/import-knowledge-book-notes.ts ${bundle.source.collectionSlug} --apply
\`\`\`
`;
}

async function main() {
  const sourcePath = getArgValue("--source");
  const force = process.argv.includes("--force");

  if (!sourcePath) {
    console.log("Usage:");
    console.log(
      '  npx tsx scripts/scaffold-knowledge-book.ts --source "D:\\path\\book.docx" [--slug my-book] [--title 书名] [--authors 作者1,作者2] [--force]'
    );
    process.exit(1);
  }

  const absoluteSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(absoluteSourcePath)) {
    throw new Error(`Source file not found: ${absoluteSourcePath}`);
  }

  const title = getArgValue("--title") || deriveTitleFromFilePath(absoluteSourcePath);
  const slug = normalizeSlug(getArgValue("--slug") || deriveTitleFromFilePath(absoluteSourcePath));
  const authors = (getArgValue("--authors") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const workspaceDir = path.join(KNOWLEDGE_BOOK_WORKSPACE_ROOT, slug);
  const localSourceDir = path.join(LOCAL_SOURCE_ROOT, slug);
  if (fs.existsSync(workspaceDir) && !force) {
    throw new Error(`Workspace already exists: ${workspaceDir}. Re-run with --force to overwrite.`);
  }

  fs.mkdirSync(path.join(workspaceDir, "notes"), { recursive: true });
  fs.mkdirSync(localSourceDir, { recursive: true });

  const sourceText = await readSourceText(absoluteSourcePath);
  const chapterHeadings = detectChapterHeadings(sourceText);
  const notes = buildNotes(title, chapterHeadings);

  const bundle: KnowledgeBookWorkspaceBundle = {
    format: "book-note-v2-workspace",
    noteStyle: "interpretive-reading-note",
    disclaimer: DEFAULT_DISCLAIMER,
    source: {
      title,
      authors,
      originalFilePath: absoluteSourcePath,
      copyrightMode: "interpretive-notes-only",
      collectionSlug: slug,
      collectionTitle: `《${title}》专题解读`,
    },
    notes,
  };

  fs.writeFileSync(
    path.join(workspaceDir, "book.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(localSourceDir, "outline.md"),
    `# ${title} 章节探测\n\n${chapterHeadings.length ? chapterHeadings.map((line) => `- ${line}`).join("\n") : "- 未自动识别到稳定章节标题，请手动调整 book.json 和 notes/ 目录"}\n`,
    "utf8"
  );
  fs.writeFileSync(path.join(localSourceDir, "source.txt"), sourceText, "utf8");
  fs.writeFileSync(
    path.join(workspaceDir, "README.md"),
    buildReadme(bundle, localSourceDir),
    "utf8"
  );

  for (const note of notes) {
    const notePath = path.join(workspaceDir, note.file);
    const template =
      note.noteType === "overview"
        ? buildOverviewTemplate(title, chapterHeadings)
        : buildChapterTemplate(note.chapterTitle);
    fs.writeFileSync(notePath, template, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        workspaceDir,
        localSourceDir,
        slug,
        title,
        authors,
        detectedChapters: chapterHeadings.length,
        noteCount: notes.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to scaffold knowledge book workspace:");
  console.error(error);
  process.exit(1);
});
