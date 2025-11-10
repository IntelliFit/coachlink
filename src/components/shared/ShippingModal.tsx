import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  Phone, 
  MapPin, 
  User, 
  Gift, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ShippingInfo {
  recipientName: string;
  phone: string;
  address: string;
  notes?: string;
}

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prize: any;
  userPhone: string; // 用户登录时的手机号
  onSubmit: (shippingInfo: ShippingInfo) => void;
}

const ShippingModal: React.FC<ShippingModalProps> = ({ 
  isOpen, 
  onClose, 
  prize, 
  userPhone, 
  onSubmit 
}) => {
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    recipientName: '',
    phone: userPhone || '', // 默认填入用户的手机号
    address: '',
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // 验证手机号格式
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 验证必填字段
    if (!shippingInfo.recipientName.trim()) {
      setMessage({ type: 'error', text: '请输入收件人姓名' });
      return;
    }

    if (!shippingInfo.phone.trim()) {
      setMessage({ type: 'error', text: '请输入手机号' });
      return;
    }

    if (!validatePhone(shippingInfo.phone)) {
      setMessage({ type: 'error', text: '手机号格式不正确' });
      return;
    }

    // 重要：验证手机号与登录手机号是否一致
    if (shippingInfo.phone !== userPhone) {
      setMessage({ 
        type: 'error', 
        text: '快递手机号必须与登录手机号一致' 
      });
      return;
    }

    if (!shippingInfo.address.trim()) {
      setMessage({ type: 'error', text: '请输入详细地址' });
      return;
    }

    if (shippingInfo.address.length < 10) {
      setMessage({ type: 'error', text: '地址信息过于简单，请填写详细地址' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(shippingInfo);
      setMessage({ type: 'success', text: '快递信息提交成功！' });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: '提交失败，请稍后重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 获取奖品名称
  const getPrizeName = (level: number) => {
    switch(level) {
      case 1: return '蛋白粉';
      case 2: return '肌酸';
      case 3: return '弹力带';
      default: return '奖品';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* 标题栏 */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gift className="w-6 h-6" />
              <h2 className="text-xl font-bold">填写快递信息</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 中奖信息 */}
        <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">恭喜您中奖！</h3>
              <p className="text-sm text-gray-600">
                奖品：{getPrizeName(prize?.level)} 
                <span className="ml-2 text-green-600">🎉</span>
              </p>
            </div>
          </div>
        </div>

        {/* 表单内容 */}
        <div className="p-6">
          {/* 消息提示 */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* 安全提示 */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                为防止恶意使用，快递手机号必须与登录手机号一致
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 收件人姓名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                收件人姓名 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={shippingInfo.recipientName}
                  onChange={(e) => setShippingInfo(prev => ({ ...prev, recipientName: e.target.value }))}
                  placeholder="请输入收件人姓名"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  maxLength={20}
                />
              </div>
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                手机号 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={shippingInfo.phone}
                  onChange={(e) => setShippingInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="请输入手机号"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  maxLength={11}
                />
              </div>
              {shippingInfo.phone && shippingInfo.phone !== userPhone && (
                <div className="mt-1 text-sm text-red-600">
                  ⚠️ 手机号与登录手机号不一致
                </div>
              )}
            </div>

            {/* 详细地址 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                详细地址 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  value={shippingInfo.address}
                  onChange={(e) => setShippingInfo(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="请输入详细地址，包括省市区街道门牌号等"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                  rows={3}
                  maxLength={200}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {shippingInfo.address.length}/200 字符
              </div>
            </div>

            {/* 备注 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                备注信息
              </label>
              <input
                type="text"
                value={shippingInfo.notes}
                onChange={(e) => setShippingInfo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="特殊要求或备注（可选）"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                maxLength={50}
              />
            </div>

            {/* 提交按钮 */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>提交中...</span>
                  </div>
                ) : (
                  '确认提交'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShippingModal; 