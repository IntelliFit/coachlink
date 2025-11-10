import { UserProfilesRow, UsersRow } from '@/types'
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {

    type CoachLinkUser = DefaultUser & UsersRow

    /**
     * 扩展 User 类型（数据库返回的完整结构）
     */
    interface User extends CoachLinkUser {
        email: string | null
    }

    /**
     * 扩展 Session 类型（给前端使用）
     */
    interface Session extends DefaultSession {
        user: DefaultSession['user'] & UsersRow
        profile: UserProfilesRow
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        user: UsersRow
    }
}
