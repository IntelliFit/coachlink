import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, shadow, spacing } from '../theme'

type SectionCardProps = {
  title: string
  description?: string
  children?: ReactNode
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
    ...shadow,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  body: {
    marginTop: spacing.xs,
  },
})
