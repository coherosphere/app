import { useCachedData } from '@/components/caching/useCachedData';
import { base44 } from '@/api/base44Client';

/**
 * Hook to fetch all icon configurations with HIGH LIMIT
 */
export function useAllIconConfigs() {
  const { data: iconConfigsList = [], isLoading, error } = useCachedData(
    ['icons', 'all-configs'],
    async () => {
      const allIcons = await base44.entities.IconConfiguration.list('-created_date', 5000);
      return allIcons;
    },
    'icons'
  );

  const iconConfigs = iconConfigsList.reduce((acc, config) => {
    acc[config.icon_name] = config;
    return acc;
  }, {});

  return { iconConfigs, isLoading, error };
}

/**
 * Hook to fetch a single icon configuration
 */
export function useIconConfig(iconName) {
  const { iconConfigs, isLoading, error } = useAllIconConfigs();
  return {
    iconConfig: iconConfigs[iconName],
    isLoading,
    error
  };
}