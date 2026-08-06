export type ImagePrompt = {
  title: string;
  intent: string;
  prompt: string;
};

export const KNOWLEDGE_BOOK_RIGHTS_NOTICE =
  "本页为 CoachLink 原创阅读解读，不提供原书下载，也不以逐章复述替代原作；必要短引仅用于评论与说明，并应标明出处。";

export const PUBLIC_DOMAIN_BOOK_RIGHTS_NOTICE =
  "本页所收古籍原文已进入公有领域；页面结构、导读和训练相关解读由 CoachLink 整理。现代点校、注释、翻译及出版社版式不在收录范围内。";

export type KnowledgeMindMapNode = {
  id: string;
  title: string;
  description?: string | null;
  node_type?: "domain" | "category" | "topic";
  children?: KnowledgeMindMapNode[];
};

export type KnowledgeBookMindMap = {
  title: string;
  description?: string;
  data: KnowledgeMindMapNode[];
};

export type KnowledgeBookReadingGuide = {
  estimatedMinutes?: number;
  suitableFor?: string[];
  goals?: string[];
  prerequisites?: string[];
};

export type KnowledgeBookCitation = {
  title: string;
  url?: string;
  note?: string;
  license?: string;
  accessedAt?: string;
};

export type KnowledgeBookManifest = {
  slug: string;
  source: {
    title: string;
    authors: string[];
    originalFilePath: string;
    copyrightMode: string;
    collectionSlug: string;
    collectionTitle: string;
    noteSlug: string;
    noteType: "overview" | "chapter";
    chapterOrder: number;
    chapterTitle: string;
  };
  book: {
    title: string;
    author: string;
    cover_image: string | null;
    audio_url: string | null;
    summary: string;
    is_free: boolean;
    is_published: boolean;
    sort_order: number;
  };
  content: {
    format: string;
    noteStyle: string;
    disclaimer: string;
    markdown: string;
    imagePrompts: ImagePrompt[];
    mindMap?: KnowledgeBookMindMap;
    readingGuide?: KnowledgeBookReadingGuide;
    keyTakeaways?: string[];
    discussionPrompts?: string[];
    citations?: KnowledgeBookCitation[];
  };
};

export type KnowledgeBookWorkspaceNote = {
  slug: string;
  file: string;
  noteType: "overview" | "chapter";
  chapterOrder: number;
  chapterTitle: string;
  title: string;
  summary: string;
  sortOrder: number;
  coverImage?: string | null;
  audioUrl?: string | null;
  author?: string;
  isFree?: boolean;
  isPublished?: boolean;
  imagePrompts?: ImagePrompt[];
  mindMap?: KnowledgeBookMindMap;
  readingGuide?: KnowledgeBookReadingGuide;
  keyTakeaways?: string[];
  discussionPrompts?: string[];
  citations?: KnowledgeBookCitation[];
};

export type KnowledgeBookWorkspaceBundle = {
  format?: string;
  noteStyle?: string;
  disclaimer: string;
  source: {
    title: string;
    authors: string[];
    originalFilePath: string;
    copyrightMode: string;
    collectionSlug: string;
    collectionTitle: string;
  };
  notes: KnowledgeBookWorkspaceNote[];
};

function compactText(value: string, maxLength = 72) {
  const normalized = value
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function findHeadingDescription(lines: string[], headingIndex: number) {
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) return undefined;
    if (/^[-*+]\s+/.test(line)) {
      return compactText(line.replace(/^[-*+]\s+/, ""));
    }
    return compactText(line);
  }
  return undefined;
}

export function createKnowledgeBookMindMap(
  title: string,
  markdown: string
): KnowledgeBookMindMap {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const root: KnowledgeMindMapNode = {
    id: "root",
    title,
    node_type: "domain",
    children: [],
  };
  const parentByDepth = new Map<number, KnowledgeMindMapNode>([[1, root]]);
  let nodeCount = 0;

  lines.forEach((line, lineIndex) => {
    if (nodeCount >= 24) return;
    const match = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (!match) return;

    const depth = match[1].length;
    const node: KnowledgeMindMapNode = {
      id: `section-${nodeCount + 1}`,
      title: compactText(match[2], 48),
      description: findHeadingDescription(lines, lineIndex),
      node_type: depth === 2 ? "category" : "topic",
      children: [],
    };
    const parent = parentByDepth.get(depth - 1) || root;
    parent.children = [...(parent.children || []), node];
    parentByDepth.set(depth, node);
    for (let childDepth = depth + 1; childDepth <= 4; childDepth += 1) {
      parentByDepth.delete(childDepth);
    }
    nodeCount += 1;
  });

  if (!root.children?.length) {
    const fallbackLabels = Array.from(
      new Set(
        lines
          .map((line) => line.match(/^[-*+]\s+(.+?)\s*$/)?.[1])
          .filter((line): line is string => Boolean(line))
          .map((line) => compactText(line, 48))
      )
    ).slice(0, 6);
    const labels = fallbackLabels.length
      ? fallbackLabels
      : ["核心问题", "关键逻辑", "常见误区", "实践应用"];
    root.children = labels.map((label, index) => ({
      id: `section-${index + 1}`,
      title: label,
      node_type: "category",
      children: [],
    }));
  }

  return {
    title: `${title} · 思维导图`,
    description: "按本页标题层级自动生成，可用于快速定位主线与复习。",
    data: [root],
  };
}

function createDefaultDiscussionPrompts(note: KnowledgeBookWorkspaceNote) {
  const subject = note.noteType === "overview" ? "这本书" : "这一章";
  return [
    `${subject}里最值得带进你当前训练的一条判断是什么？`,
    `你在哪个真实训练场景里遇到过${subject}描述的问题？`,
    `你对${subject}的哪一点仍有疑问或不同意见？请写出理由。`,
  ];
}

export function appendKnowledgeBookRightsNotice(
  markdown: string,
  copyrightMode = "interpretive-notes-only"
) {
  const normalized = markdown.trim();
  const rightsNotice = copyrightMode === "public-domain"
    ? PUBLIC_DOMAIN_BOOK_RIGHTS_NOTICE
    : KNOWLEDGE_BOOK_RIGHTS_NOTICE;
  if (!normalized) {
    return `> ${rightsNotice}\n`;
  }

  if (
    normalized.includes(KNOWLEDGE_BOOK_RIGHTS_NOTICE) ||
    normalized.includes(PUBLIC_DOMAIN_BOOK_RIGHTS_NOTICE)
  ) {
    return `${normalized}\n`;
  }

  return `${normalized}\n\n---\n\n> ${rightsNotice}\n`;
}

export function createKnowledgeBookManifestFromWorkspace(input: {
  bundle: KnowledgeBookWorkspaceBundle;
  note: KnowledgeBookWorkspaceNote;
  markdown: string;
}): KnowledgeBookManifest {
  const { bundle, note, markdown } = input;
  const mindMap = note.mindMap || createKnowledgeBookMindMap(note.title, markdown);
  const estimatedMinutes = Math.max(4, Math.ceil(markdown.replace(/\s/g, "").length / 500));
  const topLevelTakeaways = mindMap.data[0]?.children
    ?.map((node) => node.title)
    .filter(Boolean)
    .slice(0, 6) || [];

  return {
    slug: note.slug,
    source: {
      ...bundle.source,
      noteSlug: note.slug,
      noteType: note.noteType,
      chapterOrder: note.chapterOrder,
      chapterTitle: note.chapterTitle,
    },
    book: {
      title: note.title,
      author: note.author || "Coachlink 解读笔记",
      cover_image: note.coverImage ?? null,
      audio_url: note.audioUrl ?? null,
      summary: note.summary,
      is_free: note.isFree ?? true,
      is_published: note.isPublished ?? false,
      sort_order: note.sortOrder,
    },
    content: {
      format: bundle.format || "book-note-v2-workspace",
      noteStyle: bundle.noteStyle || "interpretive-reading-note",
      disclaimer: bundle.disclaimer,
      markdown: appendKnowledgeBookRightsNotice(
        markdown,
        bundle.source.copyrightMode
      ),
      imagePrompts: note.imagePrompts || [],
      mindMap,
      readingGuide: note.readingGuide || {
        estimatedMinutes,
        goals: note.noteType === "overview"
          ? ["快速建立全书框架", "确定后续章节阅读顺序"]
          : ["理解本章核心问题", "识别常见误区", "形成可执行的训练复盘"],
      },
      keyTakeaways: note.keyTakeaways || topLevelTakeaways,
      discussionPrompts:
        note.discussionPrompts || createDefaultDiscussionPrompts(note),
      citations: note.citations || [],
    },
  };
}
