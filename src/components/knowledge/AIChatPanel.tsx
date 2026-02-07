'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  relatedNodes?: Array<{ id: string; title: string; description: string | null }>;
};

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIChatPanel({ isOpen, onClose }: AIChatPanelProps) {
  const router = useRouter();
  const STORAGE_KEY = 'coachlink_ai_chat_history';
  const EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize chat from storage or default
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { messages: savedMessages, timestamp } = JSON.parse(saved);
        // Check expiration
        if (Date.now() - timestamp < EXPIRATION_TIME) {
          setMessages(savedMessages);
          return;
        }
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    // Default welcome message
    resetChat();
  }, []);

  // Save to storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages,
        timestamp: Date.now()
      }));
    }
  }, [messages]);

  const resetChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: '你好！我是知识库AI助手 🤖\n\n你可以问我关于运动训练、体态评估、动作纠正等方面的问题，我会尽力为你解答！\n\n⚠️ **注意：为了保护隐私，对话记录仅临时保存，关闭页面 30 分钟后将自动清除。**',
      },
    ]);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Get conversation ID from first message if exists (mock logic for now, or use UUID)
      // For now we don't pass conversationId to keep it simple ephemeral
      
      const res = await fetch('/api/knowledge/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input.trim() }),
      });

      const json = await res.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: json.answer || '抱歉，我暂时无法回答这个问题。',
        sources: json.sources,
        relatedNodes: json.relatedNodes,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '网络错误，请稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-50 dark:bg-surface-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="font-black">AI 知识问答</h2>
            <p className="text-xs text-white/70">基于知识库内容回答</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetChat}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
            title="开始新对话 (清除历史)"
          >
            <span>🧹 新对话</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-purple-500 text-white'
              }`}
            >
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>

            {/* Content */}
            <div
              className={`max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-2xl rounded-tr-md'
                  : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-2xl rounded-tl-md shadow-sm'
              } px-4 py-3`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>

              {/* Related Nodes */}
              {message.relatedNodes && message.relatedNodes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 space-y-2">
                  <p className="text-xs font-bold text-surface-500">📚 相关内容</p>
                  {message.relatedNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        onClose();
                        router.push(`/dashboard/knowledge/nodes/${node.id}`);
                      }}
                      className="w-full text-left p-2 bg-surface-50 dark:bg-surface-700 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    >
                      <p className="text-xs font-bold text-primary-600 dark:text-primary-400">
                        {node.title}
                      </p>
                      {node.description && (
                        <p className="text-xs text-surface-500 line-clamp-1 mt-0.5">
                          {node.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-2xl rounded-tl-md shadow-sm px-4 py-3">
              <div className="flex items-center gap-2 text-surface-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">思考中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div className="shrink-0 px-4 pb-2">
          <p className="text-xs text-surface-500 mb-2">💡 试试问这些</p>
          <div className="flex flex-wrap gap-2">
            {[
              '什么是上交叉综合征？',
              '如何改善髋关节灵活性？',
              '深蹲常见错误有哪些？',
              '办公族如何放松肩颈？',
            ].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 text-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 p-4 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder-surface-400 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 w-12 h-12 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
