import fs from "node:fs";
import path from "node:path";

import {
  createKnowledgeBookManifestFromWorkspace,
  type KnowledgeBookManifest,
  type KnowledgeBookWorkspaceBundle,
} from "@/content/knowledgeBooks/schema";

export const KNOWLEDGE_BOOK_WORKSPACE_ROOT = path.resolve(
  process.cwd(),
  "src/content/knowledgeBooks/workspaces"
);

export const KNOWLEDGE_BOOK_WORKSPACE_TEMP_ROOT = path.resolve(
  process.cwd(),
  "temp_dir/knowledge-book-workspaces"
);

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function listKnowledgeBookWorkspaceSlugs() {
  if (!fs.existsSync(KNOWLEDGE_BOOK_WORKSPACE_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(KNOWLEDGE_BOOK_WORKSPACE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) =>
      fs.existsSync(path.join(KNOWLEDGE_BOOK_WORKSPACE_ROOT, slug, "book.json"))
    )
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function loadKnowledgeBookWorkspaceBundle(collectionSlug: string) {
  const workspaceDir = path.join(KNOWLEDGE_BOOK_WORKSPACE_ROOT, collectionSlug);
  const bundlePath = path.join(workspaceDir, "book.json");
  const tempDir = path.join(KNOWLEDGE_BOOK_WORKSPACE_TEMP_ROOT, collectionSlug);

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Workspace not found: ${collectionSlug}`);
  }

  const bundle = readJsonFile<KnowledgeBookWorkspaceBundle>(bundlePath);

  const manifests: KnowledgeBookManifest[] = bundle.notes.map((note) => {
    const markdownPath = path.join(workspaceDir, note.file);
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Markdown file not found: ${markdownPath}`);
    }

    return createKnowledgeBookManifestFromWorkspace({
      bundle,
      note,
      markdown: fs.readFileSync(markdownPath, "utf8"),
    });
  });

  return {
    workspaceDir,
    tempDir,
    bundle,
    manifests,
  };
}

export function loadAllKnowledgeBookWorkspaceBundles() {
  return listKnowledgeBookWorkspaceSlugs().map((slug) =>
    loadKnowledgeBookWorkspaceBundle(slug)
  );
}
