import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeVideoPlayer } from './NativeMedia'
import { colors, radius, spacing } from '../theme'

export type VideoPlayerTarget = { url: string; title?: string }

/** 应用内全屏播放视频，对应小程序 common/video-player 页面。 */
export function VideoPlayerModal({ target, onClose }: { target: VideoPlayerTarget | null; onClose: () => void }) {
  return (
    <Modal visible={Boolean(target?.url)} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{target?.title || '视频'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭视频" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          {target?.url ? <NativeVideoPlayer key={target.url} url={target.url} title={target.title || '视频'} /> : null}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: {
    flex: 1,
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  close: {
    minHeight: 48,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.sm,
  },
})
