/** 书籍详情的结构化内容（阅读导航、要点、思维导图、讨论问题、来源），与小程序 book-detail normalizeBookContent 同口径。 */
export type MindMapNode = { id?: string; title?: string; description?: string | null; children?: MindMapNode[] }

export type BookExtras = {
  readingGuide: { estimatedMinutes?: number; suitableFor?: string[]; goals?: string[] } | null
  keyTakeaways: string[]
  mindMap: { title?: string; description?: string; data: MindMapNode[] } | null
  discussionPrompts: string[]
  citations: Array<{ title?: string; url?: string; note?: string; license?: string; accessedAt?: string }>
}

export function bookExtras(content: unknown): BookExtras {
  const structured = content && typeof content === 'object' ? content as any : {}
  const strings = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [])
  return {
    readingGuide: structured.readingGuide && typeof structured.readingGuide === 'object' ? structured.readingGuide : null,
    keyTakeaways: strings(structured.keyTakeaways),
    mindMap: Array.isArray(structured.mindMap?.data) && structured.mindMap.data.length ? structured.mindMap : null,
    discussionPrompts: strings(structured.discussionPrompts),
    citations: Array.isArray(structured.citations) ? structured.citations.filter((item: any) => item?.title) : [],
  }
}
