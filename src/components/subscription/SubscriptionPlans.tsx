import React from 'react';
import { Check, Star, Zap, Crown } from 'lucide-react';

interface SubscriptionPlansProps {
  currentPlan: string;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ currentPlan }) => {
  const plans = [
    {
      id: 'basic',
      name: '基础版',
      price: 0,
      duration: '永久免费',
      icon: Star,
      color: 'from-gray-400 to-gray-600',
      features: [
        'AI生成基础训练计划',
        '基础健身教程视频',
        '社区问答参与',
        '每日抽奖活动',
        '基础数据统计'
      ],
      limitations: [
        '无教练审核',
        '无视频点评',
        '无优先客服'
      ]
    },
    {
      id: 'advanced',
      name: '进阶版',
      price: 199,
      duration: '月',
      icon: Zap,
      color: 'from-blue-500 to-blue-600',
      popular: true,
      features: [
        '包含基础版所有功能',
        '教练审核AI训练计划',
        '视频动作点评（非即时）',
        '教练在线答疑',
        '个性化营养建议',
        '详细进度分析',
        '优先客服支持'
      ]
    },
    {
      id: 'premium',
      name: '高级版',
      price: 399,
      duration: '月',
      icon: Crown,
      color: 'from-purple-500 to-purple-600',
      features: [
        '包含进阶版所有功能',
        '一对一教练指导',
        '实时视频点评',
        '专属训练计划定制',
        '营养师咨询服务',
        '专属学习群组',
        '线下活动优先权',
        '24小时专属客服'
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {plans.map((plan) => {
        const Icon = plan.icon;
        const isCurrentPlan = currentPlan === plan.id;
        
        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
              plan.popular ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {/* 推荐标签 */}
            {plan.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  推荐
                </div>
              </div>
            )}

            {/* 当前计划标签 */}
            {isCurrentPlan && (
              <div className="absolute top-4 right-4">
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  当前计划
                </div>
              </div>
            )}

            {/* 计划头部 */}
            <div className={`bg-gradient-to-r ${plan.color} p-8 text-white text-center`}>
              <Icon className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-4">
                {plan.price === 0 ? (
                  <div className="text-3xl font-bold">免费</div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold">¥{plan.price}</span>
                    <span className="text-lg opacity-80">/{plan.duration}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 功能列表 */}
            <div className="p-8">
              <div className="space-y-4">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
                
                {plan.limitations && plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start space-x-3 opacity-50">
                    <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                    </div>
                    <span className="text-gray-500 line-through">{limitation}</span>
                  </div>
                ))}
              </div>

              {/* 操作按钮 */}
              <div className="mt-8">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-3 px-6 bg-gray-100 text-gray-500 rounded-xl font-medium cursor-not-allowed"
                  >
                    当前计划
                  </button>
                ) : plan.price === 0 ? (
                  <button className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                    免费使用
                  </button>
                ) : (
                  <button className={`w-full py-3 px-6 bg-gradient-to-r ${plan.color} text-white rounded-xl font-medium hover:shadow-lg transition-all`}>
                    立即升级
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SubscriptionPlans;