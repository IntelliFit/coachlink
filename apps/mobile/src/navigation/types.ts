import type { NavigatorScreenParams } from '@react-navigation/native'

export type MainTabParamList = {
  TrainingTab: undefined
  CoachesTab: undefined
  KnowledgeTab: undefined
  ToolboxTab: undefined
  ProfileTab: undefined
  CoachOverviewTab: undefined
  CoachVideosTab: undefined
  CoachStudentsTab: undefined
  CoachPlanTemplatesTab: undefined
  CoachProfileTab: undefined
}

export type RootStackParamList = {
  Login: undefined
  Register: undefined
  ResetPassword: undefined
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined
  ProfileDetail: undefined
  ProfileEdit: undefined
  FitnessCard: undefined
  E1RMChart: undefined
  ActionLibrary: undefined
  ActionDetail: { id?: string; action?: any; source?: 'mine' | 'coach' | 'public' } | undefined
  CopyCoachActions: undefined
  ActionEdit: { id?: string; action?: any } | undefined
  PlanLibrary: undefined
  PlanEdit: { id?: string; autoGenerate?: boolean } | undefined
  PlanHistory: undefined
  PlanHistoryDetail: { id?: string } | undefined
  TrainingHistory: undefined
  Membership: undefined
  MembershipSubscribe: { tab?: 'membership' | 'addon' } | undefined
  MembershipReferral: undefined
  Cart: undefined
  PurchaseHistory: undefined
  Settings: undefined
  Friends: { tab?: 'friends' | 'requests' } | undefined
  FriendActivity: undefined
  Messages: undefined
  Chat: { roomId?: string; peerName?: string } | undefined
  MyCoaches: undefined
  CoachDashboard: undefined
  CoachStudents: undefined
  CoachStudentDetail: { subscriptionId?: string; studentId?: string } | undefined
  CoachAssignPlan: { subscriptionId: string; studentId?: string; studentName?: string }
  CoachActions: undefined
  CoachActionEdit: { id?: string } | undefined
  CoachPlanTemplates: undefined
  CoachPlanTemplateEdit: { id?: string } | undefined
  CoachContents: undefined
  CoachContentEdit: { id?: string } | undefined
  CoachPricing: undefined
  CoachPricingEdit: { id?: string; tier?: 'basic' | 'standard' | 'vip' } | undefined
  CoachVideos: undefined
  CoachVideoReview: { videoId: string } | undefined
  CoachQuestionnaires: undefined
  CoachQuestionnaireEdit: { id?: string } | undefined
  CoachAutomation: undefined
  CoachRevenue: undefined
  CoachWallet: undefined
  CoachWalletMerchant: undefined
  CoachInvitation: undefined
  CoachMarket: undefined
  GeneratePlan: { coachId?: string } | undefined
  GeneratePlanWaiting: { coachId?: string; domain?: string; taskId?: string } | undefined
  PaymentWaiting: {
    orderId?: string
    amount?: number
    paymentUrl?: string
    coachId?: string
    provider?: 'wechat' | 'alipay'
    target?: 'coach' | 'membership'
    initialStatus?: 'success' | 'cancelled' | 'failed'
    message?: string
    membershipTab?: string
  } | undefined
  Ranking: undefined
  RankingDetail: { id: string } | undefined
  CoachApplication: undefined
  Feedback: undefined
  LegalDocs: undefined
  UserHome: { userId?: string } | undefined
  About: undefined
  Contact: undefined
  Disclaimer: undefined
  Terms: undefined
  Privacy: undefined
  PlatformAgreement: undefined
  ProtectionOfConsumer: undefined
  TrainingExecution: { instanceId?: string; dayIndex?: number; readOnly?: boolean; impromptuId?: string } | undefined
  TrainingShare: { executionId?: string } | undefined
  ImpromptuTraining: undefined
  CoachProfile: { id?: string } | undefined
  CoachQuestionnaire: {
    coachId?: string
    coachName?: string
    mode?: 'edit' | 'prepay'
    subscriptionId?: string
    productId?: string
    productName?: string
    productTier?: string
    months?: number
    price?: number
    existingAnswers?: any[]
  } | undefined
  KnowledgeSearch: { id?: string; query?: string } | undefined
  CoachContentDetail: { id?: string } | undefined
  KnowledgePlanDetail: { id?: string; fallback?: Record<string, unknown> } | undefined
  KnowledgeBookDetail: { id?: string } | undefined
  PowerAnalysis: undefined
  MotionEffects: undefined
  OneArmPullUp: undefined
  StreetliftingCalculator: undefined
  StreetliftingData: undefined
  StreetliftingLocations: undefined
  StreetliftingMethodology: undefined
  StreetliftingStories: undefined
  StreetliftingSubmit: undefined
  StreetliftingSubmitSuccess: { submissionId?: string; exerciseType?: string; oneRm?: number; score?: number } | undefined
  StreetliftingLocationsMap: undefined
  StreetliftingLocationDetail: { id: string } | undefined
  ToolboxScenario: { slug?: string } | undefined
}
