'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

const Chat = () => {
    return (
        <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-900 mb-2">聊天管理</h3>
            <p className="text-600">聊天管理功能开发中...</p>
        </div>
    );
};

export default Chat;