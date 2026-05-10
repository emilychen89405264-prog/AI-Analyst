import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatAssistant: React.FC<{ apiUrl: string; authPin: string }> = ({ apiUrl, authPin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    // 檢查是否為遠端訪問但未設定後端網址
    const isRemote = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const isBackendLocal = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');

    if (isRemote && isBackendLocal) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: '⚠️ 偵測到您正在遠端訪問，但尚未設定「後端網址」。\n\n請點擊畫面左上角的「進階連線設定」，貼上您 Port 3001 的 Cloudflare 網址，我才能為您服務喔！' 
      }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authPin 
        },
        body: JSON.stringify({
          message: userMsg,
          history: messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          }))
        })
      });

      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: '抱歉，無法連線至您的後端伺服器。請確認 npm run server 已啟動，且 Cloudflare 隧道已正確開啟。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 border border-blue-400/50"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] md:w-[400px] h-[500px] bg-[#151521] border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-blue-600/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot size={24} className="text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">Antigravity</div>
                <div className="text-blue-400 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  AI 交易助手在線中
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            >
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <Bot size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500 text-sm">你好，Emily！我是 Antigravity。<br/>有任何交易問題都可以問我喔！</p>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center",
                    msg.role === 'user' ? "bg-gray-700" : "bg-blue-600"
                  )}>
                    {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-200 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none">
                    <Loader2 size={16} className="text-blue-400 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800 bg-[#0f0f18]">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="輸入訊息..."
                  className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
