import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../api'
import { IconFont } from '../IconFont'
import { colors, radius, spacing } from '../../theme'

type SliderCaptchaModalProps = {
  visible: boolean
  onCancel: () => void
  onSuccess: (token: string) => void
}

const TRACK_WIDTH = 280
const THUMB_SIZE = 48
const MAX_POSITION = TRACK_WIDTH - THUMB_SIZE

export function SliderCaptchaModal({ visible, onCancel, onSuccess }: SliderCaptchaModalProps) {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [targetPercent, setTargetPercent] = useState(50)
  const [position, setPosition] = useState(0)
  const challengeIdRef = useRef<string | null>(null)
  const verifyingRef = useRef(false)
  const positionRef = useRef(0)
  const dragStartRef = useRef(0)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  async function loadChallenge() {
    challengeIdRef.current = null
    setLoading(true)
    setPosition(0)
    positionRef.current = 0
    try {
      const challenge = await apiClient.createSliderCaptcha()
      challengeIdRef.current = challenge.id
      setTargetPercent(challenge.targetPercent)
    } catch (error) {
      challengeIdRef.current = null
      Alert.alert('安全验证', error instanceof Error ? error.message : '加载验证失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      void loadChallenge()
    } else {
      challengeIdRef.current = null
      verifyingRef.current = false
      setVerifying(false)
    }
  }, [visible])

  async function verifyAtPosition(finalPosition: number) {
    const challengeId = challengeIdRef.current
    if (!challengeId || verifyingRef.current) return
    verifyingRef.current = true
    setVerifying(true)
    try {
      const percent = Math.round(((finalPosition + THUMB_SIZE / 2) / TRACK_WIDTH) * 100)
      const result = await apiClient.verifySliderCaptcha({ id: challengeId, percent })
      onSuccessRef.current(result.token)
    } catch (error) {
      Alert.alert('验证失败', error instanceof Error ? error.message : '请重试')
      await loadChallenge()
    } finally {
      verifyingRef.current = false
      setVerifying(false)
    }
  }

  function updatePosition(nextPosition: number) {
    const next = Math.max(0, Math.min(MAX_POSITION, nextPosition))
    positionRef.current = next
    setPosition(next)
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(challengeIdRef.current) && !verifyingRef.current,
    onMoveShouldSetPanResponder: () => Boolean(challengeIdRef.current) && !verifyingRef.current,
    onPanResponderGrant: () => {
      dragStartRef.current = positionRef.current
    },
    onPanResponderMove: (_, gestureState) => {
      updatePosition(dragStartRef.current + gestureState.dx)
    },
    onPanResponderRelease: (_, gestureState) => {
      const finalPosition = Math.max(0, Math.min(MAX_POSITION, dragStartRef.current + gestureState.dx))
      updatePosition(finalPosition)
      void verifyAtPosition(finalPosition)
    },
    onPanResponderTerminate: () => {
      setPosition(positionRef.current)
    },
  })).current

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>安全验证</Text>
          <Text style={styles.tip}>请将滑块拖动到缺口位置</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.track}>
              <View style={[styles.gap, { left: `${targetPercent}%` }]} />
              <View
                {...panResponder.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="安全验证滑块"
                accessibilityHint="左右拖动到缺口位置，然后松开验证"
                accessibilityState={{ disabled: !challengeIdRef.current || verifying, busy: verifying }}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(((position + THUMB_SIZE / 2) / TRACK_WIDTH) * 100), text: `${Math.round(((position + THUMB_SIZE / 2) / TRACK_WIDTH) * 100)}%` }}
                accessibilityActions={[{ name: 'increment', label: '向右移动' }, { name: 'decrement', label: '向左移动' }, { name: 'activate', label: '验证当前位置' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'increment') updatePosition(positionRef.current + 16)
                  if (event.nativeEvent.actionName === 'decrement') updatePosition(positionRef.current - 16)
                  if (event.nativeEvent.actionName === 'activate') void verifyAtPosition(positionRef.current)
                }}
                style={[styles.thumb, { transform: [{ translateX: position }] }]}
              >
                {verifying ? <ActivityIndicator color={colors.surface} /> : <IconFont name="icon-right" color={colors.surface} size={22} />}
              </View>
            </View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="暂不验证" onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>暂不验证</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  title: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },
  tip: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: '#64748B',
    fontSize: 14,
  },
  loadingBox: {
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  track: {
    width: TRACK_WIDTH,
    height: 48,
    alignSelf: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#EEF2F6',
    overflow: 'hidden',
  },
  gap: {
    position: 'absolute',
    top: 4,
    width: 40,
    height: 40,
    marginLeft: -20,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: 'rgba(207,109,78,0.24)',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: THUMB_SIZE,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.sm,
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '800',
  },
})
