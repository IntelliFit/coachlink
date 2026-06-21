import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../providers/AuthProvider'
import { IconFont } from '../components/IconFont'
import { colors, spacing } from '../theme'
import { FloatingTabBar } from './FloatingTabBar'
import { LoginScreen } from '../screens/LoginScreen'
import { RegisterScreen } from '../screens/RegisterScreen'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { TrainingScreen } from '../screens/TrainingScreen'
import { CoachesScreen } from '../screens/CoachesScreen'
import { KnowledgeScreen } from '../screens/KnowledgeScreen'
import { ToolboxScreen } from '../screens/ToolboxScreen'
import {
  AboutScreen,
  ActionDetailScreen,
  ActionEditScreen,
  ActionLibraryScreen,
  CartScreen,
  ChatScreen,
  CoachApplicationScreen,
  ContactScreen,
  CopyCoachActionsScreen,
  DisclaimerScreen,
  E1RMChartScreen,
  FeedbackScreen,
  FitnessCardScreen,
  FriendActivityScreen,
  FriendsScreen,
  LegalDocsScreen,
  MembershipReferralScreen,
  MembershipScreen,
  MembershipSubscribeScreen,
  MessagesScreen,
  MyCoachesScreen,
  PaymentWebviewScreen,
  PaymentWechatScreen,
  PlanEditScreen,
  PlanHistoryDetailScreen,
  PlanHistoryScreen,
  PlanLibraryScreen,
  PlatformAgreementScreen,
  PrivacyScreen,
  ProfileDetailScreen,
  ProfileEditScreen,
  ProfileScreen,
  ProtectionOfConsumerScreen,
  PurchaseHistoryScreen,
  RankingDetailScreen,
  RankingScreen,
  SettingsScreen,
  TermsScreen,
  TrainingHistoryScreen,
  UserHomeScreen,
} from '../screens/me/MeScreens'
import { CoachProfileScreen } from '../screens/coach/CoachProfileScreen'
import { CoachContentDetailScreen } from '../screens/coach/CoachContentDetailScreen'
import { CoachActionEditScreen, CoachActionsScreen } from '../screens/coach/CoachActionsScreen'
import { CoachAutomationScreen } from '../screens/coach/CoachAutomationScreen'
import { CoachContentEditScreen, CoachContentsScreen } from '../screens/coach/CoachContentsScreen'
import { CoachDashboardScreen } from '../screens/coach/CoachDashboardScreen'
import { CoachPlanTemplateEditScreen, CoachPlanTemplatesScreen } from '../screens/coach/CoachPlanTemplatesScreen'
import { CoachPricingEditScreen, CoachPricingScreen } from '../screens/coach/CoachPricingScreen'
import { CoachQuestionnaireEditScreen, CoachQuestionnairesScreen } from '../screens/coach/CoachQuestionnairesManageScreen'
import { CoachRevenueScreen } from '../screens/coach/CoachRevenueScreen'
import { CoachStudentDetailScreen, CoachStudentsScreen } from '../screens/coach/CoachStudentsScreen'
import { CoachWalletMerchantScreen } from '../screens/coach/CoachWalletMerchantScreen'
import { CoachWalletScreen } from '../screens/coach/CoachWalletScreen'
import { CoachQuestionnaireScreen } from '../screens/coach/CoachQuestionnaireScreen'
import { CoachMarketScreen } from '../screens/coach/CoachMarketScreen'
import { GeneratePlanScreen } from '../screens/coach/GeneratePlanScreen'
import { GeneratePlanWaitingScreen } from '../screens/coach/GeneratePlanWaitingScreen'
import { CoachVideoReviewScreen, CoachVideosScreen } from '../screens/coach/CoachVideosScreen'
import { PaymentWaitingScreen } from '../screens/payment/PaymentWaitingScreen'
import { StreetliftingCalculatorScreen } from '../screens/streetlifting/StreetliftingCalculatorScreen'
import { StreetliftingDataScreen } from '../screens/streetlifting/StreetliftingDataScreen'
import {
  StreetliftingLocationDetailScreen,
  StreetliftingLocationsMapScreen,
  StreetliftingMethodologyScreen,
  StreetliftingStoriesScreen,
  StreetliftingSubmitScreen,
  StreetliftingSubmitSuccessScreen,
} from '../screens/streetlifting/StreetliftingExtraScreens'
import { StreetliftingLocationsScreen } from '../screens/streetlifting/StreetliftingLocationsScreen'
import { ImpromptuTrainingScreen } from '../screens/training/ImpromptuTrainingScreen'
import { TrainingExecutionScreen } from '../screens/training/TrainingExecutionScreen'
import { TrainingShareScreen } from '../screens/training/TrainingShareScreen'
import { KnowledgeBookDetailScreen } from '../screens/knowledge/KnowledgeBookDetailScreen'
import { KnowledgePlanDetailScreen } from '../screens/knowledge/KnowledgePlanDetailScreen'
import { KnowledgeSearchScreen } from '../screens/knowledge/KnowledgeSearchScreen'
import { PowerAnalysisScreen } from '../screens/toolbox/PowerAnalysisScreen'
import { ToolboxScenarioScreen } from '../screens/toolbox/ToolboxScenarioScreen'
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

function MainTabs({ isCoachMode }: { isCoachMode: boolean }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {isCoachMode ? (
        <>
          <Tab.Screen
            name="CoachOverviewTab"
            component={CoachDashboardScreen}
            options={{
              title: '总览',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-dashboard" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="CoachVideosTab"
            component={CoachVideosScreen}
            options={{
              title: '视频',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-video" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="CoachStudentsTab"
            component={CoachStudentsScreen}
            options={{
              title: '学员',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-friends-o" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="CoachPlanTemplatesTab"
            component={CoachPlanTemplatesScreen}
            options={{
              title: '计划',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-a-Trainingplan" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="CoachProfileTab"
            component={CoachProfileScreen}
            options={{
              title: '我的',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-account-settings-variant" color={color} size={size} />,
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="TrainingTab"
            component={TrainingScreen}
            options={{
              title: '训练',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-dumbbell" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="CoachesTab"
            component={CoachesScreen}
            options={{
              title: '教练',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-discovery" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="KnowledgeTab"
            component={KnowledgeScreen}
            options={{
              title: '知识',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-knowledge" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="ToolboxTab"
            component={ToolboxScreen}
            options={{
              title: '工具箱',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-toolbox" color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileScreen}
            options={{
              title: '我的',
              tabBarIcon: ({ color, size }) => <IconFont name="icon-user" color={color} size={size} />,
            }}
          />
        </>
      )}
    </Tab.Navigator>
  )
}

export function RootNavigator() {
  const { isBootstrapping, isAuthenticated, isGuest, user } = useAuth()
  const isCoachMode = isAuthenticated && (user?.is_coach === true || user?.primary_role === 'coach')

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
        {isAuthenticated || isGuest ? (
          <>
            <Stack.Screen name="MainTabs" children={() => <MainTabs isCoachMode={isCoachMode} />} />
            <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            <Stack.Screen name="FitnessCard" component={FitnessCardScreen} />
            <Stack.Screen name="E1RMChart" component={E1RMChartScreen} />
            <Stack.Screen name="ActionLibrary" component={ActionLibraryScreen} />
            <Stack.Screen name="ActionDetail" component={ActionDetailScreen} />
            <Stack.Screen name="CopyCoachActions" component={CopyCoachActionsScreen} />
            <Stack.Screen name="ActionEdit" component={ActionEditScreen} />
            <Stack.Screen name="PlanLibrary" component={PlanLibraryScreen} />
            <Stack.Screen name="PlanEdit" component={PlanEditScreen} />
            <Stack.Screen name="PlanHistory" component={PlanHistoryScreen} />
            <Stack.Screen name="PlanHistoryDetail" component={PlanHistoryDetailScreen} />
            <Stack.Screen name="TrainingHistory" component={TrainingHistoryScreen} />
            <Stack.Screen name="Membership" component={MembershipScreen} />
            <Stack.Screen name="MembershipSubscribe" component={MembershipSubscribeScreen} />
            <Stack.Screen name="MembershipReferral" component={MembershipReferralScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="PurchaseHistory" component={PurchaseHistoryScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="FriendActivity" component={FriendActivityScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="MyCoaches" component={MyCoachesScreen} />
            <Stack.Screen name="CoachDashboard" component={CoachDashboardScreen} />
            <Stack.Screen name="CoachStudents" component={CoachStudentsScreen} />
            <Stack.Screen name="CoachStudentDetail" component={CoachStudentDetailScreen} />
            <Stack.Screen name="CoachActions" component={CoachActionsScreen} />
            <Stack.Screen name="CoachActionEdit" component={CoachActionEditScreen} />
            <Stack.Screen name="CoachPlanTemplates" component={CoachPlanTemplatesScreen} />
            <Stack.Screen name="CoachPlanTemplateEdit" component={CoachPlanTemplateEditScreen} />
            <Stack.Screen name="CoachContents" component={CoachContentsScreen} />
            <Stack.Screen name="CoachContentEdit" component={CoachContentEditScreen} />
            <Stack.Screen name="CoachPricing" component={CoachPricingScreen} />
            <Stack.Screen name="CoachPricingEdit" component={CoachPricingEditScreen} />
            <Stack.Screen name="CoachQuestionnaires" component={CoachQuestionnairesScreen} />
            <Stack.Screen name="CoachQuestionnaireEdit" component={CoachQuestionnaireEditScreen} />
            <Stack.Screen name="CoachVideos" component={CoachVideosScreen} />
            <Stack.Screen name="CoachVideoReview" component={CoachVideoReviewScreen} />
            <Stack.Screen name="CoachAutomation" component={CoachAutomationScreen} />
            <Stack.Screen name="CoachRevenue" component={CoachRevenueScreen} />
            <Stack.Screen name="CoachWallet" component={CoachWalletScreen} />
            <Stack.Screen name="CoachWalletMerchant" component={CoachWalletMerchantScreen} />
            <Stack.Screen name="CoachMarket" component={CoachMarketScreen} />
            <Stack.Screen name="GeneratePlan" component={GeneratePlanScreen} />
            <Stack.Screen name="GeneratePlanWaiting" component={GeneratePlanWaitingScreen} />
            <Stack.Screen name="PaymentWaiting" component={PaymentWaitingScreen} />
            <Stack.Screen name="PaymentWebview" component={PaymentWebviewScreen} />
            <Stack.Screen name="PaymentWechat" component={PaymentWechatScreen} />
            <Stack.Screen name="Ranking" component={RankingScreen} />
            <Stack.Screen name="RankingDetail" component={RankingDetailScreen} />
            <Stack.Screen name="CoachApplication" component={CoachApplicationScreen} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
            <Stack.Screen name="LegalDocs" component={LegalDocsScreen} />
            <Stack.Screen name="UserHome" component={UserHomeScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} />
            <Stack.Screen name="PlatformAgreement" component={PlatformAgreementScreen} />
            <Stack.Screen name="ProtectionOfConsumer" component={ProtectionOfConsumerScreen} />
            <Stack.Screen name="TrainingExecution" component={TrainingExecutionScreen} />
            <Stack.Screen name="TrainingShare" component={TrainingShareScreen} />
            <Stack.Screen name="ImpromptuTraining" component={ImpromptuTrainingScreen} />
            <Stack.Screen name="CoachProfile" component={CoachProfileScreen} />
            <Stack.Screen name="CoachContentDetail" component={CoachContentDetailScreen} />
            <Stack.Screen name="CoachQuestionnaire" component={CoachQuestionnaireScreen} />
            <Stack.Screen name="KnowledgeSearch" component={KnowledgeSearchScreen} />
            <Stack.Screen name="KnowledgePlanDetail" component={KnowledgePlanDetailScreen} />
            <Stack.Screen name="KnowledgeBookDetail" component={KnowledgeBookDetailScreen} />
            <Stack.Screen name="PowerAnalysis" component={PowerAnalysisScreen} />
            <Stack.Screen name="StreetliftingCalculator" component={StreetliftingCalculatorScreen} />
            <Stack.Screen name="StreetliftingData" component={StreetliftingDataScreen} />
            <Stack.Screen name="StreetliftingLocations" component={StreetliftingLocationsScreen} />
            <Stack.Screen name="StreetliftingMethodology" component={StreetliftingMethodologyScreen} />
            <Stack.Screen name="StreetliftingStories" component={StreetliftingStoriesScreen} />
            <Stack.Screen name="StreetliftingSubmit" component={StreetliftingSubmitScreen} />
            <Stack.Screen name="StreetliftingSubmitSuccess" component={StreetliftingSubmitSuccessScreen} />
            <Stack.Screen name="StreetliftingLocationsMap" component={StreetliftingLocationsMapScreen} />
            <Stack.Screen name="StreetliftingLocationDetail" component={StreetliftingLocationDetailScreen} />
            <Stack.Screen name="ToolboxScenario" component={ToolboxScenarioScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
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
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
})
