import NextAuth, { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
    /**
     * 扩展 User 类型（数据库返回的完整结构）
     */
    interface User extends DefaultUser {
        id: string
        phone: string
        admin_role: string
        has_drawn?: boolean
    }

    /**
     * 扩展 Session 类型（给前端使用）
     */
    interface Session extends DefaultSession {
        user: {
            id: string
            phone: string
            admin_role: string
            nickname?: string
            avatar_url?: string
            has_drawn?: boolean
        } & DefaultSession['user']
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        user: {
            id: string
            phone: string
            admin_role: string
            has_drawn?: boolean
        }
    }
}
