import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import { colors, radius, spacing } from '../theme'
import { IconFont } from './IconFont'

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function NativeVideoPlayer({ url, title = '视频内容' }: { url: string; title?: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false
  })

  return (
    <View style={styles.videoCard}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
      <Text style={styles.videoTitle}>{title}</Text>
    </View>
  )
}

export function NativeAudioPlayer({ url, title = '音频讲解' }: { url: string; title?: string }) {
  const player = useAudioPlayer(url, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)
  const duration = Math.max(0, Number(status.duration || 0))
  const current = Math.min(duration || Number(status.currentTime || 0), Number(status.currentTime || 0))
  const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0

  async function seek(delta: number) {
    await player.seekTo(Math.max(0, Math.min(duration || current + delta, current + delta)))
  }

  return (
    <View style={styles.audioCard}>
      <View style={styles.audioTop}>
        <View style={styles.audioIcon}><IconFont name="icon-video" color={colors.brand} size={20} /></View>
        <View style={styles.audioMain}>
          <Text style={styles.mediaTitle}>{title}</Text>
          <Text style={styles.audioTime}>{formatTime(current)} / {formatTime(duration)}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
      {status.error ? <Text style={styles.errorText}>音频加载失败：{status.error}</Text> : null}
      <View style={styles.audioActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="音频后退 15 秒" accessibilityState={{ disabled: !status.isLoaded }} disabled={!status.isLoaded} onPress={() => void seek(-15)} style={[styles.secondaryButton, !status.isLoaded && styles.disabled]}><Text style={styles.secondaryText}>后退 15 秒</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? '暂停音频' : '播放音频'} accessibilityState={{ disabled: !status.isLoaded, busy: status.isBuffering }} disabled={!status.isLoaded} onPress={() => status.playing ? player.pause() : player.play()} style={[styles.primaryButton, !status.isLoaded && styles.disabled]}><Text style={styles.primaryText}>{status.isBuffering ? '缓冲中…' : status.playing ? '暂停' : '播放'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="音频快进 15 秒" accessibilityState={{ disabled: !status.isLoaded }} disabled={!status.isLoaded} onPress={() => void seek(15)} style={[styles.secondaryButton, !status.isLoaded && styles.disabled]}><Text style={styles.secondaryText}>快进 15 秒</Text></Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  videoCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#111111', borderWidth: 1, borderColor: colors.border },
  video: { width: '100%', height: 224, backgroundColor: '#111111' },
  videoTitle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  mediaTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  audioCard: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  audioTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  audioIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.brandSoft },
  audioMain: { flex: 1, gap: 4 },
  audioTime: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#E3E3E3' },
  progressFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  audioActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.48 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
})
