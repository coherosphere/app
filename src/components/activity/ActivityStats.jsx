import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function ActivityStats({ 
  totalEvents, 
  posts, 
  mentions, 
  replies, 
  reactions, 
  zapsIn, 
  zapsOut, 
  totalZapAmountIn,
  totalZapAmountOut,
  isLoading,
  iconConfigs
}) {
  const StatCard = ({ iconName, value, label, color, isLoading }) => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        {isLoading ? (
          <>
            <div className="w-5 h-5 rounded-full bg-slate-700/30 mx-auto mb-1.5 animate-pulse"></div>
            <div className="h-6 w-12 bg-slate-700/30 rounded mx-auto mb-0.5 animate-pulse"></div>
            <div className="h-3 w-20 bg-slate-700/30 rounded mx-auto animate-pulse"></div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName={iconName}
                iconConfig={iconConfigs[iconName]}
                size="w-5 h-5"
                fallbackColor={color}
              />
            </div>
            <motion.div
              key={value}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-lg font-bold text-white mb-0.5"
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </motion.div>
            <div className="text-slate-400 text-xs">
              {label}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1 }}
    >
      <StatCard
        iconName="Activity"
        value={totalEvents}
        label="Events (sum)"
        color="text-orange-500"
        isLoading={isLoading}
      />
      <StatCard
        iconName="MessageCircle"
        value={posts}
        label="Posts"
        color="text-blue-500"
        isLoading={isLoading}
      />
      <StatCard
        iconName="AtSign"
        value={mentions}
        label="Mentions"
        color="text-purple-500"
        isLoading={isLoading}
      />
      <StatCard
        iconName="Reply"
        value={replies}
        label="Replies"
        color="text-green-500"
        isLoading={isLoading}
      />
      <StatCard
        iconName="Heart"
        value={reactions}
        label="Reactions"
        color="text-pink-500"
        isLoading={isLoading}
      />
      <StatCard
        iconName="Zap"
        value={totalZapAmountIn || 0}
        label="Zaps In (sats)"
        color="text-yellow-400"
        isLoading={isLoading}
      />
      <StatCard
        iconName="Zap"
        value={totalZapAmountOut || 0}
        label="Zaps Out (sats)"
        color="text-orange-400"
        isLoading={isLoading}
      />
    </motion.div>
  );
}