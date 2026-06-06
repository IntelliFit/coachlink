export type CoachApplicationMaterialCategory = 'achievement' | 'case' | 'credential' | 'media'

export interface CoachApplicationMaterial {
  id: string
  category: CoachApplicationMaterialCategory
  title: string
  summary?: string | null
  detail?: string | null
  isPublic: boolean
  media: Array<{
    id: string
    type: 'image' | 'video'
    url: string
    thumbnailUrl?: string | null
    storageBucket?: string | null
    storagePath?: string | null
    fileName?: string | null
    fileSizeBytes?: number | null
    contentType?: string | null
  }>
  links: Array<{ id: string; label?: string | null; url: string }>
}

export const MATERIAL_CATEGORY_OPTIONS: Array<{ value: CoachApplicationMaterialCategory; label: string }> = [
  { value: 'achievement', label: '成就' },
  { value: 'case', label: '案例' },
  { value: 'credential', label: '证书' },
  { value: 'media', label: '媒体' }
]

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function cleanText(value: any, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function createEmptyCoachMaterial(category: CoachApplicationMaterialCategory = 'achievement'): CoachApplicationMaterial {
  return {
    id: makeId('material'),
    category,
    title: '',
    summary: '',
    detail: '',
    isPublic: true,
    media: [],
    links: []
  }
}

export function normalizeCoachApplicationMaterials(input: any, legacy?: {
  achievements?: string[] | null
  caseStudies?: string[] | null
  credentials?: Array<{ name?: string | null; url?: string | null }> | null
}): CoachApplicationMaterial[] {
  const source = Array.isArray(input) && input.length > 0 ? input : [
    ...(legacy?.achievements || []).map(title => ({ category: 'achievement', title })),
    ...(legacy?.caseStudies || []).map(title => ({ category: 'case', title })),
    ...(legacy?.credentials || []).filter(item => item?.name).map(item => ({
      category: 'credential',
      title: item.name,
      links: item.url ? [{ label: '证书链接', url: item.url }] : []
    }))
  ]

  return source.map((item: any) => {
    const category = ['achievement', 'case', 'credential', 'media'].includes(item?.category) ? item.category : 'media'
    const title = cleanText(item?.title || item?.name, 120)
    if (!title) return null
    return {
      id: cleanText(item?.id, 120) || makeId('material'),
      category,
      title,
      summary: cleanText(item?.summary, 240) || null,
      detail: cleanText(item?.detail || item?.description, 1600) || null,
      isPublic: item?.isPublic === false || item?.is_public === false ? false : true,
      media: Array.isArray(item?.media) ? item.media.filter((m: any) => m?.url).map((m: any) => ({
        id: cleanText(m?.id, 120) || makeId('media'),
        type: m?.type === 'video' ? 'video' : 'image',
        url: String(m.url),
        thumbnailUrl: m.thumbnailUrl || m.thumbnail_url || null,
        storageBucket: m.storageBucket || m.storage_bucket || null,
        storagePath: m.storagePath || m.storage_path || null,
        fileName: m.fileName || m.file_name || null,
        fileSizeBytes: Number.isFinite(Number(m.fileSizeBytes || m.file_size_bytes)) ? Number(m.fileSizeBytes || m.file_size_bytes) : null,
        contentType: m.contentType || m.content_type || null
      })).slice(0, 8) : [],
      links: Array.isArray(item?.links) ? item.links.filter((l: any) => l?.url).map((l: any) => ({
        id: cleanText(l?.id, 120) || makeId('link'),
        label: cleanText(l?.label || l?.name, 80) || '相关链接',
        url: String(l.url)
      })).slice(0, 8) : []
    } as CoachApplicationMaterial
  }).filter(Boolean) as CoachApplicationMaterial[]
}

export function deriveLegacyFieldsFromMaterials(materials: CoachApplicationMaterial[], fallback?: {
  achievements?: string[] | null
  caseStudies?: string[] | null
  credentials?: Array<{ name?: string | null; url?: string | null }> | null
}) {
  const achievements = materials
    .filter(item => item.category === 'achievement')
    .map(item => item.summary ? `${item.title}：${item.summary}` : item.title)
  const caseStudies = materials
    .filter(item => item.category === 'case')
    .map(item => item.summary ? `${item.title}：${item.summary}` : item.title)
  const credentials = materials
    .filter(item => item.category === 'credential')
    .map(item => ({ name: item.title, url: item.links[0]?.url || item.media[0]?.url || undefined }))

  return {
    achievements: achievements.length ? achievements : (fallback?.achievements || []),
    caseStudies: caseStudies.length ? caseStudies : (fallback?.caseStudies || []),
    credentials: credentials.length ? credentials : (fallback?.credentials || [])
  }
}

export function groupCoachApplicationMaterials(materials: any) {
  const normalized = normalizeCoachApplicationMaterials(materials)
  return {
    all: normalized,
    achievement: normalized.filter(item => item.category === 'achievement'),
    case: normalized.filter(item => item.category === 'case'),
    credential: normalized.filter(item => item.category === 'credential'),
    media: normalized.filter(item => item.category === 'media')
  }
}
