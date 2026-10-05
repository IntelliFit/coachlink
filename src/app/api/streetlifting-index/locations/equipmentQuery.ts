import { matchesLocationEquipment, withLocationEquipment, type LocationEquipmentInput, type LocationEquipmentType } from '@coachlink/core'

type ReadResult<T> = { data: T[] | null; error: { message: string } | null }

// Resolve both old description suggestions and confirmed selections before
// counting/paging. Chunked reads avoid PostgREST's response row limit.
export async function readEquipmentLocations<T extends LocationEquipmentInput>(
  readRange: (from: number, to: number) => PromiseLike<ReadResult<T>>,
  equipment: LocationEquipmentType[]
) {
  const matches: ReturnType<typeof withLocationEquipment<T>>[] = []
  const batchSize = 500
  for (let from = 0; ; from += batchSize) {
    const result = await readRange(from, from + batchSize - 1)
    if (result.error) throw new Error(result.error.message)
    const rows = result.data || []
    rows.forEach(row => {
      if (matchesLocationEquipment(row, equipment)) matches.push(withLocationEquipment(row))
    })
    if (rows.length < batchSize) break
  }
  return matches
}
