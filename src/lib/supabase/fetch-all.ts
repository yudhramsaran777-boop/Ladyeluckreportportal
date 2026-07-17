// Helpers to fetch EVERY matching row from Supabase.
//
// WHY THIS EXISTS (bug fixed 2026-07-17):
// Supabase/PostgREST silently caps every query at 1,000 rows. The owner
// dashboard queries game entries for ALL shops in one query, while each
// manager dashboard only queries its own shop. On wide date ranges the
// owner query hit the cap and dropped rows, so owner totals came out
// LOWER than the sum of the manager dashboards. All report/dashboard
// views must use these helpers instead of raw .select() for bulk reads.

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message?: string } | null;
}

type PageQuery<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;

/**
 * Repeatedly calls buildQuery with .range() bounds until a short page is
 * returned, so results are complete even past the 1,000-row cap.
 * The caller MUST apply .range(from, to) to the query it builds.
 * A stable .order() is recommended for deterministic paging.
 */
export async function fetchAllRows<T>(buildQuery: PageQuery<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("fetchAllRows: page query failed:", error.message ?? error);
      throw new Error(`fetchAllRows failed: ${error.message ?? "unknown error"}`);
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/** Splits a list into chunks (default 200) to keep .in() URL lengths safe. */
export function chunkIds<T>(ids: T[], size = 200): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

/**
 * Fetches all rows matching .in(column, ids) filters where ids can be any
 * length: chunks the id list AND pages each chunk past the 1,000-row cap.
 */
export async function fetchAllByIds<T>(
  ids: string[],
  buildQuery: (idChunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  if (!ids.length) return [];
  const all: T[] = [];
  for (const idChunk of chunkIds(ids)) {
    const rows = await fetchAllRows<T>((from, to) => buildQuery(idChunk, from, to));
    all.push(...rows);
  }
  return all;
}
