import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    uploadHuifuFile,
    createHuifuIndividualUser,
    openHuifuUserBusiness,
} from "@/lib/huifuMiniProgramPay";

export const runtime = "nodejs";

interface OpenHuifuAccountBody {
    name: string;
    certNo: string;
    mobileNo: string;
    certValidityType: string;
    certBeginDate: string;
    certEndDate?: string;
    idCardFront?: string;
    idCardBack?: string;
    cardNo: string;
    cardName: string;
    bankCode: string;
    branchCode: string;
    branchName: string;
    provId: string;
    areaId: string;
}

function trimString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

async function updateCoachHuifuState(coachId: string, values: Record<string, unknown>) {
    const { error } = await serviceRoleSupabase
        .from("coaches")
        .update(values as any)
        .eq("id", coachId);

    if (!error) return null;

    const message = String(error.message || "");
    const isMissingNewColumn =
        message.includes("huifu_apply_no")
        || message.includes("huifu_business_status")
        || message.includes("huifu_resp_business");

    if (!isMissingNewColumn) return error;

    const fallback = { ...values };
    delete fallback.huifu_apply_no;
    delete fallback.huifu_business_status;
    delete fallback.huifu_resp_business;

    const retry = await serviceRoleSupabase
        .from("coaches")
        .update(fallback as any)
        .eq("id", coachId);

    return retry.error ?? null;
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录", data: null },
                { status: 401 },
            );
        }

        const { data: coach, error: coachError } = await serviceRoleSupabase
            .from("coaches")
            .select("id, huifu_id, huifu_open_status, huifu_card_token")
            .eq("user_id", userId)
            .maybeSingle();

        if (coachError || !coach) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "仅教练可开通收款账户", data: null },
                { status: 403 },
            );
        }

        if (coach.huifu_open_status === "opened" && coach.huifu_card_token) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "收款账户已完整开通", data: null },
                { status: 409 },
            );
        }

        const body = (await request.json()) as OpenHuifuAccountBody;
        const clean = {
            name: trimString(body.name),
            certNo: trimString(body.certNo),
            mobileNo: trimString(body.mobileNo),
            certValidityType: trimString(body.certValidityType) || "1",
            certBeginDate: trimString(body.certBeginDate),
            certEndDate: trimString(body.certEndDate),
            idCardFront: trimString(body.idCardFront),
            idCardBack: trimString(body.idCardBack),
            cardNo: trimString(body.cardNo),
            cardName: trimString(body.cardName),
            bankCode: trimString(body.bankCode),
            branchCode: trimString(body.branchCode),
            branchName: trimString(body.branchName),
            provId: trimString(body.provId),
            areaId: trimString(body.areaId),
            // Huifu personal users can only bind private settlement cards.
            cardType: "1",
        };

        if (!clean.cardNo || !clean.cardName || !clean.bankCode || !clean.branchCode || !clean.branchName || !clean.provId || !clean.areaId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "银行卡信息不完整，请补充开户行、支行和地区编码", data: null },
                { status: 400 },
            );
        }

        if (!clean.certNo || !clean.certBeginDate || !clean.mobileNo) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "身份信息不完整", data: null },
                { status: 400 },
            );
        }

        let existingHuifuId: string | null = coach.huifu_id ?? null;

        if (!existingHuifuId) {
            if (!clean.name || !clean.idCardFront || !clean.idCardBack) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "首次开户需要姓名和身份证正反面照片", data: null },
                    { status: 400 },
                );
            }

            let frontFileId: string;
            let backFileId: string;
            try {
                const [frontResult, backResult] = await Promise.all([
                    uploadHuifuFile({ fileContent: clean.idCardFront, fileType: "F04" }),
                    uploadHuifuFile({ fileContent: clean.idCardBack, fileType: "F05" }),
                ]);
                frontFileId = frontResult.file_id;
                backFileId = backResult.file_id;
            } catch (e: any) {
                console.error("[OpenHuifuAccount] file upload failed:", e?.message);
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "证件上传失败，请稍后重试", data: null },
                    { status: 500 },
                );
            }

            const fileList = JSON.stringify([
                { file_type: "F04", file_id: frontFileId },
                { file_type: "F05", file_id: backFileId },
            ]);

            let huifuId: string;
            try {
                const userResult = await createHuifuIndividualUser({
                    name: clean.name,
                    certType: "00",
                    certNo: clean.certNo,
                    certValidityType: clean.certValidityType,
                    certBeginDate: clean.certBeginDate,
                    certEndDate: clean.certEndDate || undefined,
                    mobileNo: clean.mobileNo,
                    fileList,
                });
                huifuId = userResult.huifu_id;
            } catch (e: any) {
                console.error("[OpenHuifuAccount] create user failed:", e?.message);
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: e?.message || "开户失败，请检查身份信息", data: null },
                    { status: 500 },
                );
            }

            await updateCoachHuifuState(coach.id, {
                    huifu_id: huifuId,
                    huifu_open_status: "basic_opened",
                    huifu_open_msg: "汇付个人用户已开户，待完成业务入驻",
                    huifu_card_token: null,
                    huifu_apply_no: null,
                    huifu_business_status: "basic_opened",
                });

            existingHuifuId = huifuId;
        }

        const huifuId = existingHuifuId!;
        let cardToken: string;
        let applyNo: string | undefined;
        let respBusiness: unknown;

        try {
            await updateCoachHuifuState(coach.id, {
                    huifu_open_status: "business_pending",
                    huifu_open_msg: "汇付用户业务入驻提交中",
                    huifu_business_status: "submitting",
                });

            const bizResult = await openHuifuUserBusiness({
                huifuId,
                cardType: clean.cardType,
                cardNo: clean.cardNo,
                cardName: clean.cardName,
                bankCode: clean.bankCode,
                branchCode: clean.branchCode,
                branchName: clean.branchName,
                provId: clean.provId,
                areaId: clean.areaId,
                certType: "00",
                certNo: clean.certNo,
                certValidityType: clean.certValidityType,
                certBeginDate: clean.certBeginDate,
                certEndDate: clean.certEndDate || undefined,
                mobileNo: clean.mobileNo,
            });
            if (bizResult.pending || !bizResult.tokenNo) {
                const pendingUpdateError = await updateCoachHuifuState(coach.id, {
                    huifu_open_status: "business_pending",
                    huifu_open_msg: "汇付用户业务入驻审核中，审核通过并返回取现卡序列号后才能收款分账",
                    huifu_card_token: null,
                    huifu_apply_no: bizResult.applyNo ?? null,
                    huifu_business_status: "pending",
                    huifu_resp_business: bizResult.respBusiness ?? null,
                });
                if (pendingUpdateError) {
                    console.error("[OpenHuifuAccount] pending db update failed:", pendingUpdateError);
                    return NextResponse.json<ApiData<null>>(
                        { success: false, message: "开户审核状态保存失败", data: null },
                        { status: 500 },
                    );
                }
                return NextResponse.json<ApiData<{ huifu_id: string; apply_no?: string }>>({
                    success: true,
                    message: "收款账户已提交汇付审核，审核通过后才能用于分账和提现",
                    data: { huifu_id: huifuId, apply_no: bizResult.applyNo },
                });
            }
            cardToken = bizResult.tokenNo;
            applyNo = bizResult.applyNo;
            respBusiness = bizResult.respBusiness;
        } catch (e: any) {
            console.error("[OpenHuifuAccount] business open failed:", e?.message);
            await updateCoachHuifuState(coach.id, {
                    huifu_open_status: "failed",
                    huifu_open_msg: `业务入驻失败: ${e?.message || "未知错误"}`,
                    huifu_card_token: null,
                    huifu_business_status: "failed",
                });
            return NextResponse.json<ApiData<null>>(
                { success: false, message: e?.message || "业务入驻失败，请稍后重试", data: null },
                { status: 500 },
            );
        }

        const updateError = await updateCoachHuifuState(coach.id, {
                huifu_open_status: "opened",
                huifu_open_msg: null,
                huifu_card_token: cardToken,
                huifu_apply_no: applyNo ?? null,
                huifu_business_status: "opened",
                huifu_resp_business: respBusiness ?? null,
            });

        if (updateError) {
            console.error("[OpenHuifuAccount] db update failed:", updateError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "开户信息保存失败", data: null },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<{ huifu_id: string }>>({
            success: true,
            message: "收款账户开通成功",
            data: { huifu_id: huifuId },
        });
    } catch (error: any) {
        console.error("[OpenHuifuAccount] unexpected error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "开户失败", data: null },
            { status: 500 },
        );
    }
}
