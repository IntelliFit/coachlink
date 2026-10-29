/**
 * 公告详情页「按钮跳转」：后台只填小程序路径（weapp_path）和网页路径（web_path），
 * APP 没有独立路径字段，这里把小程序页面映射到 APP 的原生路由。
 * 映射不到时由调用方退回网页路径，两者都没有就不显示按钮。
 */

export type AppTabTarget = {
  kind: 'tab'
  /** 学员端和教练端的底部 Tab 不同，跳转前要和当前身份比对。 */
  mode: 'student' | 'coach'
  tab: string
}

export type AppStackTarget = {
  kind: 'stack'
  name: string
  params?: Record<string, string>
}

export type AppLinkTarget = AppTabTarget | AppStackTarget

type RouteRule = {
  target: AppLinkTarget
  /** 小程序 query 参数名 → APP 路由参数名，例如 coach-profile 的 id。 */
  params?: Record<string, string>
}

const tab = (mode: AppTabTarget['mode'], name: string): RouteRule => ({ target: { kind: 'tab', mode, tab: name } })
const stack = (name: string, params?: Record<string, string>): RouteRule => ({ target: { kind: 'stack', name }, params })

const ROUTES: Record<string, RouteRule> = {
  'pages/index': tab('student', 'TrainingTab'),
  'training/today-training': tab('student', 'TrainingTab'),
  'training/plan/current': tab('student', 'TrainingTab'),
  'training/impromptu-training': stack('ImpromptuTraining'),
  'training/actions': stack('ActionLibrary'),
  'training/copy-from-coach': stack('CopyCoachActions'),
  'discovery': tab('student', 'CoachesTab'),
  'discovery/coach-profile': stack('CoachProfile', { id: 'id', coachId: 'id' }),
  'discovery/market': stack('CoachMarket'),
  'discovery/ranking': stack('Ranking'),
  'discovery/ranking/detail': stack('RankingDetail', { id: 'id' }),
  'discovery/generate-plan': stack('GeneratePlan', { coachId: 'coachId' }),
  'content/knowledge': tab('student', 'KnowledgeTab'),
  'content/knowledge/book-detail': stack('KnowledgeBookDetail', { id: 'id' }),
  'content/knowledge/plan-detail': stack('KnowledgePlanDetail', { id: 'id' }),
  'content/content-detail': stack('CoachContentDetail', { id: 'id' }),
  'toolbox': tab('student', 'ToolboxTab'),
  'toolbox/power-analysis': stack('PowerAnalysis'),
  'toolbox/motion-effects': stack('MotionEffects'),
  'toolbox/one-arm-pull-up': stack('OneArmPullUp'),
  'toolbox/scenario': stack('ToolboxScenario', { slug: 'slug' }),
  'streetlifting/index/calculator': stack('StreetliftingCalculator'),
  'streetlifting/index/data': stack('StreetliftingData'),
  'streetlifting/index/locations': stack('StreetliftingLocations'),
  'streetlifting/index/locations-map': stack('StreetliftingLocationsMap'),
  'streetlifting/index/methodology': stack('StreetliftingMethodology'),
  'streetlifting/index/stories': stack('StreetliftingStories'),
  'streetlifting/index/submit': stack('StreetliftingSubmit'),
  'me/profile': tab('student', 'ProfileTab'),
  'me/profile/detail': stack('ProfileDetail'),
  'me/profile/edit': stack('ProfileEdit'),
  'me/profile/fitness-card': stack('FitnessCard'),
  'me/profile/e1rm-chart': stack('E1RMChart'),
  'me/action-lib': stack('ActionLibrary'),
  'me/plan-lib': stack('PlanLibrary'),
  'me/plan-history': stack('PlanHistory'),
  'me/training-history': stack('TrainingHistory'),
  'me/membership': stack('Membership'),
  'me/membership/subscribe': stack('MembershipSubscribe', { tab: 'tab' }),
  'me/membership/referral': stack('MembershipReferral'),
  'me/cart': stack('Cart'),
  'me/purchase-history': stack('PurchaseHistory'),
  'me/settings': stack('Settings'),
  'me/friends': stack('Friends', { tab: 'tab' }),
  'me/messages': stack('Messages'),
  'me/announcements': stack('Announcements'),
  'me/announcements/detail': stack('AnnouncementDetail', { id: 'id' }),
  'me/my-coaches': stack('MyCoaches'),
  'me/user': stack('UserHome', { userId: 'userId' }),
  'me-legal/about': stack('About'),
  'me-legal/contact': stack('Contact'),
  'me-legal/disclaimer': stack('Disclaimer'),
  'me-legal/docs': stack('LegalDocs'),
  'me-legal/feedback': stack('Feedback'),
  'me-legal/privacy': stack('Privacy'),
  'me-legal/terms': stack('Terms'),
  'me-legal/platform-agreement': stack('PlatformAgreement'),
  'me-legal/protection-of-consumer': stack('ProtectionOfConsumer'),
  'coach/index': tab('coach', 'CoachOverviewTab'),
  'coach/overview': tab('coach', 'CoachOverviewTab'),
  'coach/videos': tab('coach', 'CoachVideosTab'),
  'coach/students': tab('coach', 'CoachStudentsTab'),
  'coach/plan-lib': tab('coach', 'CoachPlanTemplatesTab'),
  'coach/my-profile': tab('coach', 'CoachProfileTab'),
  'coach/action-lib': stack('CoachActions'),
  'coach/content': stack('CoachContents'),
  'coach/questionnaire': stack('CoachQuestionnaires'),
  'coach/pricing': stack('CoachPricing'),
  'coach/wallet': stack('CoachWallet'),
  'coach/wallet/merchant': stack('CoachWalletMerchant'),
  'coach/revenue': stack('CoachRevenue'),
  'coach/automation': stack('CoachAutomation'),
  'coach/application': stack('CoachApplication'),
  'coach/settings/invitation': stack('CoachInvitation'),
}

function splitPath(raw: string): { path: string; query: URLSearchParams } {
  const trimmed = raw.trim()
  const queryIndex = trimmed.indexOf('?')
  const pathPart = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed
  const queryPart = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : ''
  const path = pathPart
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/index$/, '')
  return { path, query: new URLSearchParams(queryPart) }
}

/** 把小程序路径（如 `/discovery/coach-profile?id=xx`）转换成 APP 路由；不认识的路径返回 null。 */
export function resolveWeappPathToAppTarget(weappPath?: string | null): AppLinkTarget | null {
  const raw = String(weappPath || '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  const { path, query } = splitPath(raw)
  const rule = ROUTES[path]
  if (!rule) return null
  if (rule.target.kind === 'tab' || !rule.params) return rule.target

  const params: Record<string, string> = {}
  for (const [queryKey, paramKey] of Object.entries(rule.params)) {
    const value = query.get(queryKey)?.trim()
    if (value && !params[paramKey]) params[paramKey] = value
  }
  return Object.keys(params).length > 0 ? { ...rule.target, params } : rule.target
}

/** 后台填的网页路径只允许站内相对路径或 https 外链，拼成可在系统浏览器打开的地址。 */
export function resolveWebPathToUrl(webPath: string | null | undefined, baseUrl: string): string | null {
  const raw = String(webPath || '').trim()
  if (!raw) return null
  if (/^https:\/\//i.test(raw)) return raw
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  const base = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) return null
  return `${base}${raw}`
}
