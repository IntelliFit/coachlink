"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowRight, CheckCircle2, ClipboardList, LogOut, RotateCcw, UserRoundPlus } from "lucide-react";
import { useGuideStore } from "@/stores/useGuideStore";
import { useOnboardingModal } from "@/components/auth/OnboardingModalContext";

const AUDIT_MODE_KEY = "coachlink_new_user_experience_audit";
const GUIDE_KEY_PREFIX = "coachlink_guides_completed_";

type ActionStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

const coreScenarios = [
  "游客第一次打开首页：是否知道 CoachLink 是什么，以及下一步该点哪里。",
  "游客想找教练：能否从首页或发现页自然进入教练主页。",
  "游客遇到登录要求：是否能看懂为什么要登录，以及能否返回继续浏览。",
  "老账号模拟新手：重新触发新手引导，观察术语、按钮、路径是否小白友好。",
  "首次资料完善：检查问题是否好懂，是否会让用户觉得被迫填太多。",
  "首次找教练到订阅：检查方案、问卷、支付前确认、支付后下一步是否清楚。",
  "首次进入今日训练：没有计划、有计划、等待教练三种状态是否能看懂。",
];

const auditChecklist = [
  "每一屏都能回答：我现在在哪里，我能做什么，下一步是什么。",
  "按钮文案不用内部术语，比如 instance、execution、subscription 等。",
  "用户拒绝授权、没登录、没计划、没数据时，都有明确出口。",
  "关键路径不依赖用户猜测横向滑动、隐藏入口或长按操作。",
  "付费相关页面清楚说明买什么、多少钱、多久、后续谁来处理。",
  "错误提示像人话，并告诉用户怎么恢复。",
];

function clearLocalGuideState(userId?: string) {
  if (typeof window === "undefined") return 0;

  let removed = 0;
  const keys = Object.keys(window.localStorage);
  keys.forEach((key) => {
    const isGuideKey = key.startsWith(GUIDE_KEY_PREFIX);
    const isCurrentUserGuideKey = userId ? key === `${GUIDE_KEY_PREFIX}${userId}` : isGuideKey;

    if (isGuideKey && isCurrentUserGuideKey) {
      window.localStorage.removeItem(key);
      removed += 1;
    }
  });

  window.localStorage.setItem(
    AUDIT_MODE_KEY,
    JSON.stringify({
      enabled: true,
      startedAt: new Date().toISOString(),
      userId: userId || null,
    }),
  );

  return removed;
}

export default function NewUserExperienceClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { loadCompletedGuides, stopActiveGuide } = useGuideStore();
  const { openOnboardingModal } = useOnboardingModal();
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ type: "idle", message: "" });
  const [isResettingGuides, setIsResettingGuides] = useState(false);

  const userId = session?.user?.id;
  const userName = useMemo(() => {
    const user = session?.user as any;
    return user?.name || user?.nickname || user?.phone || user?.email || userId || "未登录";
  }, [session?.user, userId]);

  const startGuestAudit = async () => {
    stopActiveGuide();
    clearLocalGuideState(userId);
    setActionStatus({ type: "success", message: "已开启游客检查模式，正在退出登录并回到首页。" });
    await signOut({ callbackUrl: "/" });
  };

  const resetGuideProgress = async () => {
    if (!userId) {
      setActionStatus({ type: "error", message: "请先登录一个测试账号，再重置新手引导状态。" });
      return;
    }

    setIsResettingGuides(true);
    stopActiveGuide();

    try {
      const response = await fetch("/api/dev/new-user-experience/reset-guides", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.message || "重置失败");
      }

      clearLocalGuideState(userId);
      await loadCompletedGuides();
      setActionStatus({
        type: "success",
        message: "已清空当前账号的新手引导完成记录。刷新或进入核心页面后，引导会像新用户一样重新出现。",
      });
    } catch (error: any) {
      setActionStatus({
        type: "error",
        message: error?.message || "重置新手引导失败",
      });
    } finally {
      setIsResettingGuides(false);
    }
  };

  const openFirstProfileFlow = () => {
    if (!userId) {
      setActionStatus({ type: "error", message: "请先登录测试账号，再打开首次资料完善弹窗。" });
      return;
    }

    openOnboardingModal(null);
    setActionStatus({
      type: "success",
      message: "已打开首次资料完善弹窗。注意：如果提交，会更新当前账号的真实资料。",
    });
  };

  return (
    <div data-testid="new-user-experience-page" className="min-h-screen bg-[#F5F2ED] px-4 py-10 text-surface-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[32px] bg-[#22211F] text-white shadow-2xl">
          <div className="grid gap-8 p-8 md:grid-cols-[1.15fr_0.85fr] md:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">
                <ClipboardList size={16} />
                开发专用体验检查台
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-black tracking-tight md:text-5xl">新用户体验检查模式</h1>
                <p className="max-w-2xl text-base leading-8 text-white/72">
                  用老账号也能反复检查小白路径：游客入口、登录注册入口、新手引导、首次资料完善、找教练和今日训练。
                  这个模式默认不删除账号、不清订单、不动训练数据，只重置本机状态和当前账号的引导完成标记。
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/8 p-5">
              <p className="text-sm text-white/55">当前身份</p>
              <p className="mt-2 text-xl font-bold">{status === "loading" ? "读取中..." : userName}</p>
              <p className="mt-4 text-sm leading-6 text-white/65">
                如果要最接近真实注册，仍然需要新手机号/新微信号；这里解决的是“老账号反复体验新手路径”的问题。
              </p>
            </div>
          </div>
        </section>

        {actionStatus.type !== "idle" && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm ${
              actionStatus.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {actionStatus.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <button
            type="button"
            data-testid="start-guest-audit"
            onClick={startGuestAudit}
            className="group rounded-[28px] bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <LogOut className="mb-5 text-[#CF6D4E]" size={28} />
            <h2 className="text-xl font-black">从游客重新开始</h2>
            <p className="mt-3 text-sm leading-6 text-surface-600">退出登录并回到首页，检查未登录用户是否能看懂、能探索、能返回。</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#CF6D4E]">
              开始游客检查 <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            data-testid="reset-guide-progress"
            onClick={resetGuideProgress}
            disabled={isResettingGuides}
            className="group rounded-[28px] bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="mb-5 text-[#CF6D4E]" size={28} />
            <h2 className="text-xl font-black">重跑新手引导</h2>
            <p className="mt-3 text-sm leading-6 text-surface-600">清空当前账号的引导完成记录，让核心页面重新弹出引导。</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#CF6D4E]">
              {isResettingGuides ? "处理中..." : "重置引导"} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            data-testid="open-first-profile-flow"
            onClick={openFirstProfileFlow}
            className="group rounded-[28px] bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <UserRoundPlus className="mb-5 text-[#CF6D4E]" size={28} />
            <h2 className="text-xl font-black">打开首次资料完善</h2>
            <p className="mt-3 text-sm leading-6 text-surface-600">直接检查新用户资料弹窗。提交会更新当前测试账号资料，请只在测试账号上使用。</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#CF6D4E]">
              打开弹窗 <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </button>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-black">快速跳转</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["首页", "/"],
                ["注册页", "/register"],
                ["登录页", "/login"],
                ["找教练", "/coach/discovery"],
                ["今日训练", "/today-training"],
                ["我的订阅", "/coach/subscription"],
              ].map(([label, href]) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => router.push(href)}
                  className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left text-sm font-bold transition hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-black">小白核心路径</h2>
            <div className="mt-5 space-y-3">
              {coreScenarios.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[#F8F4EF] p-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#CF6D4E]" size={18} />
                  <p className="text-sm leading-6 text-surface-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-black">检查时看什么</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {auditChecklist.map((item) => (
              <div key={item} className="rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 text-sm leading-6 text-surface-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
