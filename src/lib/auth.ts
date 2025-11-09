import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import supabase from '@/lib/supabaseClient';
import { verifyPassword } from '@/app/api/auth/login/util';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                phone: { label: 'Phone', type: 'text' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.phone || !credentials?.password) {
                    return null;
                }

                // 查询用户
                const { data: user, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('phone', credentials.phone)
                    .single();

                if (error || !user) {
                    return null;
                }

                // 验证密码
                const isValid = verifyPassword(credentials.password, user.password_hash);
                if (!isValid) {
                    return null;
                }

                // 更新最后登录时间
                await supabase
                    .from('users')
                    .update({ last_login_at: new Date().toISOString() })
                    .eq('id', user.id);

                return {
                    id: user.id,
                    phone: user.phone,
                    name: user.name,
                    email: user.email
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                // token.phone = user.phone;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.phone = token.phone as string;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60 // 7 days
    },
    secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);