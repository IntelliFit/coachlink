import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformAgreement() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`doc-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className='doc-scroll'>
        <View className='doc-card'>
          <Text className='doc-meta'>
            {'版本号：1.0\n适用主体：入驻教练/服务提供方\n签署主体甲方：智健启能（北京）科技有限公司\n签署主体乙方：入驻教练/服务提供方'}
          </Text>

          <View className='doc-section'>
            <Text className='doc-section-title'>第一条 协议目的</Text>
            <Text className='doc-content'>为规范启能教链平台内教练入驻、服务发布、订单履约、资金结算及售后处理等合作事项，明确平台与教练之间的权利义务，甲乙双方根据《中华人民共和国民法典》《中华人民共和国电子商务法》及其他相关法律法规，订立本协议。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第二条 定义</Text>
            <Text className='doc-content'>1. 平台：指由甲方运营的启能教链平台，包括小程序、网站、管理后台及相关技术服务系统。</Text>
            <Text className='doc-content'>2. 教练服务：指乙方通过平台向用户提供的训练指导、课程咨询、训练计划、动作反馈、图文或视频教学等具体服务。</Text>
            <Text className='doc-content'>3. 平台服务：指甲方向乙方及用户提供的信息展示、交易系统、支付代收、订单管理、客服受理、售后协调、规则管理、技术支持等服务。</Text>
            <Text className='doc-content'>4. 用户：指在平台浏览、购买或使用乙方教练服务的自然人消费者。</Text>
            <Text className='doc-content'>5. 订单款项：指用户基于平台订单支付的全部费用，包括教练服务费及甲方依据规则收取的平台服务费、技术服务费等。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第三条 入驻与资质</Text>
            <Text className='doc-content'>1. 乙方应当具有完全民事行为能力，并具备提供相关教练服务所需的真实身份信息、专业能力和相应资质。</Text>
            <Text className='doc-content'>2. 乙方申请入驻时，应按照甲方要求提交身份证明、职业资质、联系方式、收款信息及其他必要材料，并保证其真实、准确、完整、有效。</Text>
            <Text className='doc-content'>3. 甲方有权对乙方提交的信息和资质材料进行审核，并有权要求乙方补充、更新或重新提交相关证明材料。</Text>
            <Text className='doc-content'>4. 如乙方提交虚假材料、冒用他人身份、隐瞒重大不利信息，甲方有权拒绝入驻、暂停合作、冻结待结算款项并依法追究责任。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第四条 平台与教练的角色关系</Text>
            <Text className='doc-content'>1. 甲方为平台服务提供方，负责搭建和运营交易场景、订单系统、支付代收及规则治理体系。</Text>
            <Text className='doc-content'>2. 乙方为教练服务的实际提供方，应独立完成服务履约，并对服务内容、服务质量、宣传信息、交付结果、合法合规性承担直接责任。</Text>
            <Text className='doc-content'>3. 甲方可以基于平台规则对乙方的服务展示、收费结构、履约记录、售后处理、投诉争议等进行管理，但该等管理不视为甲方替代乙方成为具体教练服务的实际履约主体。</Text>
            <Text className='doc-content'>4. 如甲方自营提供某些平台服务或标准化内容功能，该部分内容由甲方按页面展示和订单说明承担相应责任；乙方提供的教练服务仍由乙方独立承担责任。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第五条 服务发布与履约要求</Text>
            <Text className='doc-content'>1. 乙方发布的服务内容、宣传文案、价格说明、适用人群、限制条件、服务周期、退款条件等，应当真实、清晰、完整，不得存在虚假宣传、夸大承诺、隐瞒限制、误导交易等情形。</Text>
            <Text className='doc-content'>2. 乙方应按照订单约定和平台规则向用户提供教练服务，不得无故拒单、拖延履约、中途失联、擅自缩减服务内容或诱导用户脱离平台交易。</Text>
            <Text className='doc-content'>3. 乙方应重视用户健康和安全，不得向明显不适合训练的用户提供超出安全边界的指导，不得发布违法、危险或明显违背常识的训练内容。</Text>
            <Text className='doc-content'>4. 乙方应依法保护用户个人信息、训练数据及其他隐私信息，未经用户授权不得向任何第三方披露、出售或用于与订单无关的用途。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第六条 交易与分账规则</Text>
            <Text className='doc-content'>1. 用户就乙方教练服务所支付的订单款项，由甲方通过平台交易系统统一代收。</Text>
            <Text className='doc-content'>2. 甲方在扣除平台服务费、技术服务费及其他依据平台规则约定应由乙方承担的费用后，按照约定结算周期和结算规则向乙方分账或结算应付金额。</Text>
            <Text className='doc-content'>3. 乙方同意甲方根据业务运营需要，采用微信支付分账或其他合法合规的支付结算方式完成资金划转。</Text>
            <Text className='doc-content'>4. 如订单发生退款、部分退款、拒付、异常支付、投诉冻结、风控拦截、违规处罚或监管要求的资金调整，甲方有权对乙方未结算款项作相应扣减、暂缓结算或追偿处理。</Text>
            <Text className='doc-content'>5. 乙方不得以任何方式绕开平台收款，不得诱导用户线下支付，不得要求用户向乙方个人账户或其他非平台指定路径付款；经甲方书面同意的特殊场景除外。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第七条 结算周期与税务</Text>
            <Text className='doc-content'>1. 甲方可按照T+7、T+15或平台公告载明的其他周期进行结算，具体以平台届时公布并经乙方确认的规则为准。</Text>
            <Text className='doc-content'>2. 甲方有权结合订单完成情况、退款窗口、投诉争议状态、风控审查结果等决定某笔款项是否达到可结算状态。</Text>
            <Text className='doc-content'>3. 乙方应确保提供真实、有效、可正常收款的结算账户信息；因乙方账户信息错误、失效或受限导致结算失败、延迟或额外成本，由乙方自行承担。</Text>
            <Text className='doc-content'>4. 乙方因平台合作获得的收入涉及的税费，由乙方依法自行申报并承担；法律法规要求甲方代扣代缴或报送信息的，乙方应予以配合。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第八条 售后、退款与争议处理</Text>
            <Text className='doc-content'>1. 用户提出退款、投诉或争议时，乙方应积极配合甲方在合理期限内完成核实、说明和处理。</Text>
            <Text className='doc-content'>2. 对于未开始履约、误购、重复支付、未达成主要服务内容、乙方违约、乙方存在虚假宣传或其他依法应退款的情形，甲方有权依据平台规则支持用户退款。</Text>
            <Text className='doc-content'>3. 对于已经部分履约的订单，甲方可结合实际履约比例、已消耗权益、沟通记录、证据材料等综合判定是否部分退款及退款金额。</Text>
            <Text className='doc-content'>4. 因乙方原因导致用户退款、投诉赔付、监管处罚或甲方向用户先行垫付、赔付的，甲方有权从乙方待结算款项中直接扣回，不足部分有权继续向乙方追偿。</Text>
            <Text className='doc-content'>5. 乙方理解并同意，甲方为维护消费者合法权益和平台秩序，在必要情况下可先行向用户进行垫付、赔付或补偿。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第九条 平台管理与违规处理</Text>
            <Text className='doc-content'>如乙方存在下列任一情形，甲方有权视情节采取警告、限制功能、下架服务、暂停接单、延迟结算、冻结资金、终止合作、向监管部门报告等措施：提供虚假身份信息、资质证明或收款信息；发布虚假宣传、夸大效果、误导性定价或违法违规内容；拒不履约、服务质量严重不达标或造成用户重大投诉；诱导用户线下交易、私下收款或规避平台规则；侵犯用户隐私、知识产权或其他合法权益；涉及欺诈、洗钱、套现、异常交易、恶意退款等风险行为；其他违反法律法规、平台规则或本协议约定的行为。</Text>
            <Text className='doc-content'>乙方对处理结果有异议的，可按平台申诉渠道提交申诉材料；甲方将在合理期限内复核。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第十条 知识产权与数据使用</Text>
            <Text className='doc-content'>1. 乙方保证其在平台发布的课程说明、文章、图片、视频及其他内容不侵犯第三方合法权益。</Text>
            <Text className='doc-content'>2. 为实现平台展示、交易管理、售后处理、证据留存和宣传推广之目的，乙方授予甲方在平台运营范围内使用相关服务信息和展示素材的非独占许可。</Text>
            <Text className='doc-content'>3. 未经甲方书面同意，乙方不得擅自使用平台名称、商标、标识、系统页面、规则文档或平台数据从事超出合作范围的活动。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第十一条 协议期限与终止</Text>
            <Text className='doc-content'>1. 本协议自乙方在线勾选同意或签署之日起生效，有效期至双方合作终止之日止。</Text>
            <Text className='doc-content'>2. 如乙方主动申请退出平台，应先妥善处理未完成订单、未结投诉和待退款事项。</Text>
            <Text className='doc-content'>3. 因乙方违约、违法或存在重大经营风险，甲方有权单方终止本协议并采取必要的账户及资金处置措施。</Text>
            <Text className='doc-content'>4. 协议终止后，已发生但尚未履行完毕的退款、赔付、结算、保密、争议解决等条款继续有效。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第十二条 违约责任</Text>
            <Text className='doc-content'>1. 任一方违反本协议约定，给对方或用户造成损失的，应依法承担相应赔偿责任。</Text>
            <Text className='doc-content'>2. 因乙方原因导致甲方遭受用户索赔、行政处罚、司法追责、第三方追偿或商誉损失的，乙方应赔偿甲方因此遭受的全部损失，包括但不限于赔付款、行政罚款、律师费、诉讼费、保全费和合理维权支出。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第十三条 法律适用与争议解决</Text>
            <Text className='doc-content'>1. 本协议的订立、生效、履行、解释及争议解决，适用中华人民共和国法律。</Text>
            <Text className='doc-content'>2. 因本协议引起的任何争议，双方应首先友好协商解决；协商不成的，任一方可向甲方所在地有管辖权的人民法院提起诉讼。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>第十四条 其他</Text>
            <Text className='doc-content'>1. 甲方有权根据监管要求、业务模式和平台规则更新本协议内容，并通过合理方式向乙方通知。</Text>
            <Text className='doc-content'>2. 本协议未尽事宜，双方可通过补充协议、平台规则、公告或订单说明进行约定；补充内容与本协议具有同等法律效力。</Text>
            <Text className='doc-content'>3. 如本协议任一条款被认定无效或不可执行，不影响其他条款的效力。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
