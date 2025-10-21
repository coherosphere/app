
import React from 'react';
import { MessageCircle, Globe2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ChatWindow from '@/components/chat/ChatWindow';

export default function Chat() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 p-4 lg:p-8"> {/* Removed pb-4 from this div */}
        <div className="mb-8"> {/* This div wraps the entire header content */}
          <div className="flex items-center gap-4 mb-3">
            {/* Replaced original icon structure with the outline's icon, adapting to MessageCircle */}
            <MessageCircle className="w-12 h-12 text-orange-500 flex-shrink-0" />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                Cohero AI Assistant
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
            Your AI guide to the coherosphere. Ask me anything!
          </p>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-hidden px-4 lg:px-8">
        <ChatWindow
          className="h-full"
          showHeader={false}
        />
      </div>
    </div>
  );
}
