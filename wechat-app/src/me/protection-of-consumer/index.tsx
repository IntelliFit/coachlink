import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function ProtectionOfConsumer() {
  return (
    <View className='doc-page'>
      <ScrollView scrollY className='doc-scroll'>
        <View className='doc-card'>
          <Text className='doc-title'>启能教链平台消费者权益保障说明</Text>
          <Text className='doc-meta'>
            {'适用业务：启能教链平台教练入驻与分账业务\n平台运营主体：智健启能（北京）科技有限公司\n版本号：1.0'}
          </Text>

          <View className='doc-section'>
            <Text className='doc-section-title'>一、说明目的</Text>
            <Text className='doc-content'>为保障用户在启能教链平台购买教练服务过程中的知情权、选择权、公平交易权、售后保障权及个人信息安全，平台建立覆盖商户审核、订单管理、支付代收、售后退款、争议处理和违规处置的消费者权益保障机制。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>二、平台业务模式说明</Text>
            <Text className='doc-content'>1. 平台为入驻教练和用户提供信息展示、交易撮合、支付代收、订单管理、客服受理、售后协调和技术支持服务。</Text>
            <Text className='doc-content'>2. 入驻教练为具体教练服务的实际提供方，对其发布的服务内容、履约质量和合法合规性承担直接责任。</Text>
            <Text className='doc-content'>3. 用户购买教练服务时，订单款项由平台统一代收；平台根据订单履约和平台规则向教练进行分账或结算。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>三、入驻审核与风险控制机制</Text>
            <Text className='doc-content'>1. 平台对入驻教练实行审核准入机制，要求提交真实身份信息、资质材料、联系方式和结算信息。</Text>
            <Text className='doc-content'>2. 对资料不完整、信息不一致、存在历史投诉风险或明显不符合平台准入条件的申请，平台有权拒绝入驻或要求补充说明。</Text>
            <Text className='doc-content'>3. 平台持续监控教练的订单履约、投诉率、退款率、宣传内容及异常交易情况，对高风险教练采取重点核查和限制措施。</Text>
            <Text className='doc-content'>4. 平台禁止教练虚假宣传、夸大效果、诱导线下交易、私下收款、侵犯用户权益或发布违法违规内容。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>四、交易信息披露机制</Text>
            <Text className='doc-content'>1. 平台要求教练在商品或服务页面明确展示服务内容、收费标准、履约周期、适用对象、退款规则和注意事项。</Text>
            <Text className='doc-content'>2. 平台在订单页面明确展示订单金额、支付方式、支付状态、服务说明、售后入口等关键信息，保障用户知情权。</Text>
            <Text className='doc-content'>3. 平台对涉及健康、训练风险、特殊限制条件的服务，要求在页面显著位置进行风险提示。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>五、支付与资金安全保障</Text>
            <Text className='doc-content'>1. 用户交易通过合法合规的支付渠道完成，平台统一代收订单款项，并根据规则进行分账结算。</Text>
            <Text className='doc-content'>2. 平台依据订单履约状态、退款窗口、投诉争议情况及风控规则管理可结算资金，避免在争议未解决前直接将相关款项全部划转。</Text>
            <Text className='doc-content'>3. 对于异常支付、疑似欺诈、重复支付、恶意退款、投诉未决等订单，平台有权暂缓结算、冻结相关款项或启动人工复核。</Text>
            <Text className='doc-content'>4. 平台建立订单、支付、退款、结算的记录留存机制，便于后续核查、对账和争议处理。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>六、售后受理与客服机制</Text>
            <Text className='doc-content'>1. 平台为用户提供统一售后入口和客服渠道，受理订单咨询、退款申请、投诉举报、账户问题及其他消费者权益相关事项。</Text>
            <Text className='doc-content'>客服邮箱：2945463110@qq.com</Text>
            <Text className='doc-content'>客服热线：18115072586（工作日 14:00–24:00）</Text>
            <Text className='doc-content'>2. 平台在收到用户售后申请后，将在合理期限内完成登记、初审和流转，并根据问题类型协调教练或平台相关人员处理。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>七、退款处理机制</Text>
            <Text className='doc-content'>1. 用户可就误购、重复支付、服务未开始、服务与页面说明严重不符、教练未履约、服务存在重大质量问题或其他依法应退款情形向平台申请退款。</Text>
            <Text className='doc-content'>2. 对符合退款条件且未开始履约的订单，平台可支持全额退款。</Text>
            <Text className='doc-content'>3. 对已部分履约的订单，平台可按实际履约情况支持部分退款。</Text>
            <Text className='doc-content'>4. 对不符合退款条件、存在虚假申请或恶意滥用退款权利的情形，平台有权拒绝退款申请。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>八、争议处理与先行保障机制</Text>
            <Text className='doc-content'>1. 用户与教练就服务内容、履约质量、退款金额等发生争议时，可通过平台发起投诉或申诉。</Text>
            <Text className='doc-content'>2. 平台将基于页面展示、订单记录、聊天记录、服务交付情况、证据材料等进行协调和判断。</Text>
            <Text className='doc-content'>3. 平台在必要情况下可要求教练限期整改、补充履约、说明情况、承担退款责任或接受平台处理结果。</Text>
            <Text className='doc-content'>4. 为维护消费者合法权益，平台建立先行保障机制：在平台认定用户主张具有合理依据且有必要及时处理的情况下，平台可先行向用户退款、垫付或赔付，后续再向责任教练追偿。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>九、平台兜底赔付标准</Text>
            <Text className='doc-content'>全额退款保障（7个工作日内完成）：教练主动取消或无故停止服务；因平台技术故障导致的异常扣款；教练账号因违规被强制下架且有未履约周期；服务内容与页面描述存在根本性不符。</Text>
            <Text className='doc-content'>教练未履约（服务零交付）：兜底赔付用户实付金额100%。</Text>
            <Text className='doc-content'>教练部分履约（服务明显缩水）：兜底赔付未履约比例对应金额100%。</Text>
            <Text className='doc-content'>教练发布虚假宣传诱导消费：用户实付金额100%加10%惩罚性赔付，单笔上限500元。</Text>
            <Text className='doc-content'>因平台系统故障、数据泄露等平台责任造成的资金损失：按实际损失金额100%赔付，无上限。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十、协助追偿责任</Text>
            <Text className='doc-content'>1. 平台留存用户与教练的订单记录、支付凭证、聊天记录、服务交付记录、退款记录，保存期限不少于1年。</Text>
            <Text className='doc-content'>2. 用户在维权期间可向平台申请调取上述证据材料，平台在5个工作日内提供经平台核实的书面或电子版证明材料。</Text>
            <Text className='doc-content'>3. 平台在向用户先行赔付后，向责任教练行使追偿权，包括冻结并扣划钱包余额、延迟结算、扣除保证金等措施。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十一、违规教练处置机制</Text>
            <Text className='doc-content'>对存在虚假身份或资质信息、虚假宣传夸大效果、未按约履约、诱导线下交易私下收款、侵犯用户隐私、涉嫌欺诈套现等情形的教练，平台将视情节采取警告、下架服务、限制接单、延迟结算、冻结款项、终止合作、向监管部门报送相关线索等措施。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十二、个人信息与证据保护</Text>
            <Text className='doc-content'>1. 平台在收集、使用、存储和保护用户个人信息时，将遵循合法、正当、必要原则，并按照隐私政策进行管理。</Text>
            <Text className='doc-content'>2. 平台对订单记录、支付记录、退款记录、投诉处理记录和相关证据材料进行留存，以便消费者维权和监管核查。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十三、持续优化机制</Text>
            <Text className='doc-content'>平台将根据业务发展、用户反馈、投诉数据和监管要求，持续优化审核规则、退款规则、争议处理流程和风控模型，定期复盘高投诉、高退款或高风险场景，更新平台规则并加强教练侧合规培训。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十四、补充说明</Text>
            <Text className='doc-content'>本说明为平台消费者权益保障制度的概括性文件，与平台用户协议、商户入驻平台协议、隐私政策、订单页面规则及平台公告共同构成平台消费者保护体系。如法律法规或监管要求对消费者权益保障另有强制性规定的，平台将按规定执行。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
