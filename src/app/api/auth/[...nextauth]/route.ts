// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import supabase from '@/lib/supabaseClient';
import { verifyPassword } from './verify';

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
                    .eq('phone', credentials.phone.trim())
                    .single();

                if (userError || !user) {
                    throw new Error('用户不存在\n' + userError?.message);
                }

                const isValid = verifyPassword(credentials.password.trim(), user.password_hash);
                if (!isValid) {
                    throw new Error('密码错误');
                }

                // 返回用户信息（会保存到 token / session）
                (user as any).password_hash = undefined;
                return user;
            },
        }),
    ],
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                (user as any).password_hash = undefined;
                token.user = user;
            }
            return token;
        },
        async session({ session, token }) {
            const user = token.user;
            if (!user) {
                // 说明此时没有登陆
                return session;
            }

            (user as any).password_hash = undefined;
            session.user = token.user;

            const { data: profile, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (profile) {
                session.profile = profile;
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
