// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import supabase from '@/lib/supabaseClient';
import { verifyPassword } from '../login/util';

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
                const { data: user, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('phone', credentials.phone)
                    .single();

                if (error || !user) throw new Error('用户不存在');

                const isValid = verifyPassword(credentials.password, user.password_hash);
                if (!isValid) throw new Error('密码错误');

                // 返回用户信息（会保存到 token / session）
                return {
                    id: user.id,
                    phone: user.phone,
                    email: user.email,
                    admin_role: user.admin_role,
                };
            },
        }),
    ],
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) token.user = user;
            return token;
        },
        async session({ session, token }) {
            session.user = token.user as any;
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
