'use client';

import { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { useSession } from 'next-auth/react';
import { requestPermissionAndSubscribe, getNotificationPermission, isPushSupported } from '@/lib/swRegistration';
import { useToastContext } from '@/context/ToastContext';

export default function TestPushPage() {
  const { data: session } = useSession();
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('测试通知');
  const [body, setBody] = useState('这是一条测试推送消息');

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const result = await requestPermissionAndSubscribe();
      if (result.ok) {
        showToast({ severity: 'success', summary: '成功', detail: '已开启推送通知' });
      } else {
        showToast({ severity: 'error', summary: '失败', detail: result.reason || '未知错误' });
      }
    } catch (error: any) {
      showToast({ severity: 'error', summary: '错误', detail: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!session?.user?.id) {
      showToast({ severity: 'warn', summary: '提示', detail: '请先登录' });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ title, body });
      const res = await fetch(`/api/push/test?${params}`);
      const data = await res.json();
      
      if (data.success) {
        showToast({ severity: 'success', summary: '成功', detail: data.message });
      } else {
        showToast({ severity: 'error', summary: '失败', detail: data.message });
      }
    } catch (error: any) {
      showToast({ severity: 'error', summary: '错误', detail: error.message });
    } finally {
      setLoading(false);
    }
  };

  const permission = getNotificationPermission();
  const supported = isPushSupported();
  const [swStatus, setSwStatus] = useState<string>('检查中...');
  const [subscriptionInfo, setSubscriptionInfo] = useState<string>('');

  // 检查 Service Worker 状态
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwStatus(`✅ 已注册 (scope: ${reg.scope})`);
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setSubscriptionInfo(`✅ 已订阅 (endpoint: ${sub.endpoint.substring(0, 50)}...)`);
            } else {
              setSubscriptionInfo('❌ 未订阅');
            }
          });
        } else {
          setSwStatus('❌ 未注册');
        }
      });
    } else {
      setSwStatus('❌ 不支持');
    }
  }, []);

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">推送通知测试</h1>

      <div className="space-y-6">
        {/* 状态信息 */}
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">当前状态</h2>
          <ul className="space-y-1 text-sm">
            <li>推送支持: {supported ? '✅ 是' : '❌ 否'}</li>
            <li>Service Worker: {swStatus}</li>
            <li>推送订阅: {subscriptionInfo || '检查中...'}</li>
            <li>通知权限: {
              permission === 'granted' ? '✅ 已授予' :
              permission === 'denied' ? '❌ 已拒绝' :
              '⚠️ 未设置'
            }</li>
            <li>用户ID: {session?.user?.id || '未登录'}</li>
          </ul>
        </div>

        {/* 订阅推送 */}
        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-3">1. 开启推送通知</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            点击下方按钮请求通知权限并订阅推送服务
          </p>
          <Button
            label={permission === 'granted' ? '已订阅' : '开启推送通知'}
            icon="pi pi-bell"
            onClick={handleSubscribe}
            disabled={loading || !supported || permission === 'granted'}
            loading={loading}
          />
        </div>

        {/* 测试推送 */}
        {permission === 'granted' && (
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-3">2. 测试推送</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">标题</label>
                <InputText
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full"
                  placeholder="通知标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">内容</label>
                <InputText
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full"
                  placeholder="通知内容"
                />
              </div>
              <Button
                label="发送测试推送"
                icon="pi pi-send"
                onClick={handleTestPush}
                disabled={loading || !session?.user?.id}
                loading={loading}
              />
              <p className="text-xs text-gray-500">
                提示：如果通知没有显示，请检查浏览器控制台的日志
              </p>
            </div>
          </div>
        )}

        {/* 调试信息 */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h2 className="font-semibold mb-2">调试提示</h2>
          <ul className="text-sm space-y-1">
            <li>1. 打开浏览器开发者工具（F12 或 Cmd+Option+I）</li>
            <li>2. 查看 Console 标签页的日志（以 [SW] 和 [Push] 开头）</li>
            <li>3. 查看 Application → Service Workers 确认 SW 已注册且为激活状态</li>
            <li>4. 查看 Application → Storage → IndexedDB 确认订阅已保存</li>
            <li>5. <strong>Mac Chrome 重要：</strong>确保系统通知权限已开启</li>
            <li className="ml-4">   - 系统设置 → 通知与专注模式 → Chrome → 允许通知</li>
            <li className="ml-4">   - 如果已开启但仍不显示，尝试重启 Chrome</li>
            <li>6. 检查浏览器是否在后台运行（某些浏览器在后台时不会显示通知）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
