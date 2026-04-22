import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  ArrowLeft, 
  Send, 
  Smile, 
  Paperclip, 
  Mic, 
  Image, 
  Phone,
  Video,
  MoreHorizontal,
  Check,
  CheckCheck,
  User,
  Star,
  Clock,
  Calendar,
  Heart,
  ThumbsUp,
  Camera,
  File,
  Gift,
  AlertCircle,
  Plus,
  X,
  PlayCircle,
  Download
} from 'lucide-react';

interface Coach {
  id: string;
  name: string;
  title: string;
  rating: number;
}

interface Message {
  id: string;
  sender: 'user' | 'coach';
  content: string;
  type: 'text' | 'image' | 'voice' | 'video' | 'file';
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  duration?: number; // 用于语音消息
  file_url?: string;
  file_name?: string;
  file_size?: string;
}

interface ChatSession {
  id: string;
  coach_id: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_online: boolean;
  last_seen?: string;
}

interface ChatServiceProps {
  coach: Coach;
  onBack: () => void;
}

const ChatService: React.FC<ChatServiceProps> = ({
  coach,
  onBack
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'coach',
      content: '您好！很高兴为您提供一对一训练指导。有什么问题尽管问我！',
      type: 'text',
      timestamp: '2024-01-20T09:00:00Z',
      status: 'read'
    },
    {
      id: '2',
      sender: 'user',
      content: '教练好！我想询问一下关于引体向上的训练方法',
      type: 'text',
      timestamp: '2024-01-20T09:15:00Z',
      status: 'read'
    },
    {
      id: '3',
      sender: 'coach',
      content: '引体向上是很好的上肢训练动作！首先要确保正确的握法和姿势。我建议您从辅助引体向上开始练习。',
      type: 'text',
      timestamp: '2024-01-20T09:16:00Z',
      status: 'read'
    },
    {
      id: '4',
      sender: 'coach',
      content: '这是一个引体向上的标准动作示范视频',
      type: 'video',
      timestamp: '2024-01-20T09:17:00Z',
      status: 'read',
      file_url: '/demo-video.mp4',
      file_name: '引体向上标准动作.mp4',
      duration: 45
    },
    {
      id: '5',
      sender: 'user',
      content: '谢谢教练！我会按照您的指导练习的',
      type: 'text',
      timestamp: '2024-01-20T09:20:00Z',
      status: 'read'
    },
    {
      id: '6',
      sender: 'coach',
      content: '语音指导：记住动作要领...',
      type: 'voice',
      timestamp: '2024-01-20T09:25:00Z',
      status: 'read',
      duration: 35
    }
  ]);

  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState('刚刚');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: currentMessage,
      type: 'text',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');

    // 模拟发送状态更新
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        )
      );
    }, 1000);

    // 模拟教练回复
    setTimeout(() => {
      const coachReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'coach',
        content: generateCoachReply(currentMessage),
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      setMessages(prev => [...prev, coachReply]);
    }, 2000);
  };

  const generateCoachReply = (userMessage: string): string => {
    const replies = [
      '我理解您的问题，让我为您详细解答一下。',
      '这是一个很好的问题！根据我的经验...',
      '您的训练态度很积极，我建议您这样做...',
      '我会为您制定一个针对性的训练计划。',
      '继续保持这个训练状态，您一定能达到目标！',
      '如果您有任何疑问，随时可以问我。'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // 开始录音
      setTimeout(() => {
        setIsRecording(false);
        const voiceMessage: Message = {
          id: Date.now().toString(),
          sender: 'user',
          content: '语音消息',
          type: 'voice',
          timestamp: new Date().toISOString(),
          status: 'sent',
          duration: 15
        };
        setMessages(prev => [...prev, voiceMessage]);
      }, 3000);
    }
  };

  const handleFileUpload = (type: 'image' | 'video' | 'file') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const fileMessage: Message = {
          id: Date.now().toString(),
          sender: 'user',
          content: type === 'image' ? '图片' : type === 'video' ? '视频' : file.name,
          type: type,
          timestamp: new Date().toISOString(),
          status: 'sent',
          file_url: URL.createObjectURL(file),
          file_name: file.name,
          file_size: `${(file.size / 1024 / 1024).toFixed(1)} MB`
        };
        setMessages(prev => [...prev, fileMessage]);
      }
    };
    input.click();
    setShowAttachMenu(false);
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.sender === 'user';
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex items-end space-x-2 max-w-[70%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          {/* 头像 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-500' : 'bg-purple-500'
          }`}>
            <User className="w-5 h-5 text-white" />
          </div>
          
          {/* 消息内容 */}
          <div className={`rounded-lg px-4 py-2 ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            {message.type === 'text' && (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
            
            {message.type === 'image' && (
              <div className="space-y-2">
                <img 
                  src={message.file_url} 
                  alt="图片消息" 
                  className="max-w-full h-auto rounded-lg"
                />
                <p className="text-xs opacity-75">{message.file_name}</p>
              </div>
            )}
            
            {message.type === 'voice' && (
              <div className="flex items-center space-x-3">
                <button className="flex items-center space-x-2 hover:opacity-75">
                  <PlayCircle className="w-6 h-6" />
                  <span className="text-sm">语音 {message.duration}s</span>
                </button>
              </div>
            )}
            
            {message.type === 'video' && (
              <div className="space-y-2">
                <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
                  <PlayCircle className="w-12 h-12 text-white opacity-70" />
                </div>
                <p className="text-xs opacity-75">{message.file_name}</p>
              </div>
            )}
            
            {message.type === 'file' && (
              <div className="flex items-center space-x-3">
                <File className="w-6 h-6" />
                <div>
                  <p className="text-sm">{message.file_name}</p>
                  <p className="text-xs opacity-75">{message.file_size}</p>
                </div>
                <Download className="w-4 h-4 opacity-75" />
              </div>
            )}
            
            {/* 时间和状态 */}
            <div className={`flex items-center justify-between mt-1 ${
              isUser ? 'flex-row-reverse' : ''
            }`}>
              <span className="text-xs opacity-75">
                {formatTime(message.timestamp)}
              </span>
              {isUser && (
                <div className="ml-2">
                  {getMessageStatusIcon(message.status)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const emojis = ['😊', '😄', '😆', '😍', '🤔', '👍', '👏', '💪', '🔥', '❤️', '🎉', '✨'];

  return (
    <div className="min-h-screen flex flex-col">
      {/* 聊天头部 */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{coach.name}</h2>
              <p className="text-sm text-gray-600">
                {isOnline ? '在线' : `最后在线 ${lastSeen}`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(renderMessage)}
        
        {/* 正在输入指示器 */}
        {isTyping && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="bg-white border-t p-4">
        {/* 附件菜单 */}
        {showAttachMenu && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => handleFileUpload('image')}
                className="flex flex-col items-center space-y-2 p-3 hover:bg-gray-100 rounded-lg"
              >
                <Image className="w-6 h-6 text-blue-500" />
                <span className="text-xs text-gray-600">图片</span>
              </button>
              <button
                onClick={() => handleFileUpload('video')}
                className="flex flex-col items-center space-y-2 p-3 hover:bg-gray-100 rounded-lg"
              >
                <Video className="w-6 h-6 text-green-500" />
                <span className="text-xs text-gray-600">视频</span>
              </button>
              <button
                onClick={() => handleFileUpload('file')}
                className="flex flex-col items-center space-y-2 p-3 hover:bg-gray-100 rounded-lg"
              >
                <File className="w-6 h-6 text-purple-500" />
                <span className="text-xs text-gray-600">文件</span>
              </button>
              <button
                onClick={() => setShowAttachMenu(false)}
                className="flex flex-col items-center space-y-2 p-3 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6 text-gray-500" />
                <span className="text-xs text-gray-600">取消</span>
              </button>
            </div>
          </div>
        )}

        {/* 表情选择器 */}
        {showEmojiPicker && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-6 gap-2">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentMessage(prev => prev + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                  className="text-2xl p-2 hover:bg-gray-100 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 输入栏 */}
        <div className="flex items-end space-x-2">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
          >
            <Smile className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
              rows={1}
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={handleVoiceRecord}
            className={`p-2 rounded-full ${
              isRecording 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim()}
            className={`p-2 rounded-full ${
              currentMessage.trim()
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatService; 