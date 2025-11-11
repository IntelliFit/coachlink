'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';

const Chat = () => {
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // 模拟加载数据
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <div>
            {loading ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <Skeleton width="10rem" height="2rem" />
                        <Skeleton width="6rem" height="2rem" />
                    </div>
                    
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((index) => (
                            <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                                <Skeleton shape="circle" size="3rem" />
                                <div className="flex-1">
                                    <Skeleton width="8rem" height="1rem" className="mb-2" />
                                    <Skeleton width="12rem" height="0.75rem" />
                                </div>
                                <Skeleton width="3rem" height="0.75rem" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-900 mb-2">聊天管理</h3>
                    <p className="text-600">聊天管理功能开发中...</p>
                </div>
            )}
        </div>
    );
};

export default Chat;