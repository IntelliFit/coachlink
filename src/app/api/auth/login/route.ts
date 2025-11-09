import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { signToken, verifyToken } from '@/lib/jwt';
import { setTokenCookie, parseCookies } from '@/lib/cookie';
import { verifyPassword } from './util';

export async function POST(req: NextRequest) {
    try {
        const cookies = parseCookies(req.headers.get('cookie'));
        const token = cookies['auth_token'];

        if (!token) {
            // 如果没有 token，则使用手机号 + 密码/验证码登录
            const { phone, password, verificationCode } = await req.json();

            if (!phone || (!password && !verificationCode)) {
                return NextResponse.json({ error: '缺少登录信息' }, { status: 400 });
            }

            // 查询用户
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();

            if (!user) {
                return NextResponse.json({ error: '用户不存在' }, { status: 404 });
            }

            

            // 如果有密码，则校验
            if (password) {
                const isValid = verifyPassword(password, user.password_hash);
                if (!isValid) {
                    return NextResponse.json({ error: '密码错误' }, { status: 401 });
                }
            }

            // TODO: 如果有验证码逻辑，在这里验证 verificationCode

            // 更新 last_login_at
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', user.id);

            const newToken = signToken({ id: user.id, phone: user.phone });
            const response = NextResponse.json({ message: '登录成功', user });
            response.headers.set('Set-Cookie', setTokenCookie(newToken));
            return response;
        } else {
            // 如果有 token，则验证
            const payload = verifyToken(token);
            if (!payload) {
                return NextResponse.json({ error: 'Token 无效或已过期' }, { status: 401 });
            }

            // 查询用户
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('id', (payload as any).id)
                .single();

            if (!user) {
                return NextResponse.json({ error: '用户不存在' }, { status: 404 });
            }

            return NextResponse.json({ message: '登录有效', user });
        }
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
