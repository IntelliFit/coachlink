/** 从手机选计划文件时的校验，规则与服务端 /api/plan-lib/extract-file-text 一致。 */

export const PLAN_IMPORT_EXTENSIONS = ['txt', 'csv', 'md', 'docx', 'xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'webp']
export const PLAN_IMPORT_MAX_BYTES = 10 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function extensionOf(name: string) {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1].trim() : ''
}

export function planImportFileError(name: string, size: number | null | undefined) {
  const extension = extensionOf(name)
  if (!PLAN_IMPORT_EXTENSIONS.includes(extension)) return `仅支持 .${PLAN_IMPORT_EXTENSIONS.join('、.')} 格式，当前为 .${extension || '未知'}`
  if (typeof size === 'number' && size > PLAN_IMPORT_MAX_BYTES) return '文件超过 10MB，请压缩或拆分后再上传'
  return ''
}

/** 选文件器给的类型经常不准（.md 常是空的），按扩展名定。 */
export function planImportMimeType(name: string, fallback?: string | null) {
  return MIME_BY_EXTENSION[extensionOf(name)] || fallback || 'application/octet-stream'
}
