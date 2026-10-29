import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { colors, radius, spacing } from '../../theme'
import {
  buildVideoDateLabel,
  buildVideoTrainingStats,
  videoItemToReference,
  type StudentVideoItem,
  type VideoReference,
} from './chatMessageModel'

type ChatVideoPickerProps = {
  visible: boolean
  /** 教练端选学员的视频，学员端选自己的视频（与小程序 targetVideoStudentId 一致）。 */
  studentId: string
  onClose: () => void
  onSend: (videos: VideoReference[]) => void
}

/** 在聊天里引用训练组视频：搜索动作名、只看 PR、多选后发送。 */
export function ChatVideoPicker({ visible, studentId, onClose, onSend }: ChatVideoPickerProps) {
  const [query, setQuery] = useState('')
  const [onlyProgress, setOnlyProgress] = useState(false)
  const [videos, setVideos] = useState<StudentVideoItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ videos?: StudentVideoItem[] }>('/api/chat/list-student-videos', {
        method: 'POST',
        body: { studentId, query: query.trim() || undefined, onlyProgress, page: 1, pageSize: 30 },
        timeoutMs: 15_000,
      })
      setVideos(Array.isArray(data.videos) ? data.videos : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '视频加载失败')
    } finally {
      setLoading(false)
    }
  }, [onlyProgress, query, studentId])

  useEffect(() => {
    if (!visible) return
    void load()
    // 只在打开和切换「只看 PR」时自动加载；关键词由「搜索」按钮触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, onlyProgress, studentId])

  useEffect(() => {
    if (!visible) setSelectedIds([])
  }, [visible])

  const toggle = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const send = () => {
    const selected = videos.filter((video) => selectedIds.includes(video.id)).map(videoItemToReference)
    if (selected.length > 0) onSend(selected)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>引用训练视频</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>关闭</Text>
          </Pressable>
        </View>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <IconFont name="icon-search" size={16} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="搜索动作名称"
              value={query}
              onChangeText={setQuery}
              placeholder="搜索动作名称"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => void load()}
              style={styles.searchInput}
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="搜索" onPress={() => void load()} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>搜索</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="只看 PR 视频"
          accessibilityState={{ checked: onlyProgress }}
          onPress={() => setOnlyProgress((value) => !value)}
          style={[styles.filterChip, onlyProgress && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, onlyProgress && styles.filterTextActive]}>只看 PR</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.list}>
          {loading ? <ActivityIndicator color={colors.brand} /> : null}
          {!loading && error ? <Text style={styles.empty}>{error}</Text> : null}
          {!loading && !error && videos.length === 0 ? <Text style={styles.empty}>暂无可引用视频</Text> : null}
          {videos.map((video) => {
            const reference = videoItemToReference(video)
            const selected = selectedIds.includes(video.id)
            return (
              <Pressable
                key={video.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={video.actionName || '训练视频'}
                onPress={() => toggle(video.id)}
                style={[styles.item, selected && styles.itemSelected]}
              >
                {video.thumbnailUrl ? (
                  <Image source={{ uri: video.thumbnailUrl }} style={styles.cover} resizeMode="cover" />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <IconFont name="icon-video" size={22} color={colors.surface} />
                  </View>
                )}
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{video.actionName || '训练视频'}{video.isProgress ? ' · PR' : ''}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>{buildVideoDateLabel(reference)}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>{buildVideoTrainingStats(reference)}</Text>
                </View>
                <View style={[styles.check, selected && styles.checkActive]}>
                  {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`发送 ${selectedIds.length} 个视频`}
            disabled={selectedIds.length === 0}
            onPress={send}
            style={[styles.sendButton, selectedIds.length === 0 && styles.disabled]}
          >
            <Text style={styles.sendText}>{selectedIds.length > 0 ? `发送 ${selectedIds.length} 个视频` : '请选择视频'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerButton: {
    minHeight: 48,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  searchButton: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  searchButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  filterChip: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.selected,
    backgroundColor: colors.selected,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: colors.selectedText,
  },
  list: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemSelected: {
    borderColor: colors.brand,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textSecondary,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  check: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  sendButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  disabled: {
    opacity: 0.5,
  },
  sendText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
})
