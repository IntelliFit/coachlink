import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/jwt';
import { setTokenCookie } from '@/lib/cookie';

export async function POST(req: NextRequest) {
    const { phone, password, email } = await req.json();

    if (!phone || !password) {
        return NextResponse.json({ error: '手机号和密码不能为空' }, { status: 400 });
    }

    try {
        // 检查手机号是否已注册
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single();

        if (existingUser) {
            return NextResponse.json({ error: '手机号已注册' }, { status: 400 });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { data: user } = await supabase
            .from('users')
            .insert({
                phone,
                password_hash,
                email,
                created_at: new Date().toISOString(),
                last_login_at: new Date().toISOString(),
            })
            .select('*')
            .single();

        // 签发 JWT
        const token = signToken({ id: user.id, phone: user.phone });

        const response = NextResponse.json({ message: '注册成功', user });
        response.headers.set('Set-Cookie', setTokenCookie(token));

        return response;
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
