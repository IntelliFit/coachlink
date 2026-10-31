import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LOCATION_EQUIPMENT_OPTIONS, locationEquipmentLabel, resolveLocationEquipment, type LocationEquipmentInput, type LocationEquipmentType } from '@coachlink/core'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'

/** 器材多选，对应小程序 components/LocationEquipment。filter 模式多一个「全部器材」。 */
export function EquipmentSelector({ value, onChange, filter = false }: { value: LocationEquipmentType[]; onChange: (value: LocationEquipmentType[]) => void; filter?: boolean }) {
  return (
    <View style={styles.selector}>
      <View style={styles.chips}>
        {filter ? <Chip label="全部器材" active={value.length === 0} onPress={() => onChange([])} /> : null}
        {LOCATION_EQUIPMENT_OPTIONS.map((option) => (
          <Chip
            key={option.code}
            label={option.label}
            active={value.includes(option.code)}
            onPress={() => onChange(value.includes(option.code) ? value.filter((type) => type !== option.code) : [...value, option.code])}
          />
        ))}
      </View>
      {filter && value.length > 1 ? <Text style={styles.hint}>同时包含所选器材</Text> : null}
    </View>
  )
}

export function EquipmentTags({ location }: { location: LocationEquipmentInput }) {
  const equipment = resolveLocationEquipment(location)
  return (
    <View style={styles.tags}>
      {equipment.equipment_types.length
        ? equipment.equipment_types.map((type) => <Text key={type} style={styles.tag}>{locationEquipmentLabel(type)}</Text>)
        : <Text style={styles.hint}>器材待补充</Text>}
      {equipment.equipment_source === 'description' ? <Text style={styles.hint}>据描述</Text> : null}
    </View>
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  selector: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  tag: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 11, fontWeight: '600' },
  hint: { color: colors.textTertiary, fontSize: 11 },
})
