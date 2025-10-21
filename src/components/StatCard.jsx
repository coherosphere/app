import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function StatCard({ iconName, iconConfig, value, label, isLoading }) {
  // Einheitliche kompakte Größe für Mobile & Desktop - exakt 98px hoch
  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 flex-shrink-0 w-full h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        {isLoading ? (
          <>
            <div className="w-5 h-5 rounded-full bg-slate-700 mx-auto mb-1.5 animate-pulse" />
            <div className="h-6 w-12 bg-slate-700 rounded mx-auto mb-1 animate-pulse" />
            <div className="h-3 w-16 bg-slate-700 rounded mx-auto animate-pulse" />
          </>
        ) : (
          <>
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName={iconName}
                iconConfig={iconConfig}
                size="w-5 h-5"
                fallbackColor="text-slate-400"
              />
            </div>
            <motion.div
              key={value}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-lg font-bold text-white mb-0.5"
            >
              {value}
            </motion.div>
            <div className="text-slate-400 text-xs leading-tight">
              {label}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}