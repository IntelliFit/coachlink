/**
 * 开发环境测试账号，仅用于本地/开发环境快速登录
 * 生产构建时不会暴露（通过 NODE_ENV 判断）
 */
export interface DevUser {
  name: string;
  phone?: string;
  password?: string;
  userId?: string;
}

function parseDevUsersFromEnv(): DevUser[] {
  const raw = process.env.NEXT_PUBLIC_DEV_USERS || process.env.NEXT_PUBLIC_DEV_ACCOUNTS || ''
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const users: Array<DevUser | null> = parsed
      .map((value) => {
        if (!value || typeof value !== 'object') {
          return null
        }
        const name = String(value.name || '').trim()
        const phone = String(value.phone || '').trim()
        const password = String(value.password || '').trim()
        const userId = String(value.userId || value.user_id || '').trim()
        if (!name) return null
        if (userId) return { name, userId }
        if (!phone || !password) return null
        return { name, phone, password }
      })
    return users.filter((value): value is DevUser => Boolean(value))
  } catch {
    return []
  }
}

function dedupeDevUsers(users: DevUser[]): DevUser[] {
  const seen = new Set<string>()
  return users.filter((user) => {
    const key = user.userId ? `user:${user.userId}` : user.phone ? `phone:${user.phone}` : user.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const FALLBACK_DEV_USERS: DevUser[] = [
  { name: '学员(沈妈妈)', phone: '13921064643', password: '123456' },
  { name: '教练(MAX)', phone: '13915850622', password: '123456' },
  { name: '管理员(教链小助手)', userId: '53677f66-45ca-4800-b45d-2d1d734e4163' },
  { name: '教练(枭马葛助理)', phone: '18115072586', password: '123456' },
]

export const DEV_USERS: DevUser[] = dedupeDevUsers([
  ...parseDevUsersFromEnv(),
  ...FALLBACK_DEV_USERS,
])
