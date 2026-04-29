export type ImagePrompt = {
  title: string;
  intent: string;
  prompt: string;
};

export const KNOWLEDGE_BOOK_RIGHTS_NOTICE =
  "本书仅为阅读笔记，如果侵权请联系平台，我们会删除相关的内容。";

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

export function appendKnowledgeBookRightsNotice(markdown: string) {
  const normalized = markdown.trim();
  if (!normalized) {
    return `> ${KNOWLEDGE_BOOK_RIGHTS_NOTICE}\n`;
  }

  if (normalized.includes(KNOWLEDGE_BOOK_RIGHTS_NOTICE)) {
    return `${normalized}\n`;
  }

  return `${normalized}\n\n---\n\n> ${KNOWLEDGE_BOOK_RIGHTS_NOTICE}\n`;
}

export function createKnowledgeBookManifestFromWorkspace(input: {
  bundle: KnowledgeBookWorkspaceBundle;
  note: KnowledgeBookWorkspaceNote;
  markdown: string;
}): KnowledgeBookManifest {
  const { bundle, note, markdown } = input;

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
      is_published: note.isPublished ?? true,
      sort_order: note.sortOrder,
    },
    content: {
      format: bundle.format || "book-note-v2-workspace",
      noteStyle: bundle.noteStyle || "interpretive-reading-note",
      disclaimer: bundle.disclaimer,
      markdown: appendKnowledgeBookRightsNotice(markdown),
      imagePrompts: note.imagePrompts || [],
    },
  };
}
