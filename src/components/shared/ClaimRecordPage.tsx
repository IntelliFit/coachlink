import React, { useState } from 'react';
// [修正导入]
import pullupLeaderboardService from '../services/pullupLeaderboardService';

interface ClaimRecordPageProps {
    onNavigate?: (view: string) => void;
}

const ClaimRecordPage: React.FC<ClaimRecordPageProps> = ({ onNavigate }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleClaim = async () => {
        if (!code) {
            setError('请输入认领码');
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // [修正调用]
            await pullupLeaderboardService.claimRecordByCode(code.toUpperCase());
            setSuccess(true);
            setCode('');
        } catch (err: any) {
            const errorMessage = err.message || '认领失败，请重试。';
            setError(errorMessage);
            
            // [修改] 简化错误处理 - 只在明确是认证错误时才跳转
            if (errorMessage.includes('登录状态已过期') || errorMessage.includes('重新登录')) {
                console.log('Authentication error detected, showing error message instead of redirecting...');
                // 不立即跳转，而是显示错误信息让用户自己决定
                setError('认证失败，请重新登录后重试。如果问题持续存在，请联系客服。');
            }
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center mb-4">认领我的历史成绩</h2>
            <p className="text-center text-gray-600 mb-6">
                请输入您通过抖音私信收到的专属认领码，将您的历史战绩绑定到当前账户。
            </p>

            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
            {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">恭喜！您的历史成绩已成功绑定！</div>}

            <div className="flex flex-col space-y-4">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="输入8位认领码"
                    className="p-3 border rounded-md text-center uppercase"
                />
                <button
                    onClick={handleClaim}
                    disabled={loading}
                    className="bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? '正在认领...' : '立即认领'}
                </button>
            </div>
        </div>
    );
};

export default ClaimRecordPage;