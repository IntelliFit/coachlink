import React from 'react';

interface AeroPaymentSkeletonProps {
    className?: string;
}

const PaymentSkeleton: React.FC<AeroPaymentSkeletonProps> = ({ className = "" }) => {
    return (
        <div className={`w-full space-y-8 animate-pulse ${className}`}>
            
            {/* 1. 支付方式选项卡：模拟 3 个支付入口 */}
            <div className="flex gap-4">
                {[1, 2, 3].map((i) => (
                    <div 
                        key={i} 
                        className="flex-1 h-24 rounded-2xl bg-surface-100/50 dark:bg-surface-800/50 border border-surface-200/20 flex flex-col items-center justify-center gap-2"
                    >
                        <div className="w-8 h-8 rounded-xl bg-surface-200 dark:bg-surface-700"></div>
                        <div className="w-10 h-2.5 rounded-full bg-surface-200 dark:bg-surface-700"></div>
                    </div>
                ))}
            </div>

            {/* 2. 内容区容器：模拟表单或二维码区域 */}
            <div className="space-y-6 pt-2">
                
                {/* 顶部状态/标题模拟 */}
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-20 h-20 rounded-2xl bg-surface-100 dark:bg-surface-800"></div>
                    <div className="w-32 h-6 rounded-full bg-surface-100 dark:bg-surface-800"></div>
                    <div className="w-48 h-3 rounded-full bg-surface-50 dark:bg-surface-900 opacity-60"></div>
                </div>

                {/* 3. 输入项预占位：1:1 结构模拟 (规范 5) */}
                <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col gap-3 px-1">
                            {/* Label 骨架 */}
                            <div className="w-20 h-3 rounded-full bg-surface-200/60 dark:bg-surface-700/60 ml-1 tracking-widest"></div>
                            {/* Input 骨架：保持 rounded-2xl */}
                            <div className="w-full h-12 rounded-2xl bg-surface-50/50 dark:bg-surface-900/50 border border-surface-100 dark:border-surface-800"></div>
                        </div>
                    ))}
                </div>

                {/* 4. 底部辅助信息/按钮预留 */}
                <div className="space-y-4 pt-4">
                    <div className="w-full h-10 rounded-2xl bg-surface-50 dark:bg-surface-900 border border-dashed border-surface-200 dark:border-surface-700 opacity-50"></div>
                    <div className="w-40 h-3 mx-auto rounded-full bg-surface-100 dark:bg-surface-800"></div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSkeleton;