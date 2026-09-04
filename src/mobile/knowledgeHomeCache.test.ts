import { beforeEach, describe, expect, it, vi } from 'vitest'

const values = new Map<string, string>()
const storageMock = {
  getItem: vi.fn(async (key: string) => values.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    values.set(key, value)
  }),
}

import {
  KNOWLEDGE_HOME_CACHE_RETENTION_MS,
  knowledgeHomeCacheScope,
  readKnowledgeHomeCache as readKnowledgeHomeCacheImpl,
  writeKnowledgeHomeCache as writeKnowledgeHomeCacheImpl,
  type KnowledgeHomeCachePayload,
} from '../../apps/mobile/src/screens/knowledge/knowledgeHomeCache'

function readKnowledgeHomeCache(scope: string, now: number) {
  return readKnowledgeHomeCacheImpl(scope, now, storageMock)
}

function writeKnowledgeHomeCache(scope: string, payload: KnowledgeHomeCachePayload, now: number) {
  return writeKnowledgeHomeCacheImpl(scope, payload, now, storageMock)
}

describe('knowledgeHomeCache', () => {
  beforeEach(() => {
    values.clear()
    vi.clearAllMocks()
  })

  it('keeps guest and signed-in data in separate scopes', async () => {
    await writeKnowledgeHomeCache('guest', {
      plans: [{ id: 'public-plan' }],
      books: [],
      articles: [],
    }, 1_000)
    await writeKnowledgeHomeCache('user:user-a', {
      plans: [{ id: 'private-plan' }],
      books: [{ id: 'book-a' }],
      articles: [{ id: 'article-a' }],
    }, 2_000)

    await expect(readKnowledgeHomeCache('guest', 2_000)).resolves.toEqual({
      plans: [{ id: 'public-plan' }],
      books: [],
      articles: [],
    })
    await expect(readKnowledgeHomeCache('user:user-a', 2_000)).resolves.toEqual({
      plans: [{ id: 'private-plan' }],
      books: [{ id: 'book-a' }],
      articles: [{ id: 'article-a' }],
    })
    expect(knowledgeHomeCacheScope()).toBe('guest')
    expect(knowledgeHomeCacheScope('user-a')).toBe('user:user-a')
  })

  it('drops entries after the 60 day retention window', async () => {
    const savedAt = 10_000
    await writeKnowledgeHomeCache('guest', {
      plans: [{ id: 'plan' }],
      books: [],
      articles: [],
    }, savedAt)

    await expect(
      readKnowledgeHomeCache('guest', savedAt + KNOWLEDGE_HOME_CACHE_RETENTION_MS),
    ).resolves.toEqual({
      plans: [{ id: 'plan' }],
      books: [],
      articles: [],
    })
    await expect(
      readKnowledgeHomeCache('guest', savedAt + KNOWLEDGE_HOME_CACHE_RETENTION_MS + 1),
    ).resolves.toBeNull()
  })
})
