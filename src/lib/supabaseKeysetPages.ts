/**
 * Supabase (PostgREST) answers every request with at most `max-rows` rows
 * (1000 for CoachLink) and silently drops the rest. Batch jobs must read page
 * by page, ordered by primary key, until a page comes back short.
 *
 * Pagination uses `gt("id", lastId)` rather than `range()` so the query shape
 * stays the same as a plain filtered select.
 */
export const SUPABASE_MAX_ROWS = 1000;
export const DEFAULT_ID_CHUNK_SIZE = 100;

type PageResult<T> = { data: T[] | null; error: unknown };
type ReadResult<T> = { data: T[]; error: null } | { data: null; error: unknown };

export async function readAllRowsByKeyset<T extends { id?: unknown }>(
    buildPage: (afterId: string | null) => PromiseLike<PageResult<T>>,
    pageSize = SUPABASE_MAX_ROWS,
): Promise<ReadResult<T>> {
    const rows: T[] = [];
    let afterId: string | null = null;

    for (;;) {
        const { data, error } = await buildPage(afterId);
        if (error) return { data: null, error };
        const page = data || [];
        rows.push(...page);
        if (page.length < pageSize) return { data: rows, error: null };

        const lastId = String(page[page.length - 1]?.id ?? "");
        if (!lastId || lastId === afterId) {
            return { data: null, error: new Error("分页读取需要按 id 排序且返回 id 字段") };
        }
        afterId = lastId;
    }
}

export function chunkIds(ids: readonly (string | null | undefined)[], size = DEFAULT_ID_CHUNK_SIZE) {
    const unique = Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
    const chunks: string[][] = [];
    for (let index = 0; index < unique.length; index += size) {
        chunks.push(unique.slice(index, index + size));
    }
    return chunks;
}

/** Read every row for a long id list: short `in` chunks, each fully paginated. */
export async function readAllRowsByIdChunks<T extends { id?: unknown }>(
    ids: readonly (string | null | undefined)[],
    buildPage: (chunk: string[], afterId: string | null) => PromiseLike<PageResult<T>>,
    options: { chunkSize?: number; pageSize?: number } = {},
): Promise<ReadResult<T>> {
    const rows: T[] = [];
    for (const chunk of chunkIds(ids, options.chunkSize)) {
        const result = await readAllRowsByKeyset((afterId) => buildPage(chunk, afterId), options.pageSize);
        if (result.error) return { data: null, error: result.error };
        rows.push(...(result.data || []));
    }
    return { data: rows, error: null };
}
