import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function Privacy() {
  return (
    <View className="doc-page privacy-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">隐私政策</Text>
          <Text className="doc-meta">
            {'版本号：1.0\n适用范围：教链 CoachLink 小程序、网站及相关服务\n平台运营主体：智健启能（北京）科技有限公司'}
          </Text>

          <View className="doc-section">
            <Text className="doc-section-title">一、政策说明</Text>
            <Text className="doc-content">教链 CoachLink（以下简称「我们」）重视您的个人信息和隐私保护。本政策说明我们在您浏览、注册、登录、使用训练记录、教练服务、支付订单、内容工具、客服反馈等功能时，如何收集、使用、存储、共享和保护您的个人信息。</Text>
            <Text className="doc-content">在您点击登录、注册、授权手机号、填写资料、提交订单或使用需要登录的功能前，请您先阅读并勾选同意《用户服务协议》和本《隐私政策》。如您不同意本政策，可以选择暂不登录，并继续浏览平台公开内容。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">二、我们收集的信息范围</Text>
            <Text className="doc-content">1. 账号与身份信息：手机号、邮箱、验证码、登录凭证、微信登录产生的 openid、unionid、会话标识，以及您主动设置或授权的昵称、头像。</Text>
            <Text className="doc-content">2. 基础资料与训练资料：性别、年龄段、身高、体重、训练目标、训练水平、训练频率、器械条件、动作记录、训练计划、训练执行记录、训练反馈、力量数据、视频或图片素材等您主动填写、上传或在训练过程中产生的信息。</Text>
            <Text className="doc-content">3. 交易与服务信息：教练浏览、咨询、订阅、订单、支付状态、退款售后、发票或结算所需的必要信息。</Text>
            <Text className="doc-content">4. 沟通与反馈信息：聊天消息、客服反馈、投诉申诉、问卷回答、教练备注及平台处理记录。</Text>
            <Text className="doc-content">5. 设备与安全信息：设备型号、操作系统、网络状态、登录时间、请求日志、异常错误、必要的防刷与风控记录，用于保障账户和交易安全。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">三、收集与使用目的</Text>
            <Text className="doc-content">1. 完成注册、登录、手机号或邮箱验证、账号找回、身份识别和会话维持。</Text>
            <Text className="doc-content">2. 为您生成、同步和展示训练计划、训练记录、训练分析、个人资料卡、动作库、计划历史等核心服务。</Text>
            <Text className="doc-content">3. 在您购买教练服务后，向对应教练提供履约所必需的训练资料、问卷回答、计划执行和反馈信息，以便教练制定计划、跟进反馈和完成服务。</Text>
            <Text className="doc-content">4. 完成订单创建、支付、退款、售后、争议处理、消费者权益保护和平台合规管理。</Text>
            <Text className="doc-content">5. 保障账号、支付、内容和系统安全，识别异常登录、恶意注册、刷接口、欺诈、违规交易或其他安全风险。</Text>
            <Text className="doc-content">6. 在去标识化或匿名化后，用于统计分析、产品优化和服务质量改进。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">四、收集方式</Text>
            <Text className="doc-content">1. 您主动提供：包括填写手机号、邮箱、验证码、个人资料、训练目标、问卷、反馈、上传图片或视频等。</Text>
            <Text className="doc-content">2. 您授权提供：包括通过微信登录获取必要账号标识，通过微信手机号授权获取手机号。我们仅在您主动点击并授权后获取相应信息。</Text>
            <Text className="doc-content">3. 使用服务产生：包括训练执行记录、订单状态、聊天记录、客服反馈、访问日志和安全风控日志。</Text>
            <Text className="doc-content">4. 第三方服务返回：在支付、短信、邮件、对象存储、内容安全、统计分析等必要场景中，相关服务商可能向我们返回处理结果或必要状态信息。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">五、使用、共享与披露范围</Text>
            <Text className="doc-content">1. 我们不会向第三方出售您的个人信息，也不会将您的个人信息用于与 CoachLink 服务无关的场景。</Text>
            <Text className="doc-content">2. 为完成您购买的教练服务，我们会在必要范围内向对应教练展示您的训练目标、问卷、训练计划、执行记录、反馈和沟通信息。教练不得将该等信息用于订单履约以外的用途。</Text>
            <Text className="doc-content">3. 为完成支付、短信、邮件、文件存储、内容安全、客服和系统运维，我们可能向合作服务商提供处理所必需的信息，并要求其按照本政策和法律法规保护您的信息。</Text>
            <Text className="doc-content">4. 根据法律法规、监管要求、司法机关或行政机关的合法要求，我们可能依法提供相关信息。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">六、授权同意与拒绝影响</Text>
            <Text className="doc-content">1. 对于登录、注册、手机号授权等涉及个人信息收集的功能，我们会在页面展示协议和隐私政策入口，并在您勾选同意后再继续收集。</Text>
            <Text className="doc-content">2. 您可以拒绝授权手机号或暂不登录。拒绝后，您仍可浏览公开内容，但训练记录同步、购买教练服务、个人资料保存、消息沟通等需要账号的功能可能无法使用。</Text>
            <Text className="doc-content">3. 您可以通过系统权限设置或平台功能关闭部分授权；关闭后，对应功能可能无法正常使用。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">七、信息保存与安全保护</Text>
            <Text className="doc-content">1. 我们仅在实现本政策所述目的所需期间保存您的个人信息。法律法规另有规定或为处理争议、审计、合规所必需的，从其规定。</Text>
            <Text className="doc-content">2. 我们采用访问控制、传输加密、日志审计、权限隔离、备份恢复等合理技术和管理措施保护您的信息安全。</Text>
            <Text className="doc-content">3. 对于移动端训练缓存，平台默认仅保留必要时间范围内的数据，并以本地缓存提升离线和弱网体验；云端数据与本地缓存不一致时，以云端数据为准。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">八、您的权利</Text>
            <Text className="doc-content">您有权查询、更正、补充、删除您的个人信息，撤回授权，注销账号，或要求我们解释个人信息处理规则。您可以通过「我的」-「设置」「联系/反馈」或本政策列明的联系方式与我们联系。为保障账号安全，我们可能需要先验证您的身份。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">九、未成年人保护</Text>
            <Text className="doc-content">未成年人应在监护人同意和指导下使用本服务。若监护人认为未成年人未经同意向我们提供了个人信息，可联系我们处理。</Text>
          </View>

          <View className="doc-section">
            <Text className="doc-section-title">十、政策更新与联系方式</Text>
            <Text className="doc-content">我们可能根据法律法规、监管要求和业务变化更新本政策。更新后将在小程序、网站或其他合理位置公示；涉及重大变化的，我们会通过合理方式提示您再次阅读。</Text>
            <Text className="doc-content">客服邮箱：majianwen@zjqntech.cn</Text>
            <Text className="doc-content">通讯地址：北京市海淀区东升科技园北街6号院9号楼11层101</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
