// Supabase/PostgREST returns at most 1000 rows per request. Any query that can exceed
// that MUST page through with .range(), or it silently truncates. This helper runs a
// range-based query repeatedly until every row is fetched.
//
// Usage:
//   const contacts = await fetchAllRows((from, to) =>
//     adminClient.from('whatsapp_contacts').select('id').eq('sheet_id', id).range(from, to))

const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}
