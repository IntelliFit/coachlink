import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import { Card } from '../me/MeShared'
import { collectOneRMActions } from './model/planEditor'
import { resolveReferenceOneRM } from './model/planStrength'
import type { PlanActionOption, PlanTrainingDay } from './model/planTypes'

/**
 * 负重参考：列出计划里支持按 1RM 自动算重的动作，可临时填写 1RM 看算重结果。
 * 与小程序 PlanReferenceOneRMPanel 一致，这里的数字只用于本次编辑时的预览，不写入计划。
 */
export function PlanOneRMPanel({ days, actions, oneRMConfig, oneRMIndex, onChange }: {
  days: PlanTrainingDay[]
  actions: PlanActionOption[]
  oneRMConfig: Record<string, number>
  oneRMIndex: Record<string, number>
  onChange: (next: Record<string, number>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const items = useMemo(() => collectOneRMActions(days, actions).map((action) => ({
    id: String(action.id),
    name: action.name,
    value: oneRMConfig[String(action.id)] || resolveReferenceOneRM(action, {}, oneRMIndex) || null,
  })), [actions, days, oneRMConfig, oneRMIndex])

  function update(id: string, text: string) {
    const normalized = text.replace(',', '.')
    setDrafts((current) => ({ ...current, [id]: normalized }))
    const parsed = normalized === '' ? null : Number(normalized)
    const next = { ...oneRMConfig }
    if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) delete next[id]
    else next[id] = parsed
    onChange(next)
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>负重参考</Text>
          <Text style={styles.caption}>{items.length > 0 ? `${items.length} 个动作支持按 1RM 自动算重` : '当前计划里还没有需要配置 1RM 的力量动作。'}</Text>
        </View>
        {items.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '收起负重参考' : '展开负重参考'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.toggle}>
            <Text style={styles.toggleText}>{expanded ? '收起' : '展开'}</Text>
          </Pressable>
        ) : null}
      </View>
      {items.length > 0 && !expanded ? (
        <View style={styles.pills}>
          {items.slice(0, 3).map((item) => <Text key={item.id} style={styles.pill} numberOfLines={1}>{item.name} {item.value ? `${item.value}kg` : '待填'}</Text>)}
          {items.length > 3 ? <Text style={styles.pill}>更多 +{items.length - 3}</Text> : null}
        </View>
      ) : null}
      {expanded ? items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={[styles.name, styles.flex]} numberOfLines={2}>{item.name}</Text>
          <TextInput
            accessibilityLabel={`${item.name} 的 1RM（kg）`}
            value={drafts[item.id] ?? (item.value ? String(item.value) : '')}
            onChangeText={(text) => update(item.id, text)}
            keyboardType="decimal-pad"
            placeholder="1RM"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.unit}>kg</Text>
        </View>
      )) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  toggle: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: { overflow: 'hidden', maxWidth: 200, paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { color: colors.text, fontSize: 14 },
  input: { width: 96, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  unit: { color: colors.textTertiary, fontSize: 13 },
})
