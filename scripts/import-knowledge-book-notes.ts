import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { serviceRoleSupabase } from "../src/lib/supabaseClient";
import {
  strengthTrainingPrinciplesNote,
  strengthTrainingPrinciplesNotes,
} from "../src/content/knowledgeBooks/strengthTrainingPrinciplesNote";
import type { Json } from "../src/types/database.types";

type BookManifest = typeof strengthTrainingPrinciplesNote;

const REGISTRY: Record<string, BookManifest[]> = {
  [strengthTrainingPrinciplesNote.source.collectionSlug]:
    strengthTrainingPrinciplesNotes,
  [strengthTrainingPrinciplesNote.slug]: [strengthTrainingPrinciplesNote],
  ...Object.fromEntries(
    strengthTrainingPrinciplesNotes.map((manifest) => [manifest.slug, [manifest]]),
  ),
};

for (const fileName of [".env.local", ".env.development", ".env"]) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("  npx tsx scripts/import-knowledge-book-notes.ts <slug> [--apply]");
  console.log("");
  console.log("Available slugs:");
  for (const slug of Object.keys(REGISTRY)) {
    console.log(`  - ${slug}`);
  }
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function upsertBook(manifest: BookManifest) {
  const content = JSON.parse(
    JSON.stringify({
      ...manifest.content,
      source: manifest.source,
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

async function upsertBooks(manifests: BookManifest[]) {
  const results = [];
  for (const manifest of manifests) {
    const result = await upsertBook(manifest);
    results.push({
      slug: manifest.slug,
      ...result,
    });
  }
  return results;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const positionalSlug =
    process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--")) ||
    getArgValue("--book");

  if (!positionalSlug || positionalSlug === "--help") {
    printUsage();
    process.exit(positionalSlug ? 0 : 1);
  }

  const manifests = REGISTRY[positionalSlug];
  if (!manifests) {
    console.error(`Unknown slug: ${positionalSlug}`);
    printUsage();
    process.exit(1);
  }

  const preview = manifests.map((manifest) => ({
    slug: manifest.slug,
    title: manifest.book.title,
    summary: manifest.book.summary,
    is_free: manifest.book.is_free,
    is_published: manifest.book.is_published,
    image_prompt_count: manifest.content.imagePrompts.length,
    source_title: manifest.source.title,
    collection_slug: manifest.source.collectionSlug,
    chapter_order: manifest.source.chapterOrder,
  }));

  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to write into knowledge_books.");
    return;
  }

  const result = await upsertBooks(manifests);
  console.log("");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Failed to import knowledge book note:");
  console.error(error);
  process.exit(1);
});
