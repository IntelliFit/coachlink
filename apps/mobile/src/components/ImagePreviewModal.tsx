import { useEffect, useRef, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../theme'

type ImagePreviewModalProps = {
  urls: string[]
  /** 打开时定位到的图片；为 null 时不显示。 */
  initialUrl: string | null
  onClose: () => void
}

/** 全屏图片预览：左右滑动切换，点击空白或「关闭」退出。对应小程序 Taro.previewImage。 */
export function ImagePreviewModal({ urls, initialUrl, onClose }: ImagePreviewModalProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const initialIndex = Math.max(0, initialUrl ? urls.indexOf(initialUrl) : 0)
  const [index, setIndex] = useState(initialIndex)
  const visible = Boolean(initialUrl) && urls.length > 0

  useEffect(() => {
    if (!visible) return
    setIndex(initialIndex)
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false }), 0)
    return () => clearTimeout(timer)
  }, [initialIndex, visible, width])

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width))
    setIndex(Math.min(Math.max(next, 0), urls.length - 1))
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mask}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {urls.map((url) => (
            <Pressable key={url} accessibilityRole="button" accessibilityLabel="关闭图片预览" onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: url }} resizeMode="contain" style={{ width, height: height * 0.8 }} accessibilityIgnoresInvertColors />
            </Pressable>
          ))}
        </ScrollView>
        <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          {urls.length > 1 ? <Text style={styles.counter}>{index + 1} / {urls.length}</Text> : <View />}
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  topBar: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  close: {
    minHeight: 48,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
})
