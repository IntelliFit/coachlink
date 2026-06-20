import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { BookOpen, Dumbbell, Search, UserRound, Wrench } from 'lucide-react-native'
import { useAuth } from '../providers/AuthProvider'
import { colors, spacing } from '../theme'
import { LoginScreen } from '../screens/LoginScreen'
import { TrainingScreen } from '../screens/TrainingScreen'
import { CoachesScreen } from '../screens/CoachesScreen'
import { KnowledgeScreen } from '../screens/KnowledgeScreen'
import { ToolboxScreen } from '../screens/ToolboxScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import type { MainTabParamList, RootStackParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()
const Stack = createNativeStackNavigator<RootStackParamList>()

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.brand,
  },
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="TrainingTab"
        component={TrainingScreen}
        options={{
          title: '训练',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="CoachesTab"
        component={CoachesScreen}
        options={{
          title: '教练',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="KnowledgeTab"
        component={KnowledgeScreen}
        options={{
          title: '知识',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ToolboxTab"
        component={ToolboxScreen}
        options={{
          title: '工具箱',
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}

export function RootNavigator() {
  const { isBootstrapping, isAuthenticated } = useAuth()

  if (isBootstrapping) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.bootText}>CoachLink</Text>
      </View>
    )
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  bootText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  tabBar: {
    minHeight: 72,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
})
