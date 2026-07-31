import { loadAllKnowledgeBookWorkspaceBundles } from "../src/lib/knowledgeBookWorkspace";
import {
  strengthTrainingPrinciplesNote,
  strengthTrainingPrinciplesNotes,
} from "../src/content/knowledgeBooks/strengthTrainingPrinciplesNote";
import type { KnowledgeBookManifest } from "../src/content/knowledgeBooks/schema";
import type { Json } from "../src/types/database.types";

type BookManifest = KnowledgeBookManifest;
type ServiceRoleClient =
  typeof import("../src/lib/supabaseClient").serviceRoleSupabase;

const ALL_WORKSPACE_MANIFESTS = loadAllKnowledgeBookWorkspaceBundles()
  .flatMap(({ manifests }) => manifests);

const WORKSPACE_REGISTRY: Record<string, BookManifest[]> = Object.fromEntries(
  loadAllKnowledgeBookWorkspaceBundles().flatMap(({ bundle, manifests }) => [
    [bundle.source.collectionSlug, manifests],
    ...manifests.map((manifest) => [manifest.slug, [manifest]] as const),
  ])
);

const LEGACY_REGISTRY: Record<string, BookManifest[]> = {
  [strengthTrainingPrinciplesNote.source.collectionSlug]:
    strengthTrainingPrinciplesNotes,
  [strengthTrainingPrinciplesNote.slug]: [strengthTrainingPrinciplesNote],
  ...Object.fromEntries(
    strengthTrainingPrinciplesNotes.map((manifest) => [manifest.slug, [manifest]]),
  ),
};

const REGISTRY: Record<string, BookManifest[]> = {
  ...LEGACY_REGISTRY,
  ...WORKSPACE_REGISTRY,
};

async function loadRuntimeEnv() {
  const bootstrap = (await import("./config/bootstrap-env.mjs")) as {
    bootstrapEnv: (options: {
      mode: string;
      projectRoot: string;
    }) => Promise<void>;
  };

  await bootstrap.bootstrapEnv({
    mode: process.env.NODE_ENV || "development",
    projectRoot: process.cwd(),
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  npx tsx scripts/import-knowledge-book-notes.ts <slug> [--apply]");
  console.log("  npx tsx scripts/import-knowledge-book-notes.ts --all-workspaces [--summary] [--apply|--verify]");
  console.log("");
  console.log("Available slugs:");
  for (const slug of Object.keys(REGISTRY)) {
    console.log(`  - ${slug}`);
  }
}

async function verifyBooks(
  manifests: BookManifest[],
  serviceRoleSupabase: ServiceRoleClient,
) {
  const expectedTitles = [...new Set(manifests.map((manifest) => manifest.book.title))];
  const records: Array<{
    title: string;
    is_published: boolean;
    content: Json | null;
  }> = [];

  for (let index = 0; index < expectedTitles.length; index += 10) {
    const titleBatch = expectedTitles.slice(index, index + 10);
    const { data, error } = await serviceRoleSupabase
      .from("knowledge_books")
      .select("title, is_published, content")
      .in("title", titleBatch);

    if (error) throw error;
    records.push(...(data || []));
  }

  const matchedTitles = new Set(records.map((record) => record.title));
  const missingTitles = expectedTitles.filter((title) => !matchedTitles.has(title));
  const duplicateTitles = [...matchedTitles].filter(
    (title) => records.filter((record) => record.title === title).length > 1,
  );
  const hasMindMap = (content: Json | null) =>
    Boolean(
      content &&
        typeof content === "object" &&
        !Array.isArray(content) &&
        content.mindMap,
    );

  return {
    expected: expectedTitles.length,
    matched: matchedTitles.size,
    published: records.filter((record) => record.is_published).length,
    unpublished: records.filter((record) => !record.is_published).length,
    withMindMap: records.filter((record) => hasMindMap(record.content)).length,
    missingTitles,
    duplicateTitles,
    ok:
      matchedTitles.size === expectedTitles.length &&
      missingTitles.length === 0 &&
      duplicateTitles.length === 0,
  };
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function upsertBook(
  manifest: BookManifest,
  serviceRoleSupabase: ServiceRoleClient,
) {
  const {
    originalFilePath: _privateOriginalFilePath,
    ...publicSource
  } = manifest.source;
  const content = JSON.parse(
    JSON.stringify({
      ...manifest.content,
      // 原始文件路径只属于本地整理工作区，禁止写入会返回给客户端的 JSONB。
      source: publicSource,
      createdAt: new Date().toISOString(),
    }),
  ) as Json;

  const payload = {
    ...manifest.book,
    content,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await serviceRoleSupabase
    .from("knowledge_books")
    .select("id, title")
    .eq("title", manifest.book.title)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    const { data, error } = await serviceRoleSupabase
      .from("knowledge_books")
      .update(payload)
      .eq("id", existing.id)
      .select("id, title, is_free, is_published, updated_at")
      .single();

    if (error) throw error;
    return { mode: "updated", record: data };
  }

  const { data, error } = await serviceRoleSupabase
    .from("knowledge_books")
    .insert(payload)
    .select("id, title, is_free, is_published, created_at")
    .single();

  if (error) throw error;
  return { mode: "inserted", record: data };
}

async function upsertBooks(
  manifests: BookManifest[],
  serviceRoleSupabase: ServiceRoleClient,
) {
  const results = [];
  for (const manifest of manifests) {
    const result = await upsertBook(manifest, serviceRoleSupabase);
    results.push({
      slug: manifest.slug,
      ...result,
    });
  }
  return results;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verify = process.argv.includes("--verify");
  const allWorkspaces = process.argv.includes("--all-workspaces");
  const summaryOnly = process.argv.includes("--summary");
  const positionalSlug =
    process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--")) ||
    getArgValue("--book");

  if ((!positionalSlug && !allWorkspaces) || positionalSlug === "--help") {
    printUsage();
    process.exit(positionalSlug ? 0 : 1);
  }

  const manifests = allWorkspaces
    ? ALL_WORKSPACE_MANIFESTS
    : REGISTRY[positionalSlug as string];
  if (!manifests) {
    console.error(`Unknown slug: ${positionalSlug}`);
    printUsage();
    process.exit(1);
  }

  if (apply && verify) {
    console.error("Choose either --apply or --verify, not both.");
    process.exit(1);
  }

  if (verify) {
    await loadRuntimeEnv();
    const { serviceRoleSupabase } = await import("../src/lib/supabaseClient");
    const result = await verifyBooks(manifests, serviceRoleSupabase);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 2;
    return;
  }

  const preview = manifests.map((manifest) => ({
    slug: manifest.slug,
    title: manifest.book.title,
    summary: manifest.book.summary,
    is_free: manifest.book.is_free,
    is_published: manifest.book.is_published,
    image_prompt_count: manifest.content.imagePrompts.length,
    mind_map_node_count: manifest.content.mindMap?.data?.[0]?.children?.length || 0,
    discussion_prompt_count: manifest.content.discussionPrompts?.length || 0,
    source_title: manifest.source.title,
    collection_slug: manifest.source.collectionSlug,
    chapter_order: manifest.source.chapterOrder,
  }));

  if (summaryOnly) {
    const collectionCount = new Set(
      manifests.map((manifest) => manifest.source.collectionSlug)
    ).size;
    console.log(JSON.stringify({
      manifestCount: manifests.length,
      collectionCount,
      publishedCount: manifests.filter((manifest) => manifest.book.is_published).length,
      publicDomainCount: manifests.filter(
        (manifest) => manifest.source.copyrightMode === "public-domain"
      ).length,
      mindMapCount: manifests.filter((manifest) => manifest.content.mindMap).length,
    }, null, 2));
  } else {
    console.log(JSON.stringify(preview, null, 2));
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to write into knowledge_books.");
    return;
  }

  // 只有真正写库时才加载运行时配置；dry-run 永远保持纯本地、无远端副作用。
  await loadRuntimeEnv();
  const { serviceRoleSupabase } = await import("../src/lib/supabaseClient");
  const result = await upsertBooks(manifests, serviceRoleSupabase);
  console.log("");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Failed to import knowledge book note:");
  console.error(error);
  process.exit(1);
});
