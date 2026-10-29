import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../../theme'
import type { PlanActionOption, PlanItemType } from './model/planTypes'
import { normalizeItemType } from './model/planEditor'

type Props = {
  visible: boolean
  /** 只列出同类型的动作（力量 / 有氧 / 饮食 / 习惯），与小程序按类型选动作一致。 */
  itemType: PlanItemType
  actions: PlanActionOption[]
  onClose: () => void
  onSelect: (action: PlanActionOption) => void
}

/** 从动作库挑选动作（对应小程序计划编辑器的动作选择）。 */
export function PlanActionPicker({ visible, itemType, actions, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const options = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return actions
      .filter((action) => normalizeItemType(action.type) === itemType)
      .filter((action) => !keyword || String(action.name || '').toLowerCase().includes(keyword))
  }, [actions, itemType, query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>选择动作</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="搜索动作"
          value={query}
          onChangeText={setQuery}
          placeholder="搜索动作名称"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{actions.length === 0 ? '动作库为空，请先在动作库添加动作。' : '没有这一类型的匹配动作'}</Text>}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              {Array.isArray(item.attrs) && item.attrs.length > 0 ? <Text style={styles.rowMeta} numberOfLines={1}>{item.attrs.join(' · ')}</Text> : null}
            </Pressable>
          )}
        />
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
  close: {
    minHeight: 48,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '600',
  },
  search: {
    minHeight: 48,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.surface,
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
  row: {
    minHeight: 56,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
})
