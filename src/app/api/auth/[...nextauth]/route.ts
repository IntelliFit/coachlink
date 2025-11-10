// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import supabase from '@/lib/supabaseClient';
import { verifyPassword } from './verify';
import { UsersRow } from '@/types';

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                phone: { label: 'Phone', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.phone || !credentials?.password) {
                    throw new Error('请输入手机号和密码');
                }

                // 查询用户
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('phone', credentials.phone)
                    .single();

                if (userError || !user) {
                    throw new Error('用户不存在' + userError?.message);
                }

                const isValid = verifyPassword(credentials.password, user.password_hash);
                if (!isValid) {
                    throw new Error('密码错误');
                }

                // 返回用户信息（会保存到 token / session）
                return {
                    id: user.id,
                    phone: user.phone || '',
                    email: user.email || '',
                    admin_role: user.admin_role || 'common_user',
                };
            },
        }),
    ],
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.user = user;
            }
            return token;
        },
        async session({ session, token }) {
            const user = token.user as UsersRow;
            if (!user) {
                // 说明此时没有登陆
                return session;
            }

            const { data: profile, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error || !profile) {
                session.user = token.user;

            } else {                
                session.user = {
                    ...token.user,
                    nickname: profile.nickname || '',
                    avatar_url: profile.avatar_url || ''
                };
            }

            return session;
        },
    },
    pages: {
        signIn: '/login', // 可选，登录页路径
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
