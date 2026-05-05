import { NextRequest, NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const userId = await getApiUserId(req);
        if (!userId) {
            return NextResponse.json(
                { success: false, message: "请先登录" },
                { status: 401 },
            );
        }

        const body = await req.json();
        const code = String(body.code || "").trim();
        if (!code) {
            return NextResponse.json(
                { success: false, message: "缺少 code 参数" },
                { status: 400 },
            );
        }

        const appid = (process.env.WECHAT_MINIAPP_APPID || "").trim();
        const secret = (process.env.WECHAT_MINIAPP_SECRET || "").trim();
        if (!appid || !secret) {
            return NextResponse.json(
                { success: false, message: "微信小程序配置缺失" },
                { status: 500 },
            );
        }

        // 检查当前用户是否已绑定 openid
        const { data: currentUser } = await serviceRoleSupabase
            .from("users")
            .select("wechat_openid")
            .eq("id", userId)
            .maybeSingle();

        if (currentUser?.wechat_openid) {
            return NextResponse.json({
                success: true,
                message: "已绑定微信账号",
                data: { openid: currentUser.wechat_openid },
            });
        }

        // 调用微信 code2Session
        const code2SessionUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
        code2SessionUrl.searchParams.set('appid', appid);
        code2SessionUrl.searchParams.set('secret', secret);
        code2SessionUrl.searchParams.set('js_code', code);
        code2SessionUrl.searchParams.set('grant_type', 'authorization_code');

        let result: any;
        try {
            const response = await fetch(code2SessionUrl.toString(), { method: 'GET' });
            result = await response.json();
        } catch (fetchError: any) {
            console.error("[BindWechat] WeChat API unreachable:", fetchError?.message);
            return NextResponse.json(
                { success: false, message: "微信服务暂时无法连接，请稍后重试" },
                { status: 502 },
            );
        }

        if (result.errcode) {
            console.error("[BindWechat] code2Session error:", result.errcode, result.errmsg);
            return NextResponse.json(
                { success: false, message: result.errmsg || `微信接口错误 (${result.errcode})` },
                { status: 400 },
            );
        }

        const { openid } = result;
        if (!openid) {
            console.error("[BindWechat] no openid in response:", result);
            return NextResponse.json(
                { success: false, message: "获取 openid 失败" },
                { status: 500 },
            );
        }

        // 检查 openid 是否已被其他账号绑定（一个微信只能绑一个号）
        const { data: conflictUser } = await serviceRoleSupabase
            .from("users")
            .select("id")
            .eq("wechat_openid", openid)
            .neq("id", userId)
            .maybeSingle();

        if (conflictUser) {
            return NextResponse.json(
                { success: false, message: "该微信已绑定其他账号" },
                { status: 409 },
            );
        }

        const { error: updateError } = await serviceRoleSupabase
            .from("users")
            .update({ wechat_openid: openid })
            .eq("id", userId);

        if (updateError) {
            console.error("[BindWechat] update failed:", updateError);
            if (updateError.code === '23505') {
                return NextResponse.json(
                    { success: false, message: "该微信已绑定其他账号，请先解绑后再试" },
                    { status: 409 },
                );
            }
            return NextResponse.json(
                { success: false, message: "绑定失败，请稍后重试" },
                { status: 500 },
            );
        }

        console.log("[BindWechat] success: userId=", userId, "openid=", openid.slice(0, 10) + "...");
        return NextResponse.json({
            success: true,
            message: "微信账号绑定成功",
            data: { openid },
        });
    } catch (error: any) {
        console.error("[BindWechat] unexpected error:", error);
        return NextResponse.json(
            { success: false, message: error?.message || "绑定失败" },
            { status: 500 },
        );
    }
}
