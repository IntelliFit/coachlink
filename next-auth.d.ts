import { UserProfilesRow, UsersRow } from '@/types'
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {

    type CoachLinkUser = DefaultUser & UsersRow

    /**
     * 扩展 User 类型（数据库返回的完整结构）
     */
    interface User extends DefaultUser, Partial<UsersRow> {
        id: string; // 确保 id 是必须的
    }

    /**
     * 扩展 Session 类型（给前端使用）
     */
    interface Session extends DefaultSession {
        user: DefaultSession['user'] & UsersRow
        profile: UserProfilesRow
    }


    /**
     * 扩展 TokenSet 类型，增加微信特有的字段
     */
    interface TokenSet {
        access_token?: string
        openid?: string
        refresh_token?: string
        expires_at?: number
        scope?: string
        unionid?: string
    }

}

declare module 'next-auth/jwt' {
    interface JWT {
        user: UsersRow
    }
}

