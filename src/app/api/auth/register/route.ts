import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../[...nextauth]/verify';
// import { signToken } from '@/lib/jwt';
// import { setTokenCookie } from '@/lib/cookie';

export async function POST(req: NextRequest) {
    const { phone, password, verifyCode } = await req.json();

    if (!phone || !password) {
        return NextResponse.json({ error: '手机号和密码不能为空' }, { status: 400 });
    }

    if (!verifyCode) {
        return NextResponse.json({ error: '验证码不能为空' }, { status: 400 });
    }

    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

    if (existingUser) {
        return NextResponse.json({ error: '手机号已注册' }, { status: 400 });
    }

    const password_hash = hashPassword(password);

    const { data: user } = await supabase
        .from('users')
        .insert({
            phone,
            password_hash,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    return NextResponse.json({ message: '注册成功', user });
}