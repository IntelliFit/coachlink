import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { groupKnowledgeBooks } from '../../apps/mobile/src/screens/knowledge/knowledgeBooks'
import { formatRest } from '../../apps/mobile/src/screens/knowledge/knowledgeHelpers'

const ROOT = resolve(__dirname, '../..')

/** 去掉移植头注释后，APP 的书籍聚合逻辑必须与小程序原文件逐行一致。 */
function body(path: string) {
  return readFileSync(resolve(ROOT, path), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('// 移植自'))
    .join('\n')
    .trim()
}

describe('mobile knowledge lists stay aligned with the mini-program', () => {
  it('ports knowledgeBooks.ts verbatim', () => {
    expect(body('apps/mobile/src/screens/knowledge/knowledgeBooks.ts')).toBe(body('apps/wechat/src/utils/knowledgeBooks.ts'))
  })

  it('groups standalone books', () => {
    const collections = groupKnowledgeBooks([{ id: 'b1', title: '力量训练原理', summary: '总览' }])
    expect(collections).toHaveLength(1)
    expect(collections[0].representativeBook.id).toBe('b1')
  })

  it('shows plan rest time in minutes', () => {
    expect(formatRest(90)).toBe('1.5分钟')
    expect(formatRest('120')).toBe('2分钟')
    expect(formatRest(0)).toBe('按动作安排')
    expect(formatRest(null)).toBe('按动作安排')
  })
})

describe('book detail structured sections', () => {
  it('reads guide, takeaways, mind map, prompts and citations like the mini-program', async () => {
    const { bookExtras } = await import('../../apps/mobile/src/screens/knowledge/bookExtras')
    const extras = bookExtras({
      readingGuide: { estimatedMinutes: 12, goals: ['理解渐进超负荷'] },
      keyTakeaways: ['先动作后重量', ''],
      mindMap: { title: '结构', data: [{ title: '原则', children: [{ title: '超负荷' }] }] },
      discussionPrompts: ['你练到平台期时怎么调整？'],
      citations: [{ title: '原书', url: 'https://x.com' }, { url: 'https://no-title' }],
    })
    expect(extras.readingGuide?.estimatedMinutes).toBe(12)
    expect(extras.keyTakeaways).toEqual(['先动作后重量'])
    expect(extras.mindMap?.data[0].children?.[0].title).toBe('超负荷')
    expect(extras.discussionPrompts).toHaveLength(1)
    expect(extras.citations).toEqual([{ title: '原书', url: 'https://x.com' }])
    expect(bookExtras('plain text')).toEqual({ readingGuide: null, keyTakeaways: [], mindMap: null, discussionPrompts: [], citations: [] })
  })
})
