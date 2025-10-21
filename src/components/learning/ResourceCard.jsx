import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight } from 'lucide-react';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function ResourceCard({ resource, index, iconConfig }) {
  const categoryKey = resource.category?.replace(/ & /g, '').replace(/ /g, '');

  // Custom colors per category
  const getCategoryStyles = (key) => {
    switch(key) {
      case 'CommunityBuilding':
        return {
          bgColor: 'rgba(114, 106, 145, 0.15)',
          borderColor: 'rgba(114, 106, 145, 0.3)',
        };
      case 'HolisticHealth':
        return {
          bgColor: 'rgba(123, 158, 135, 0.15)',
          borderColor: 'rgba(123, 158, 135, 0.3)',
        };
      case 'DecentralizedTech':
        return {
          bgColor: 'rgba(42, 62, 92, 0.2)',
          borderColor: 'rgba(42, 62, 92, 0.4)',
        };
      case 'NatureSustainability':
      case 'Nature&Sustainability':
        return {
          bgColor: 'rgba(85, 107, 47, 0.15)',
          borderColor: 'rgba(85, 107, 47, 0.3)',
        };
      default:
        return {
          bgColor: 'rgba(100, 116, 139, 0.15)',
          borderColor: 'rgba(100, 116, 139, 0.3)',
        };
    }
  };

  const styles = getCategoryStyles(categoryKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5 }}
    >
      <Card className="group bg-slate-800/40 backdrop-blur-sm border-slate-700 hover:bg-slate-800/60 hover:border-orange-500/50 transition-all duration-300 h-full flex flex-col">
        <CardHeader className="flex-row items-start gap-4 space-y-0 pb-4">
          <div 
            className="w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center border"
            style={{
              backgroundColor: styles.bgColor,
              borderColor: styles.borderColor
            }}
          >
            <ConfiguredIcon 
              iconName={resource.icon_name}
              iconConfig={iconConfig}
              size="w-6 h-6"
            />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
              {resource.title}
            </CardTitle>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-orange-400 transition-transform group-hover:rotate-45" />
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-slate-400 text-sm leading-relaxed">{resource.description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}