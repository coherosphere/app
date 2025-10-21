import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { useCachedData } from '@/components/caching/useCachedData';
import { base44 } from '@/api/base44Client';

/**
 * Generic stat display component that fetches its configuration and value from the database
 * 
 * Usage:
 * <StatDisplay statKey="dashboard_total_members" />
 */
export default function StatDisplay({ statKey, className = '' }) {
  const { iconConfigs } = useAllIconConfigs();

  // Load stat configuration (heavily cached, rarely changes)
  const { data: config, isLoading: configLoading } = useCachedData(
    ['stat-config', statKey],
    async () => {
      const configs = await base44.entities.StatConfiguration.filter({ stat_key: statKey });
      return configs.length > 0 ? configs[0] : null;
    },
    'perfStats',
    {
      staleTime: 30 * 60 * 1000, // 30 minutes - config rarely changes
      gcTime: 60 * 60 * 1000, // 1 hour
    }
  );

  // Load stat value (lighter cache, updated by cron)
  const { data: value, isLoading: valueLoading } = useCachedData(
    ['stat-value', statKey],
    async () => {
      const values = await base44.entities.StatValue.filter({ stat_key: statKey });
      return values.length > 0 ? values[0] : null;
    },
    'perfStats',
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - syncs with cron job interval
      gcTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const isLoading = configLoading || valueLoading;

  // If config doesn't exist, don't render anything
  if (!configLoading && !config) {
    console.warn(`[StatDisplay] No configuration found for stat_key: ${statKey}`);
    return null;
  }

  // If config is inactive, don't render
  if (config && !config.is_active) {
    return null;
  }

  // Format the value based on format_hint
  const formatValue = () => {
    if (!value) return '—';
    
    const rawValue = value.value_number !== null ? value.value_number : value.value_string;
    
    if (rawValue === null || rawValue === undefined) return '—';

    switch (config?.format_hint) {
      case 'number':
        return typeof rawValue === 'number' ? rawValue.toLocaleString() : rawValue;
      
      case 'currency':
        return typeof rawValue === 'number' ? `${rawValue.toLocaleString()} ${config.unit || 'sats'}` : rawValue;
      
      case 'percentage':
        return typeof rawValue === 'number' ? `${rawValue.toFixed(1)}%` : rawValue;
      
      case 'time':
        if (typeof rawValue === 'number') {
          if (rawValue >= 1000) return `${(rawValue / 1000).toFixed(1)}s`;
          return `${Math.round(rawValue)}ms`;
        }
        return rawValue;
      
      default:
        return typeof rawValue === 'number' ? rawValue.toLocaleString() : rawValue;
    }
  };

  const cardContent = (
    <Card className={`bg-slate-800/50 backdrop-blur-sm border-slate-700 ${config?.link_page ? 'hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 cursor-pointer' : ''} ${className}`}>
      <CardContent className="p-4 text-center">
        <div className="flex justify-center mb-2">
          <ConfiguredIcon 
            iconName={config?.icon_name || 'Activity'}
            iconConfig={iconConfigs[config?.icon_name]}
            size="w-8 h-8"
            fallbackColor={config?.color_hint || 'text-slate-400'}
          />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" />
            <div className="h-4 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" />
          </div>
        ) : (
          <>
            <motion.div
              key={value?.timestamp}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-bold text-white mb-1"
            >
              {formatValue()}
            </motion.div>
            <div className="text-slate-400 text-sm">
              {config?.display_name || statKey}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // Wrap in Link if link_page is specified
  if (config?.link_page) {
    return (
      <Link to={createPageUrl(config.link_page)} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}