import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Database, Globe2, Mail, ShieldCheck, Smartphone } from 'lucide-react'

export const metadata: Metadata = {
  title: '账号与数据删除 | CoachLink',
  description: '在 CoachLink App、网页或无法登录时申请删除账号及关联数据。',
}

const SUPPORT_EMAIL = '2945463110@qq.com'
const deletionMailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CoachLink 账号与关联数据删除申请')}&body=${encodeURIComponent('请填写注册手机号或邮箱（请勿提供密码或验证码）：\n无法登录的原因（可选）：\n希望删除的数据范围：账号及全部关联个人数据\n')}`

const paths = [
  {
    icon: Smartphone,
    title: '在 CoachLink App 内申请',
    detail: '打开「我的」→「账户设置」→「注销账号」，阅读影响并输入“注销账号”确认。',
  },
  {
    icon: Globe2,
    title: '在网页端申请',
    detail: '登录 CoachLink 后，学员进入「我的设置」，教练进入「安全设置」，在危险操作区提交注销。',
  },
  {
    icon: Mail,
    title: '无法登录或已卸载 App',
    detail: `发送邮件至 ${SUPPORT_EMAIL}。请提供注册手机号或邮箱用于身份核验，不要发送密码、验证码或支付密码。`,
  },
]

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-surface-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8E7E2] text-[#CF6D4E]">
            <ShieldCheck aria-hidden="true" size={24} />
          </div>
          <p className="mb-2 text-sm font-bold text-[#CF6D4E]">CoachLink 隐私控制</p>
          <h1 className="text-3xl font-black tracking-tight text-surface-900">账号与关联数据删除</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-surface-600">
            你可以在 App、网页或无法登录时发起删除请求。我们会先核验账号归属，避免他人冒用你的身份删除数据。
          </p>
        </header>

        <section aria-labelledby="deletion-paths" className="space-y-4">
          <h2 id="deletion-paths" className="text-xl font-black text-surface-900">选择一种申请方式</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {paths.map(({ icon: Icon, title, detail }) => (
              <article key={title} className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
                <Icon aria-hidden="true" className="text-[#CF6D4E]" size={24} />
                <h3 className="mt-4 text-base font-black text-surface-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-600">{detail}</p>
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/login" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[#B4553A] px-6 py-3 text-center text-sm font-black text-white hover:bg-[#9A4630] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF6D4E]">
              登录后处理
            </Link>
            <a href={deletionMailHref} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-surface-300 bg-white px-6 py-3 text-center text-sm font-black text-surface-900 hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF6D4E]">
              发送删除申请邮件
            </a>
          </div>
        </section>

        <section aria-labelledby="deletion-scope" className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <Database aria-hidden="true" className="mt-1 shrink-0 text-[#CF6D4E]" size={24} />
            <div>
              <h2 id="deletion-scope" className="text-xl font-black text-surface-900">删除范围与处理方式</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-surface-600">
                <li>登录凭据会停用，手机号、邮箱和微信登录标识会从当前账号解绑，账号无法继续登录。</li>
                <li>昵称、头像、公开联系方式和公开健身资料会删除或去标识化，当前教练服务关系会结束。</li>
                <li>训练记录、健康与健身数据、聊天、视频、反馈等关联个人数据进入删除或去标识化处理流程。</li>
                <li>依法必须保留的订单、支付、退款、结算、安全与争议处理记录，会在法定或必要期限内隔离保留，期满后删除或匿名化。</li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="before-delete" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle aria-hidden="true" className="mt-1 shrink-0 text-amber-700" size={24} />
            <div>
              <h2 id="before-delete" className="text-xl font-black text-amber-950">提交前请注意</h2>
              <p className="mt-3 text-sm leading-6 text-amber-900">
                注销不可恢复。提交后请留意客服回复；如存在未完成订单、退款、提现或争议，我们会说明需要先完成的步骤与预计处理时间。
              </p>
            </div>
          </div>
        </section>

        <nav aria-label="相关隐私页面" className="flex flex-wrap gap-4 text-sm font-bold">
          <Link href="/privacy" className="text-[#CF6D4E] underline-offset-4 hover:underline">查看隐私政策</Link>
          <Link href="/contact" className="text-[#CF6D4E] underline-offset-4 hover:underline">联系我们</Link>
          <Link href="/" className="text-surface-600 underline-offset-4 hover:underline">返回 CoachLink 首页</Link>
        </nav>
      </div>
    </div>
  )
}
