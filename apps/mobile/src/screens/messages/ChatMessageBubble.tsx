import { memo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont } from '../../components/IconFont'
import type { VideoPlayerTarget } from '../../components/VideoPlayerModal'
import { colors, radius, spacing } from '../../theme'
import {
  buildVideoDateLabel,
  buildVideoTrainingStats,
  messageMetadataBadge,
  readReplyQuote,
  readVideoReferences,
  type ChatMessage,
} from './chatMessageModel'

type ChatMessageBubbleProps = {
  message: ChatMessage
  highlighted: boolean
  onLongPress: (message: ChatMessage) => void
  onJumpToMessage: (messageId: string) => void
  onPreviewImage: (url: string) => void
  onPlayVideo: (target: VideoPlayerTarget) => void
  onOpenFile: (url: string) => void
}

export function formatMessageTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return hm
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return date.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${date.getFullYear()}-${md} ${hm}`
}

function MessageBody({ message, onPreviewImage, onPlayVideo, onOpenFile }: Pick<ChatMessageBubbleProps, 'message' | 'onPreviewImage' | 'onPlayVideo' | 'onOpenFile'>) {
  const mine = Boolean(message.isMine)
  const textStyle = [styles.content, mine && styles.contentMine]

  if (message.messageType === 'image' && message.mediaUrl) {
    const url = message.mediaUrl
    return (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="查看图片" onPress={() => onPreviewImage(url)}>
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
      </Pressable>
    )
  }

  if (message.messageType === 'video_reference') {
    const videos = readVideoReferences(message)
    if (videos.length === 0) return <Text style={textStyle}>{message.content || '[视频引用]'}</Text>
    return (
      <View style={styles.videoList}>
        {videos.map((video) => (
          <Pressable
            key={video.videoId}
            accessibilityRole="button"
            accessibilityLabel={`播放训练视频：${video.actionName}`}
            disabled={!video.videoUrl}
            onPress={() => onPlayVideo({ url: video.videoUrl, title: video.actionName })}
            style={({ pressed }) => [styles.videoCard, pressed && styles.pressed]}
          >
            {video.thumbnailUrl ? (
              <Image source={{ uri: video.thumbnailUrl }} style={styles.videoCover} resizeMode="cover" />
            ) : (
              <View style={[styles.videoCover, styles.videoCoverPlaceholder]}>
                <IconFont name="icon-video" size={22} color={colors.surface} />
              </View>
            )}
            <View style={styles.videoInfo}>
              <View style={styles.videoTitleRow}>
                <Text style={styles.videoTitle} numberOfLines={1}>{video.actionName}</Text>
                {video.isProgress ? <Text style={styles.prTag}>PR</Text> : null}
              </View>
              <Text style={styles.videoMeta} numberOfLines={1}>{buildVideoDateLabel(video)}</Text>
              <Text style={styles.videoMeta} numberOfLines={1}>{buildVideoTrainingStats(video)}</Text>
              <Text style={styles.videoOpen}>点击查看视频</Text>
            </View>
          </Pressable>
        ))}
      </View>
    )
  }

  if (message.messageType === 'video' && message.mediaUrl) {
    const url = message.mediaUrl
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="播放视频消息" onPress={() => onPlayVideo({ url, title: '视频消息' })} style={styles.fileCard}>
        <IconFont name="icon-video" size={20} color={colors.brand} />
        <View style={styles.fileBody}>
          <Text style={styles.fileTitle}>视频消息</Text>
          <Text style={styles.fileSubtitle}>点击播放</Text>
        </View>
      </Pressable>
    )
  }

  if ((message.messageType === 'voice' || message.messageType === 'file') && message.mediaUrl) {
    const url = message.mediaUrl
    const isVoice = message.messageType === 'voice'
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={isVoice ? '打开语音消息' : `打开文件 ${message.fileName || ''}`} onPress={() => onOpenFile(url)} style={styles.fileCard}>
        <IconFont name={isVoice ? 'icon-messages' : 'icon-download'} size={20} color={colors.brand} />
        <View style={styles.fileBody}>
          <Text style={styles.fileTitle} numberOfLines={1}>{isVoice ? '语音消息' : message.fileName || '文件'}</Text>
          <Text style={styles.fileSubtitle} numberOfLines={1}>{isVoice ? (message.duration ? `${message.duration}s · 点击收听` : '点击收听') : '点击打开'}</Text>
        </View>
      </Pressable>
    )
  }

  return <Text style={textStyle} selectable>{message.content || ''}</Text>
}

function ChatMessageBubbleBase({ message, highlighted, onLongPress, onJumpToMessage, onPreviewImage, onPlayVideo, onOpenFile }: ChatMessageBubbleProps) {
  const mine = Boolean(message.isMine)
  const reply = readReplyQuote(message)
  const badge = messageMetadataBadge(message)
  const status = message.failed ? '发送失败，长按重发' : message.pending ? '发送中…' : formatMessageTime(message.createdAt)

  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <Pressable
        accessibilityRole="text"
        accessibilityHint="长按可回复或复制"
        delayLongPress={350}
        onLongPress={() => onLongPress(message)}
        style={[styles.bubble, mine && styles.bubbleMine, highlighted && styles.bubbleHighlighted]}
      >
        {!mine ? <Text style={styles.sender}>{message.chatUserProfile?.name || '对方'}</Text> : null}
        {badge ? <Text style={[styles.badge, mine && styles.badgeMine]}>{badge}</Text> : null}
        {reply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看被引用的消息：${reply.contentPreview}`}
            onPress={() => onJumpToMessage(reply.id)}
            style={[styles.quote, mine && styles.quoteMine]}
          >
            <Text style={[styles.quoteName, mine && styles.quoteTextMine]} numberOfLines={1}>{reply.senderName}</Text>
            <Text style={[styles.quoteText, mine && styles.quoteTextMine]} numberOfLines={1}>{reply.contentPreview}</Text>
          </Pressable>
        ) : null}
        <MessageBody message={message} onPreviewImage={onPreviewImage} onPlayVideo={onPlayVideo} onOpenFile={onOpenFile} />
        <Text style={[styles.time, mine && styles.timeMine, message.failed && styles.failed]}>{status}</Text>
      </Pressable>
    </View>
  )
}

export const ChatMessageBubble = memo(ChatMessageBubbleBase)

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    gap: 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  bubbleHighlighted: {
    borderColor: '#F5B700',
    borderWidth: 2,
  },
  sender: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  badgeMine: {
    color: colors.surface,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    backgroundColor: 'rgba(207,109,78,0.08)',
  },
  quoteMine: {
    borderLeftColor: colors.surface,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  quoteName: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '600',
  },
  quoteText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  quoteTextMine: {
    color: 'rgba(255,255,255,0.86)',
  },
  content: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  contentMine: {
    color: '#FFFFFF',
  },
  image: {
    width: 216,
    height: 216,
    maxWidth: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  videoList: {
    gap: spacing.xs,
  },
  videoCard: {
    width: 248,
    maxWidth: '100%',
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.82,
  },
  videoCover: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  videoCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textSecondary,
  },
  videoInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  videoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  prTag: {
    color: colors.surface,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  videoMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  videoOpen: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '600',
  },
  fileCard: {
    minHeight: 48,
    minWidth: 184,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fileBody: {
    flex: 1,
    minWidth: 0,
  },
  fileTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fileSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  time: {
    color: colors.textTertiary,
    fontSize: 10,
  },
  timeMine: {
    color: 'rgba(255,255,255,0.72)',
  },
  failed: {
    color: '#FFF1A8',
    fontWeight: '700',
  },
})
