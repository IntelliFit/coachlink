/**
 * 教练公开主页编辑表单，与小程序 coach/profile/[id] 编辑模式一致（同一个 update-coach-profile 载荷）。
 */

export const SOCIAL_PLATFORMS = [
  { key: 'douyin', label: '抖音' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'zhihu', label: '知乎' },
  { key: 'bilibili', label: 'B站' },
  { key: 'kuaishou', label: '快手' },
  { key: 'other', label: '其他网站' },
] as const

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key']

export type CoachProfileForm = {
  name: string
  title: string
  bio: string
  yearsExperience: string
  specialties: string[]
  teachingPhilosophy: string
  achievements: string[]
  caseStudies: string[]
  credentials: Array<{ name: string; url?: string }>
  contactEmail: string
  contactPhone: string
  socialLinks: Array<{ platform: SocialPlatformKey; url: string }>
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
}

export function coachProfileFormFromCoach(coach: any): CoachProfileForm {
  const profile = coach?.profile && typeof coach.profile === 'object' ? coach.profile : {}
  const links = profile.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks : {}
  return {
    name: String(coach?.name || ''),
    title: String(coach?.title || ''),
    bio: String(coach?.bio || ''),
    yearsExperience: Number(coach?.years_experience) > 0 ? String(coach.years_experience) : '',
    specialties: stringList(coach?.specialties),
    teachingPhilosophy: String(profile.teachingPhilosophy || ''),
    achievements: stringList(profile.achievements),
    caseStudies: stringList(profile.caseStudies),
    credentials: Array.isArray(profile.credentials)
      ? profile.credentials
        .filter((item: any) => item && String(item.name || '').trim())
        .map((item: any) => ({ name: String(item.name).trim(), ...(item.url ? { url: String(item.url) } : {}) }))
      : [],
    contactEmail: String(profile.contactEmail || ''),
    contactPhone: String(profile.contactPhone || ''),
    socialLinks: SOCIAL_PLATFORMS
      .filter((platform) => String(links[platform.key] || '').trim())
      .map((platform) => ({ platform: platform.key, url: String(links[platform.key]).trim() })),
  }
}

/** 保存前校验，返回错误文案；通过返回 null。 */
export function validateCoachProfileForm(form: CoachProfileForm): string | null {
  if (!form.name.trim()) return '请填写教练名称'
  if (form.yearsExperience.trim()) {
    const years = Number(form.yearsExperience)
    if (!Number.isInteger(years) || years < 0 || years > 60) return '从业年限请填写 0–60 的整数'
  }
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return '邮箱格式不正确'
  return null
}

/** 与小程序 handleSave 相同的载荷：空列表/空字符串存 null。 */
export function buildCoachProfilePayload(coachId: string, form: CoachProfileForm) {
  const socialLinks: Record<string, string> = {}
  form.socialLinks.forEach((link) => {
    const url = link.url.trim()
    if (url) socialLinks[link.platform] = url
  })
  const listOrNull = (list: string[]) => {
    const cleaned = list.map((item) => item.trim()).filter(Boolean)
    return cleaned.length > 0 ? cleaned : null
  }
  const years = Number(form.yearsExperience)
  return {
    id: coachId,
    name: form.name.trim(),
    title: form.title.trim() || null,
    specialties: listOrNull(form.specialties),
    yearsExperience: Number.isFinite(years) && years > 0 ? years : null,
    bio: form.bio.trim() || null,
    profile: {
      teachingPhilosophy: form.teachingPhilosophy.trim() || null,
      achievements: listOrNull(form.achievements),
      caseStudies: listOrNull(form.caseStudies),
      credentials: form.credentials.length > 0 ? form.credentials : null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    },
  }
}

export function addListItem(list: string[], value: string): string[] {
  const item = value.trim()
  return item ? [...list, item] : list
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}
