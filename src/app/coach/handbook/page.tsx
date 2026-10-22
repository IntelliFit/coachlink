import type { Metadata } from 'next';
import {
    COACH_GROUP_QR_PATH,
    COACH_GROUP_QR_VALID_UNTIL,
    PLATFORM_COMMISSION_PERCENT,
} from '@coachlink/core/src/coachPolicy';
import { resolveCoachSettlementDelayDays } from '@/lib/platformCommission';
import { getCoachWithdrawalRules } from '@/lib/coachWithdrawalRules';

export const metadata: Metadata = {
    title: '教练手册 | CoachLink',
    description: 'CoachLink 教练入驻、开店、带学员和收入结算说明',
};

// 结算期、提现规则来自线上环境变量，每次请求按当前配置渲染
export const dynamic = 'force-dynamic';

type Section = {
    id: string;
    title: string;
    intro?: string;
    items: Array<{ title?: string; body: string }>;
};

function buildSections(): Section[] {
    const delayDays = resolveCoachSettlementDelayDays();
    const withdrawal = getCoachWithdrawalRules(0);

    return [
        {
            id: 'flow',
            title: '入驻流程',
            items: [
                { title: '1. 提交申请', body: '在「我的 → 申请成为教练」选择层级（训练搭子 / 进阶教练 / 专业教练），如实填写经历、擅长方向和手机号，上传资质或学员案例。' },
                { title: '2. 平台联系', body: '平台运营会通过电话或微信联系你核实资料，并邀请你加入教练群参加入职培训。资料不够时会私信告诉你需要补充什么。' },
                { title: '3. 审核通过', body: '通过后会收到系统私信，可以切换到教练端。此时你已经出现在学员发现页，但还需要完成下面的开店 4 步才能收款。' },
                { title: '4. 开始带学员', body: '学员看主页、选套餐、填问卷、付款后进入你的「我的学员」，你发放计划、看训练反馈、按周调整。' },
            ],
        },
        {
            id: 'setup',
            title: '开店 4 步',
            intro: '四步都完成，学员才能在你的主页上顺利下单。',
            items: [
                { title: '收款账户', body: '在教练端订阅设置里完成汇付开户：实名认证 + 本人结算银行卡。开户审核通过前，学员无法付款给你。' },
                { title: '套餐定价', body: '先做 1-2 个主套餐就够，例如「入门评估 + 4 周计划」「进阶跟练 + 8 周计划」。写清服务内容、周期、反馈频率和价格。' },
                { title: '学员问卷', body: '至少包含训练目标、训练经验、每周可训练次数、重点动作、伤病和禁忌、当前能力数据（1RM、最大次数、体重），并发布为当前问卷，不要只存草稿。' },
                { title: '计划模板', body: '在计划库准备 2-3 个可复用模板（新手基础 / 专项提升 / 高阶）。动作库里补齐动作说明和演示视频，学员付款后系统更容易自动匹配。' },
            ],
        },
        {
            id: 'daily',
            title: '带学员的日常',
            items: [
                { body: '新学员当天处理：先看问卷和订阅周期，再决定自动匹配模板、手动建计划，还是先联系学员补充信息。' },
                { body: '每周至少检查一次未完成训练、学员反馈和训练视频，按真实执行数据调整下一周。' },
                { body: '学员反馈疼痛或伤病时不要直接套模板，先人工判断，必要时建议就医。' },
                { body: '续费前提前准备下一阶段计划，让学员看到清晰的进步路线。' },
            ],
        },
        {
            id: 'norms',
            title: '服务规范',
            intro: '这些规范保护学员，也保护你。违反规范的教练平台会提醒、暂停接单，严重的取消教练资格。',
            items: [
                { title: '如实展示', body: '资质、经历、案例真实可查，不冒用证书，不夸大效果。' },
                { title: '及时响应', body: '学员消息原则上 24 小时内回复；无法按时服务时提前告诉学员。' },
                { title: '交易在平台内', body: '不引导学员站外付款。站外交易出现纠纷，平台无法保障任何一方。' },
                { title: '专业边界', body: '不做医疗诊断，不推荐违禁药物，不承诺具体减重或成绩数字。' },
                { title: '保护隐私', body: '不外传学员资料、照片和训练视频，不用学员信息做与服务无关的事。' },
            ],
        },
        {
            id: 'rights',
            title: '双方权益',
            items: [
                { title: '教练权益', body: '按规则准时分账和提现；你创建的计划模板和内容归你所有；平台不会把你的学员转给其他教练；收到不实差评可以申诉。' },
                { title: '学员权益', body: '购买前能看到完整的服务内容和价格；服务中有问题可以向平台反馈；需要退款时由平台核实服务完成情况后处理，已分给教练的部分会相应冲回。' },
            ],
        },
        {
            id: 'income',
            title: '收入与结算',
            items: [
                { title: '平台服务费', body: `入驻初期按订单金额的 ${PLATFORM_COMMISSION_PERCENT}% 收取，其余 ${100 - PLATFORM_COMMISSION_PERCENT}% 归教练。比例调整会提前通知，已付款订单按付款时的比例结算。` },
                { title: '分账时间', body: delayDays > 0
                    ? `学员付款后 ${delayDays} 天自动分账到你的收款账户，这段时间用于处理退款。`
                    : '学员付款后自动分账到你的收款账户。' },
                { title: '提现', body: `${withdrawal.destination_description}。${withdrawal.arrival_description}，${withdrawal.availability_description}。${withdrawal.fee_description}。` },
            ],
        },
        {
            id: 'growth',
            title: '成长路线',
            intro: '平台用真实的训练执行、完成率、续费和评价判断教练，而不是只看证书。',
            items: [
                { title: '见习教练', body: '审核通过，进入教练群，完成入职培训。' },
                { title: '可接单', body: '完成开店 4 步，学员可以直接下单。' },
                { title: '认证教练', body: '持续带学员，学员完成率、续费和评价表现好，获得平台认证和学员推荐。' },
                { title: '推荐教练', body: '长期表现突出的教练进入首页推荐位，获得更多平台流量。' },
            ],
        },
        {
            id: 'faq',
            title: '常见问题',
            items: [
                { title: '审核通过了，学员却不能购买？', body: '依次检查：收款账户是否开户成功、套餐是否已保存、主页是否正常显示套餐。' },
                { title: '学员填了问卷，没有自动生成计划？', body: '检查是否有已发布问卷、是否有可匹配的模板、模板训练天数和学员每周训练次数是否匹配、自动化设置是否关闭。' },
                { title: '还没有模板，能先收学员吗？', body: '可以，但不推荐。至少准备一个基础模板，否则每个新学员都要从零排课，响应会很慢。' },
            ],
        },
    ];
}

export default function CoachHandbookPage() {
    const sections = buildSections();

    return (
        <article className="max-w-3xl mx-auto text-surface-800">
            <header className="mb-8">
                <p className="text-sm font-semibold text-[#CF6D4E] mb-2">CoachLink 教练手册</p>
                <h1 className="text-3xl font-bold text-surface-900 m-0">用学员的进步，证明教练的专业</h1>
                <p className="mt-3 text-base text-surface-600">
                    让好教练被看见，让认真有回报。这份手册说明入驻、开店、带学员、服务规范和收入结算，入驻前请完整读一遍。
                </p>
                <nav className="mt-5 flex flex-wrap gap-2" aria-label="手册目录">
                    {sections.map((section) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="rounded-full border border-surface-300 px-3 py-1 text-sm text-surface-700 no-underline hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
                        >
                            {section.title}
                        </a>
                    ))}
                </nav>
            </header>

            <div className="flex flex-col gap-8">
                {sections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-24">
                        <h2 className="text-xl font-bold text-surface-900 m-0 mb-2">{section.title}</h2>
                        {section.intro && <p className="text-sm text-surface-600 mt-0 mb-3">{section.intro}</p>}
                        <ul className="m-0 p-0 list-none flex flex-col gap-3">
                            {section.items.map((item, index) => (
                                <li key={item.title || index} className="rounded-xl border border-surface-200 bg-white p-4">
                                    {item.title && <p className="font-semibold text-surface-900 m-0 mb-1">{item.title}</p>}
                                    <p className="m-0 text-sm leading-6 text-surface-700">{item.body}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <footer id="group" className="mt-10 rounded-xl bg-surface-100 p-4 text-sm text-surface-600 flex flex-col sm:flex-row gap-4 items-center">
                <img
                    src={COACH_GROUP_QR_PATH}
                    alt="教链教练群二维码"
                    width={160}
                    className="rounded-lg bg-white shrink-0"
                />
                <div>
                    <p className="font-semibold text-surface-900 m-0 mb-1">加入教练群</p>
                    <p className="m-0 leading-6">
                        微信扫码加入教练群，入职培训和政策更新都会在群里同步。
                        二维码有效期至 {COACH_GROUP_QR_VALID_UNTIL}，过期后平台运营也会通过电话或微信邀请你。
                    </p>
                </div>
            </footer>
        </article>
    );
}
