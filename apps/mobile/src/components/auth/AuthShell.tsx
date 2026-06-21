import type { ReactNode } from 'react'
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../../theme'

const loginBg = require('../../../assets/login-bg.jpg')

type AuthShellProps = {
  title: string
  slogan: string
  cardTitle: string
  children: ReactNode
  compactHero?: boolean
}

export function AuthShell({ title, slogan, cardTitle, children, compactHero = false }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView style={styles.safe} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ImageBackground source={loginBg} resizeMode="cover" style={[styles.hero, compactHero && styles.heroCompact]}>
            <View style={styles.heroOverlay}>
              <Text style={styles.heroBrand}>{title}</Text>
              <Text style={styles.heroSlogan}>{slogan}</Text>
            </View>
          </ImageBackground>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{cardTitle}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
  },
  hero: {
    minHeight: 272,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroCompact: {
    minHeight: 224,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: 72,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  heroBrand: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  heroSlogan: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    flex: 1,
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#F5F5F5',
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
})
