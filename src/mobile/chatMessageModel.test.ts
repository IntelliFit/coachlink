import { describe, expect, it } from 'vitest'
import {
  buildMessagePreview,
  buildReplyQuote,
  buildVideoDateLabel,
  buildVideoTrainingStats,
  latestStableMessageId,
  messageMetadataBadge,
  readReplyQuote,
  readVideoReferences,
  videoItemToReference,
  videoReferenceSummary,
} from '../../apps/mobile/src/screens/messages/chatMessageModel'

describe('mobile chat message model', () => {
  it('builds previews like the mini-program', () => {
    expect(buildMessagePreview({ content: '  你好  ', messageType: 'text' })).toBe('你好')
    expect(buildMessagePreview({ content: '', messageType: 'image' })).toBe('[图片]')
    expect(buildMessagePreview({ content: '', messageType: 'video_reference' })).toBe('[视频引用]')
    expect(buildMessagePreview({ content: '', messageType: 'unknown', mediaUrl: 'https://x' })).toBe('[媒体消息]')
    expect(buildMessagePreview({ content: 'a'.repeat(130), messageType: 'text' })).toBe(`${'a'.repeat(120)}...`)
  })

  it('round-trips reply quotes and ignores malformed metadata', () => {
    const quote = buildReplyQuote({ id: 'm1', chatUserId: 'u1', chatUserProfile: { name: '王教练' }, messageType: 'text', content: '练得不错' })
    expect(quote).toEqual({ id: 'm1', senderId: 'u1', senderName: '王教练', messageType: 'text', contentPreview: '练得不错', mediaUrl: null })
    expect(buildReplyQuote({ id: 'm2', isMine: true, content: 'hi' }).senderName).toBe('我')
    expect(readReplyQuote({ contentMetadata: { reply_to_message: quote } })).toEqual(quote)
    expect(readReplyQuote({ contentMetadata: { reply_to_message: { senderName: 'x' } } })).toBeNull()
    expect(readReplyQuote({ contentMetadata: null })).toBeNull()
  })

  it('reads video references and formats training labels', () => {
    const [video] = readVideoReferences({
      contentMetadata: {
        video_references: [
          { videoId: 'v1', videoUrl: 'https://v/1.mp4', actionName: '深蹲', sourceType: 'execution_set', setNumber: 2, weight: '100', reps: 5, isProgress: true, createdAt: '2026-10-26T16:30:00.000Z', dayIndex: 3 },
          { nope: true },
        ],
      },
    })
    expect(video.weight).toBe(100)
    expect(buildVideoTrainingStats(video)).toBe('第 2 组 · 训练重量 100kg · 5次')
    // 北京时间跨天：UTC 16:30 已是次日 00:30。
    expect(buildVideoDateLabel(video)).toBe('训练日期 2026年10月27日 · 计划第 3 天')

    const personal = videoItemToReference({ id: 'vc:9', videoUrl: 'https://v/9.mp4', thumbnailUrl: null, actionName: '自拍', setNumber: 1, weight: null, reps: null, isProgress: false, createdAt: '2026-10-01T00:00:00.000Z', sourceType: 'video_collection' })
    expect(buildVideoTrainingStats(personal)).toBe('个人视频')
    expect(buildVideoDateLabel(personal)).toBe('上传日期 2026年10月01日')
    expect(videoReferenceSummary([video])).toBe('[视频] 深蹲')
    expect(videoReferenceSummary([video, personal])).toBe('[2个视频]')
  })

  it('labels AI replies and broadcasts', () => {
    expect(messageMetadataBadge({ contentMetadata: { coach_ai_auto_reply: true } })).toBe('教练 AI 自动回复')
    expect(messageMetadataBadge({ contentMetadata: { broadcast: true } })).toBe('群发通知')
    expect(messageMetadataBadge({ contentMetadata: null })).toBe('')
  })

  it('finds the newest persisted message id for read receipts', () => {
    expect(latestStableMessageId([{ id: 'a' }, { id: 'b' }, { id: 'temp-1' }])).toBe('b')
    expect(latestStableMessageId([{ id: 'temp-1' }])).toBe('')
  })
})
