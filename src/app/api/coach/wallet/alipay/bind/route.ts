import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { BindAlipayDto, BindAlipayResponse } from "../entity";

const normalizePayeeType = (input?: string | null) => {
    if (!input) return "ALIPAY_LOGON_ID";
    if (input === "ALIPAY_LOGONID") return "ALIPAY_LOGON_ID";
    return input;
};

function maskAccount(account: string) {
    if (!account) return "";
    // simple mask: keep first 3 and last 2
    if (account.includes("@")) {
        const [local, domain] = account.split("@");
        const head = local.slice(0, 2);
        return `${head}***@${domain}`;
    }
    if (/^\d+$/.test(account)) {
        return account.replace(/(\d{3})\d+(\d{2})/, "$1****$2");
    }
    return account.slice(0, 3) + "***" + account.slice(-2);
}

export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    // find coach
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", session.user.id).single();
    if (!coach) return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });

    const { data: acc } = await supabase.from("alipay_accounts").select("id, payee_account, payee_type, real_name, verified, created_at").eq("coach_id", coach.id).single();
    if (!acc) return NextResponse.json({ success: true, message: "未绑定支付宝", data: null });

    const resp: BindAlipayResponse = {
        id: acc.id,
        payee_account_masked: maskAccount(acc.payee_account),
        verified: !!acc.verified,
    };

    return NextResponse.json({ success: true, message: "获取支付宝绑定信息", data: resp });
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const body = await req.json() as BindAlipayDto;
    if (!body?.payee_account) {
        return NextResponse.json({ success: false, message: "缺少支付宝账号", data: null }, { status: 400 });
    }

    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", session.user.id).single();
    if (!coach) return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });

    const now = new Date().toISOString();
    const payeeType = normalizePayeeType(body.payee_type);
    if (payeeType === "ALIPAY_LOGON_ID" && !body.real_name) {
        return NextResponse.json({ success: false, message: "绑定登录号时必须填写真实姓名", data: null }, { status: 400 });
    }

    const record = {
        coach_id: coach.id,
        payee_account: body.payee_account,
        payee_type: payeeType,
        real_name: body.real_name || null,
        verification_method: body.verification_method || 'manual_input',
        updated_at: now,
    } as const;

    try {
        const { data: existing, error: existingErr, status } = await supabase
            .from('alipay_accounts')
            .select('id, payee_account, verified')
            .eq('coach_id', coach.id)
            .maybeSingle();

        if (existingErr && status !== 406) {
            console.error('[Alipay Bind] fetch existing error', existingErr);
            return NextResponse.json({ success: false, message: '绑定失败', data: null }, { status: 500 });
        }

        if (existing) {
            const { error: updateErr } = await serviceRoleSupabase
                .from('alipay_accounts')
                .update({ ...record, updated_at: now })
                .eq('coach_id', coach.id);

            if (updateErr) {
                console.error('[Alipay Bind] update error', updateErr);
                return NextResponse.json({ success: false, message: updateErr.message || '绑定失败', data: null }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: '绑定成功',
                data: {
                    id: existing.id,
                    payee_account_masked: maskAccount(record.payee_account),
                    verified: !!existing.verified,
                },
            });
        }

        const { data: inserted, error: insertErr } = await serviceRoleSupabase
            .from('alipay_accounts')
            .insert({ ...record, created_at: now, verified: false })
            .select('id, payee_account, verified')
            .single();

        if (insertErr || !inserted) {
            console.error('[Alipay Bind] insert error', insertErr);
            return NextResponse.json({ success: false, message: insertErr?.message || '绑定失败', data: null }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: '绑定成功',
            data: {
                id: inserted.id,
                payee_account_masked: maskAccount(inserted.payee_account),
                verified: !!inserted.verified,
            },
        });
    } catch (err) {
        console.error('[Alipay Bind] unexpected error', err);
        return NextResponse.json({ success: false, message: '绑定失败', data: null }, { status: 500 });
    }
}
