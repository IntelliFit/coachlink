import { NextRequest, NextResponse } from 'next/server';
import supabase from "@/lib/supabaseClient";
import { verifyPassword } from "../../auth/[...nextauth]/verify";
import { signToken } from "@/lib/jwt";

/**
 * 小程序专用登录接口
 * 不依赖 Cookie 和 Session，直接返回用户信息和 token
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneOrEmail, password, verifyCode } = body;

    if (!phoneOrEmail) {
      return NextResponse.json({
        success: false,
        message: "请输入手机号或邮箱"
      }, { status: 400 });
    }

    // 判断是手机号还是邮箱
    const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

    if (!isPhone && !isEmail) {
      return NextResponse.json({
        success: false,
        message: "请输入正确的手机号或邮箱格式"
      }, { status: 400 });
    }

    // 查询用户
    let userQuery;
    if (isPhone) {
      userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).single();
    } else {
      userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).single();
    }

    const { data: user, error: userError } = await userQuery;

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: "用户不存在"
      }, { status: 404 });
    }

    // 方式1：密码登录
    if (password && !verifyCode) {
      const isValid = verifyPassword(password, user.password_hash);
      if (!isValid) {
        return NextResponse.json({
          success: false,
          message: "密码错误"
        }, { status: 401 });
      }

      // 移除敏感信息
      const { password_hash, ...userWithoutPassword } = user;

      // 生成JWT token
      const token = signToken({ 
        userId: user.id,
        phone: user.phone,
        email: user.email 
      });

      return NextResponse.json({
        success: true,
        message: "登录成功",
        data: {
          user: userWithoutPassword,
          token: token
        }
      });
    }

    // 方式2：验证码登录
    if (verifyCode && !password) {
      // 在开发环境中，允许使用 123456 作为万能验证码
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && verifyCode === '123456') {
        const { password_hash, ...userWithoutPassword } = user;
        
        // 生成JWT token
        const token = signToken({ 
          userId: user.id,
          phone: user.phone,
          email: user.email 
        });

        return NextResponse.json({
          success: true,
          message: "登录成功（开发模式）",
          data: {
            user: userWithoutPassword,
            token: token
          }
        });
      }

      // TODO: 实际验证码验证逻辑
      // 需要从 Redis 中验证验证码
      return NextResponse.json({
        success: false,
        message: "验证码功能暂未实现"
      }, { status: 501 });
    }

    return NextResponse.json({
      success: false,
      message: "请提供密码或验证码"
    }, { status: 400 });

  } catch (error: any) {
    console.error('小程序登录错误:', error);
    return NextResponse.json({
      success: false,
      message: error.message || "登录失败"
    }, { status: 500 });
  }
}

