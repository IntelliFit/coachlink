import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function Terms() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`doc-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className='doc-scroll'>
        <View className='doc-card'>
          <Text className='doc-meta'>
            {'版本号：1.0\n适用范围：平台用户\n平台运营主体：智健启能（北京）科技有限公司'}
          </Text>

          <View className='doc-section'>
            <Text className='doc-section-title'>一、协议说明</Text>
            <Text className='doc-content'>欢迎使用启能教链平台。为保障您在平台上的注册、浏览、下单、支付、售后及其他相关权益，请您在使用平台服务前仔细阅读并充分理解本协议全部条款。您点击同意、注册、登录、下单或继续使用平台服务的，即视为您已阅读并接受本协议。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>二、定义</Text>
            <Text className='doc-content'>1. 平台：指由平台运营主体运营的启能教链小程序、网站、后台系统及其相关技术服务。</Text>
            <Text className='doc-content'>2. 用户：指注册、登录、浏览、下单、购买或使用平台服务的自然人消费者。</Text>
            <Text className='doc-content'>3. 入驻教练：指经平台审核后入驻平台，并通过平台向用户提供具体教练服务的个人或经营者。</Text>
            <Text className='doc-content'>4. 平台服务：指平台提供的信息展示、搜索匹配、交易撮合、支付代收、订单管理、客服受理、售后协调、内容工具、数据记录等服务。</Text>
            <Text className='doc-content'>5. 教练服务：指由入驻教练向用户提供的训练指导、课程咨询、训练计划、反馈答疑、图文或视频教学等具体服务。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>三、平台定位与服务边界</Text>
            <Text className='doc-content'>1. 平台是连接用户与入驻教练的在线服务平台，向用户提供教练信息展示、交易系统、支付能力、订单管理、售后协调及其他平台功能。</Text>
            <Text className='doc-content'>2. 平台上的教练服务由相应入驻教练独立提供，教练系该等具体服务的实际履约主体，应对其服务内容、服务质量、宣传信息、履约结果和合法合规性承担责任。</Text>
            <Text className='doc-content'>3. 平台可根据业务规则直接提供部分平台自营内容、标准化功能服务、会员权益或配套工具服务；该等服务的责任以订单页面、服务说明或平台公告载明内容为准。</Text>
            <Text className='doc-content'>4. 平台会对教练身份、基础资料、投诉记录及经营行为进行审核和管理，但该等审核不构成对教练服务效果的绝对保证。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>四、用户注册与账户使用</Text>
            <Text className='doc-content'>1. 您应当具备与您使用平台服务相适应的民事行为能力。未成年人应在监护人同意和指导下使用。</Text>
            <Text className='doc-content'>2. 您应提供真实、准确、完整、有效的注册信息，并在信息发生变化时及时更新。</Text>
            <Text className='doc-content'>3. 您应妥善保管账号、密码、验证码及登录凭证，对您账户下发生的操作承担相应责任。</Text>
            <Text className='doc-content'>4. 如您发现账户异常、被盗用或其他安全风险，应及时通知平台。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>五、下单与交易规则</Text>
            <Text className='doc-content'>1. 用户可在平台浏览教练资料、服务内容、价格说明、履约周期、适用人群及退款规则后自主决定是否下单。</Text>
            <Text className='doc-content'>2. 用户提交订单并完成支付后，订单成立；法律法规另有规定或页面另有说明的，从其规定。</Text>
            <Text className='doc-content'>3. 用户应认真阅读订单页面展示的服务说明、限制条件、履约安排和退款政策。因用户未充分阅读相关规则导致的误解或争议，平台将依据页面展示和沟通记录进行判断。</Text>
            <Text className='doc-content'>4. 用户不得恶意下单、重复下单、虚假投诉、恶意退款、套现或实施其他扰乱平台交易秩序的行为。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>六、支付与分账说明</Text>
            <Text className='doc-content'>1. 用户购买平台内教练服务时，订单款项由平台通过合法支付渠道统一代收。</Text>
            <Text className='doc-content'>2. 平台在收到用户支付后，将依据平台规则、订单履约状态及退款情况，向相应教练进行分账或结算。</Text>
            <Text className='doc-content'>3. 用户理解并同意，平台代收款项不改变具体教练服务由入驻教练实际履约的性质。</Text>
            <Text className='doc-content'>4. 平台可根据法律法规、监管要求及业务发展，调整支付渠道、结算周期和支付展示方式，并通过页面、公告或规则说明告知用户。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>七、退款与售后规则</Text>
            <Text className='doc-content'>1. 用户如因误购、重复支付、服务未开始、服务与页面说明明显不符、教练未履约、存在重大质量问题或其他依法应退款的情形，可依据平台页面规则提交退款申请。</Text>
            <Text className='doc-content'>2. 平台收到退款申请后，有权结合以下因素审核处理：订单付款时间与退款申请时间；教练服务是否已开始履约；已交付内容、已使用权益或已消耗服务比例；教练与用户之间的沟通记录、服务记录及其他证据材料；适用法律法规及平台规则。</Text>
            <Text className='doc-content'>3. 对于未开始履约或符合页面载明无理由退款条件的订单，平台可支持全额退款。</Text>
            <Text className='doc-content'>4. 对于已经部分履约的订单，平台可根据实际履约情况决定部分退款或不予退款。</Text>
            <Text className='doc-content'>5. 用户提交退款申请后，应配合平台提供必要说明和证据；如用户提交虚假材料、恶意投诉或滥用退款权利，平台有权拒绝相关申请并追究相应责任。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>八、投诉与争议处理</Text>
            <Text className='doc-content'>1. 用户如对订单、支付、退款、履约、宣传信息或账户处理结果有异议，可通过平台客服渠道发起投诉或申诉。</Text>
            <Text className='doc-content'>2. 平台将受理用户投诉，并视情况要求教练提交说明、补充材料或整改方案。</Text>
            <Text className='doc-content'>3. 对于涉及教练具体履约责任的争议，平台将在自身承诺的审核、交易保障、客服协调范围内协助处理，但除法律另有规定外，不替代教练承担其本应承担的全部具体履约责任。</Text>
            <Text className='doc-content'>4. 为保障消费者合法权益和平台秩序，平台在必要情况下可根据规则先行垫付、赔付或退款，后续再向责任教练追偿。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>九、用户行为规范</Text>
            <Text className='doc-content'>1. 您应如实填写个人基础资料、健康情况、训练目标及其他与服务相关的信息。</Text>
            <Text className='doc-content'>2. 您在参与训练前应根据自身身体状况审慎判断，如存在基础疾病、受伤史、特殊体质或其他不适宜训练情形，应先咨询医生或相关专业人士。</Text>
            <Text className='doc-content'>3. 您不得利用平台从事违法违规活动，不得辱骂、骚扰、威胁其他用户或教练，不得传播违法、有害、侮辱、侵权信息。</Text>
            <Text className='doc-content'>4. 您不得擅自复制、传播、转售教练提供的训练计划、课程内容、图片、视频或其他受知识产权保护的内容。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十、平台的管理权与处理措施</Text>
            <Text className='doc-content'>1. 如用户存在违法违规、虚假投诉、恶意退款、规避平台交易、侵犯他人权益或其他违反平台规则的行为，平台有权根据情节采取警告、限制功能、暂停服务、取消订单、冻结账户、拒绝退款申请等措施。</Text>
            <Text className='doc-content'>2. 用户对平台处理结果有异议的，可通过平台申诉渠道提交复核申请。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十一、风险提示</Text>
            <Text className='doc-content'>1. 健身训练、运动指导及相关计划具有一定身体风险。用户应结合自身情况审慎参加相关训练。</Text>
            <Text className='doc-content'>2. 平台会对教练进行基本资质审核和经营管理，但无法替代用户对教练专业匹配度、服务风格和个体效果的自主判断。</Text>
            <Text className='doc-content'>3. 平台提供的训练记录、数据分析、内容工具及建议性信息，不构成医疗诊断或治疗意见。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十二、隐私与信息保护</Text>
            <Text className='doc-content'>1. 平台将按照法律法规及《隐私政策》收集、使用、存储和保护您的个人信息。</Text>
            <Text className='doc-content'>2. 平台将采取合理安全措施保护用户信息安全；用户也应妥善保管自己的账户与设备。</Text>
            <Text className='doc-content'>3. 为完成订单履约、售后处理、争议核查和合规管理，平台可在必要范围内向相关教练、支付机构、技术服务商或监管机关提供必要信息。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十三、责任说明</Text>
            <Text className='doc-content'>1. 平台将按照法律法规以及本协议约定，在其承诺的审核、交易系统、支付代收、客服受理、售后协调和信息安全保护范围内承担相应责任。</Text>
            <Text className='doc-content'>2. 对于由教练独立提供的具体教练服务，教练应对其服务内容、履约质量和服务结果承担相应责任。</Text>
            <Text className='doc-content'>3. 因用户故意或重大过失、不可抗力、第三方系统故障、监管要求等造成的平台服务中断或损失，平台将在法律允许范围内承担相应责任。</Text>
            <Text className='doc-content'>4. 如法律法规对平台责任另有强制性规定的，从其规定。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十四、协议变更、终止与争议解决</Text>
            <Text className='doc-content'>1. 平台有权根据法律法规、监管要求及业务变化对本协议进行更新，并通过页面公示、站内通知或其他合理方式告知用户。</Text>
            <Text className='doc-content'>2. 如您不同意更新后的协议，可停止使用平台服务；您继续使用平台服务的，视为接受更新后的协议。</Text>
            <Text className='doc-content'>3. 本协议的订立、效力、解释、履行及争议解决适用中华人民共和国法律。</Text>
            <Text className='doc-content'>4. 因本协议引起的争议，双方应先友好协商；协商不成的，任一方可向平台运营主体所在地有管辖权的人民法院提起诉讼。</Text>
          </View>

          <View className='doc-section'>
            <Text className='doc-section-title'>十五、联系方式</Text>
            <Text className='doc-content'>客服邮箱：majianwen@zjqntech.cn</Text>
            <Text className='doc-content'>通讯地址：北京市海淀区东升科技园北街6号院9号楼11层101</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
