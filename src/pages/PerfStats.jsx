
import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO, startOfDay } from 'date-fns';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachingPolicy } from '@/components/caching/CachingPolicyContext';
import { useCachedData } from '@/components/caching/useCachedData';
import StatCard from '@/components/StatCard';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Mapping from page paths to domain names
const PAGE_TO_DOMAIN = {
  '/Dashboard': 'dashboard',
  '/Projects': 'projects',
  '/Treasury': 'treasury',
  '/Activity': 'activity',
  '/Voting': 'governance',
  '/Learning': 'learning',
  '/FAQ': 'faq',
  '/Hub': 'hub',
  '/Profile': 'profile',
  '/Messages': 'messages',
  '/Engage': 'engage',
  '/GlobalHubs': 'globalHubs',
  '/Calendar': 'calendar',
  '/Donate': 'donate',
  '/Brand': 'brand',
  '/Chat': 'chat',
  '/CreateProject': 'createProject',
  '/HostEvent': 'hostEvent',
  '/HubResonance': 'hubResonance',
  '/Manifesto': 'manifesto',
  '/Onboarding': 'onboarding',
  '/PerfStats': 'perfStats',
  '/ResonanceAdmin': 'resonanceAdmin',
  '/ResonanceCheck': 'resonanceCheck',
  '/ResourceDetail': 'resourceDetail',
  '/ShareKnowledge': 'shareKnowledge',
  '/StartCircle': 'startCircle',
  '/Status': 'status',
  '/Terms': 'terms',
  '/UserResonance': 'userResonance',
  '/VideoCall': 'videoCall',
};

export default function PerfStats() {
  const { iconConfigs } = useAllIconConfigs();

  const [timeRange, setTimeRange] = useState('24h');
  const [metricTypeFilter, setMetricTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('median');
  // const [stats, setStats] = useState({}); // Removed, now derived via useMemo
  const [expandedItem, setExpandedItem] = useState(null);
  const [recentMeasurements, setRecentMeasurements] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMeasurements, setLoadingMeasurements] = useState({}); // Track loading state per page

  // Removed: isAggregating and lastAggregation states

  const { setLoading } = useLoading();
  const { getSettingsForDomain } = useCachingPolicy();

  // Progressive Loading States - START AS FALSE (will show skeletons)
  const [sectionsReady, setSectionsReady] = useState({
    filters: false,
    stats: false,
    timeline: false,
    thresholds: false,
    breakdown: false,
    sortByControls: false, // Added for the new section
  });

  // Use cached data for current user
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['perfStats', 'currentUser'],
    () => base44.auth.me(),
    'perfStats'
  );

  // Use cached data for performance metrics (SUMMARY MODE - fast!)
  const { data: metricsResponse, isLoading: metricsLoading, refetch: refetchMetrics } = useCachedData(
    ['perfStats', 'summary', timeRange, metricTypeFilter],
    async () => {
      console.log('[PerfStats] === FETCHING METRICS ===');
      console.log('[PerfStats] timeRange:', timeRange);
      console.log('[PerfStats] metricTypeFilter:', metricTypeFilter);
      
      const response = await base44.functions.invoke('getPerformanceMetrics', {
        timeRange,
        metricType: metricTypeFilter === 'all' ? undefined : metricTypeFilter,
        mode: 'summary'
      });
      
      console.log('[PerfStats] === RAW BACKEND RESPONSE ===');
      console.log('[PerfStats] response.data:', response.data);
      console.log('[PerfStats] response.data.success:', response.data?.success);
      console.log('[PerfStats] response.data.stats:', response.data?.stats);
      console.log('[PerfStats] stats keys:', response.data?.stats ? Object.keys(response.data.stats) : 'NO STATS');
      console.log('[PerfStats] stats length:', response.data?.stats ? Object.keys(response.data.stats).length : 0);
      
      return response.data;
    },
    'perfStats',
    {
      enabled: currentUser?.role === 'admin'
    }
  );

  // Use cached data for timeline (AGGREGATED MODE - lightweight!)
  const { data: timelineResponse, isLoading: timelineLoading } = useCachedData(
    ['perfStats', 'timeline', timeRange, metricTypeFilter],
    async () => {
      console.log('[PerfStats] === FETCHING TIMELINE DATA ===');
      console.log('[PerfStats] Timeline query params:', { timeRange, metricTypeFilter });
      
      const response = await base44.functions.invoke('getPerformanceMetrics', {
        timeRange,
        metricType: metricTypeFilter === 'all' ? undefined : metricTypeFilter, // Pass specific metric type only if filter is not 'all'
        mode: 'timeline'
      });
      
      console.log('[PerfStats] === TIMELINE RESPONSE ===');
      console.log('[PerfStats] response:', response);
      console.log('[PerfStats] response.data:', response.data);
      console.log('[PerfStats] response.data.timelineData:', response.data?.timelineData);
      console.log('[PerfStats] response.data.timelineData length:', response.data?.timelineData?.length);
      
      return response.data;
    },
    'perfStats',
    {
      enabled: currentUser?.role === 'admin'
    }
  );

  // Debug: Log timelineResponse changes
  useEffect(() => {
    console.log('[PerfStats] === TIMELINE RESPONSE UPDATED ===');
    console.log('[PerfStats] timelineResponse:', timelineResponse);
    console.log('[PerfStats] timelineLoading:', timelineLoading);
    console.log('[PerfStats] timelineResponse?.timelineData:', timelineResponse?.timelineData);
  }, [timelineResponse, timelineLoading]);

  // Removed: Load last aggregation timestamp useCachedData hook

  const isLoading = userLoading || metricsLoading || timelineLoading;

  // Manage global loading indicator
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Removed: Set last aggregation timestamp from cached data useEffect

  // Reset expanded items and section ready states when filters change
  useEffect(() => {
    setRecentMeasurements({});
    setExpandedItem(null);
    setLoadingMeasurements({});
    
    // Reset section ready states - but keep filters AND thresholds ready (static content)
    setSectionsReady(prev => ({
      filters: prev.filters, // Keep filters ready - they're just buttons
      stats: false,
      timeline: false,
      thresholds: true, // Keep thresholds ready - they're static content
      breakdown: false,
      sortByControls: true // Sort by controls are also static once rendered, just state changes
    }));
  }, [timeRange, metricTypeFilter]); // ← sortBy ENTFERNT! Nur timeRange und metricTypeFilter triggern Reset

  // Process API data into transactions using useMemo for efficiency
  const stats = useMemo(() => {
    console.log('[PerfStats] === PROCESSING STATS ===');
    console.log('[PerfStats] metricsResponse:', metricsResponse);
    console.log('[PerfStats] metricsResponse?.stats:', metricsResponse?.stats);
    
    if (!metricsResponse?.stats) {
      console.log('[PerfStats] NO STATS FOUND - returning empty object');
      return {};
    }
    
    console.log('[PerfStats] Stats object keys:', Object.keys(metricsResponse.stats));
    if (Object.keys(metricsResponse.stats).length > 0) {
      console.log('[PerfStats] First stat:', Object.values(metricsResponse.stats)[0]);
    } else {
      console.log('[PerfStats] Stats object is empty.');
    }
    
    return metricsResponse.stats;
  }, [metricsResponse]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Filters always ready immediately (no data dependency)
    setSectionsReady(prev => ({ ...prev, filters: true }));
  }, []);

  useEffect(() => {
    // Stats ready when metrics loaded AND actually contains data
    if (!metricsLoading && metricsResponse) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [metricsLoading, metricsResponse]);

  useEffect(() => {
    // Timeline ready when timeline data loaded AND actually contains data
    if (!timelineLoading && timelineResponse?.timelineData) {
      console.log('[PerfStats] ✅ Setting timeline section ready! Data points:', timelineResponse.timelineData.length);
      setSectionsReady(prev => ({ ...prev, timeline: true }));
    } else {
      console.log('[PerfStats] ❌ Timeline section NOT ready:', { 
        timelineLoading, 
        hasResponse: !!timelineResponse,
        hasData: !!timelineResponse?.timelineData,
        dataLength: timelineResponse?.timelineData?.length 
      });
    }
  }, [timelineLoading, timelineResponse]);

  useEffect(() => {
    // Thresholds always ready immediately (static content)
    setSectionsReady(prev => ({ ...prev, thresholds: true }));
  }, []);

  useEffect(() => {
    // Sort by controls are effectively static, always ready
    setSectionsReady(prev => ({ ...prev, sortByControls: true }));
  }, []);

  useEffect(() => {
    // Breakdown ready when metrics loaded AND actually contains data
    if (!metricsLoading && metricsResponse?.stats) {
      setSectionsReady(prev => ({ ...prev, breakdown: true }));
    }
  }, [metricsLoading, metricsResponse]);

  const getMetricColor = (value, metricType) => {
    if (metricType === 'frontend_load') {
      if (value < 500) return 'text-green-400';
      if (value < 1000) return 'text-yellow-400';
      if (value < 2000) return 'text-orange-400';
      return 'text-red-400';
    } else if (metricType === 'backend_function') {
      if (value < 100) return 'text-green-400';
      if (value < 500) return 'text-yellow-400';
      if (value < 1000) return 'text-orange-400';
      return 'text-red-400';
    }
    // Default fallback
    if (value < 100) return 'text-green-400';
    if (value < 500) return 'text-yellow-400';
    if (value < 1000) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMetricBadge = (value, metricType) => {
    if (metricType === 'frontend_load') {
      if (value < 500) return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Fast' };
      if (value < 1000) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300', label: 'Good' };
      if (value < 2000) return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Slow' };
      return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Very Slow' };
    } else if (metricType === 'backend_function') {
      if (value < 100) return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Fast' };
      if (value < 500) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300', label: 'Good' };
      if (value < 1000) return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Slow' };
      return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Very Slow' };
    }
    // Default fallback
    if (value < 100) return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Fast' };
    if (value < 500) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300', label: 'Good' };
    if (value < 1000) return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Slow' };
    return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Very Slow' };
  };

  // Get timeline data with local time formatting
  const getTimelineData = () => {
    console.log('[PerfStats] === TIMELINE DATA PROCESSING ===');
    console.log('[PerfStats] timelineResponse:', timelineResponse);
    console.log('[PerfStats] timelineResponse?.timelineData:', timelineResponse?.timelineData);
    
    if (!timelineResponse?.timelineData || timelineResponse.timelineData.length === 0) {
      console.log('[PerfStats] No timeline data available');
      return [];
    }
    
    console.log('[PerfStats] Processing', timelineResponse.timelineData.length, 'timeline points');
    
    // Format labels with user's local timezone
    return timelineResponse.timelineData.map(point => {
      const date = new Date(point.timestamp);
      
      let label;
      if (timeRange === '24h') {
        // Show time with timezone for hourly data
        label = date.toLocaleString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZoneName: 'short'
        });
      } else {
        // Show date for daily data
        label = date.toLocaleDateString('de-DE', { 
          day: '2-digit', 
          month: '2-digit',
          year: '2-digit'
        });
      }
      
      return {
        ...point,
        label
      };
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-1">{label}</p>
          <p className="text-red-300 text-sm">
            Max: {payload.find(p => p.dataKey === 'max')?.value || 0}ms
          </p>
          <p className="text-blue-300 text-sm">
            Avg: {payload.find(p => p.dataKey === 'avg')?.value || 0}ms
          </p>
          <p className="text-orange-400 text-sm font-semibold">
            Median: {payload.find(p => p.dataKey === 'median')?.value || 0}ms
          </p>
          <p className="text-green-300 text-sm">
            Min: {payload.find(p => p.dataKey === 'min')?.value || 0}ms
          </p>
          {payload[0].payload.count && (
            <p className="text-slate-400 text-xs mt-1">
              {payload[0].payload.count} measurements
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const sortedStats = Object.values(stats).sort((a, b) => {
    switch (sortBy) {
      case 'min':
        return b.min - a.min;
      case 'max':
        return b.max - a.max;
      case 'avg':
        return b.avg - a.avg;
      case 'median':
      default:
        return b.median - a.median;
    }
  });

  console.log('[PerfStats] === SORTED STATS ===');
  console.log('[PerfStats] sortedStats length:', sortedStats.length);
  console.log('[PerfStats] sortBy:', sortBy);

  // Filter stats based on search query
  const filteredStats = React.useMemo(() => {
    console.log('[PerfStats] === FILTERING STATS ===');
    console.log('[PerfStats] sortedStats.length:', sortedStats.length);
    console.log('[PerfStats] searchQuery:', searchQuery);
    
    if (!searchQuery.trim()) {
      console.log('[PerfStats] No search query - returning all', sortedStats.length);
      return sortedStats;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sortedStats.filter(stat => {
      const pageName = stat.page_name.toLowerCase();
      const metricType = stat.metric_type.toLowerCase();
      const pageUrlFromOutline = `/pages/${stat.page_name}`.toLowerCase();
      const generatedPageUrl = createPageUrl(stat.page_name).toLowerCase();

      return pageName.includes(query) ||
        metricType.includes(query) ||
        generatedPageUrl.includes(query) ||
        pageUrlFromOutline.includes(query);
    });
    
    console.log('[PerfStats] Filtered to:', filtered.length);
    return filtered;
  }, [sortedStats, searchQuery]);

  console.log('[PerfStats] === FINAL FILTERED STATS ===');
  console.log('[PerfStats] filteredStats.length:', filteredStats.length);

  // LAZY LOAD: Load measurements on demand when expanding
  const loadLatestMeasurements = async (pageName, metricType) => {
    const key = `${pageName}::${metricType}`;

    // Already loaded?
    if (recentMeasurements[key]) {
      return;
    }

    // Set loading state
    setLoadingMeasurements(prev => ({ ...prev, [key]: true }));

    try {
      console.log(`[PerfStats] Lazy loading measurements for ${pageName} (${metricType})`);
      
      const response = await base44.functions.invoke('getPerformanceMetrics', {
        timeRange,
        metricType: metricTypeFilter === 'all' ? undefined : metricTypeFilter, // Pass specific metric type only if filter is not 'all'
        mode: 'detailed',
        pageName: pageName
      });

      if (response.data.success && response.data.measurements) {
        setRecentMeasurements(prev => ({
          ...prev,
          [key]: response.data.measurements
        }));
        console.log(`[PerfStats] Loaded ${response.data.measurements.length} measurements for ${pageName}`);
      } else {
        console.warn(`[PerfStats] No measurements found in detailed response for ${pageName}. Response:`, response);
        setRecentMeasurements(prev => ({
          ...prev,
          [key]: []
        }));
      }
    } catch (error) {
      console.error(`[PerfStats] Error loading measurements for ${pageName}:`, error);
      // Set empty array to prevent infinite retries
      setRecentMeasurements(prev => ({
        ...prev,
        [key]: []
      }));
    } finally {
      setLoadingMeasurements(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleExpand = (pageName, metricType) => {
    const key = `${pageName}::${metricType}`;
    if (expandedItem === key) {
      // Collapse
      setExpandedItem(null);
    } else {
      // Expand and lazy load measurements
      setExpandedItem(key);
      loadLatestMeasurements(pageName, metricType);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return format(date, 'dd.MM.yyyy HH:mm:ss');
    } catch (error) {
      return timestamp;
    }
  };

  const getCachePreset = (pageUrl) => {
    const domain = PAGE_TO_DOMAIN[pageUrl];
    if (!domain) return null;

    const settings = getSettingsForDomain(domain);
    return settings?.preset || 'Unknown';
  };

  const getPresetBadgeClass = (preset) => {
    switch (preset) {
      case 'Live':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Fresh':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Balanced':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Archive':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Custom':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Removed: handleManualAggregate function
  // Removed: formatLastRun function

  // Skeleton Components
  const StatCardSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        <div className="flex justify-center mb-1.5">
          <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
        </div>
        <div className="h-6 w-16 bg-slate-700/30 animate-pulse rounded mb-0.5 mx-auto" />
        <div className="h-3 w-20 bg-slate-700/30 animate-pulse rounded mx-auto" />
      </CardContent>
    </Card>
  );

  const TimelineSkeleton = () => (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <div className="h-6 w-48 bg-slate-700 animate-pulse rounded mb-2" />
        <div className="h-4 w-64 bg-slate-700/50 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] bg-slate-700/20 animate-pulse rounded" />
      </CardContent>
    </Card>
  );

  const BreakdownSkeleton = () => (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="h-6 w-56 bg-slate-700 animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-slate-700/50 animate-pulse rounded" />
          </div>
          <div className="h-11 w-full lg:w-96 bg-slate-700/30 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-slate-700/20 animate-pulse rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Access Denied - show ONLY when user is loaded and confirmed not admin
  if (!userLoading && currentUser?.role !== 'admin') {
    return (
      <div className="p-8">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="p-8 text-center">
            <ConfiguredIcon
              iconName="AlertCircle"
              iconConfig={iconConfigs['AlertCircle']}
              size="w-16 h-16"
              className="mx-auto mb-4"
              fallbackColor="text-slate-500"
            />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">This area is restricted to administrators only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <ConfiguredIcon
              iconName="CircleGauge"
              iconConfig={iconConfigs['CircleGauge']}
              size="w-12 h-12"
              className="flex-shrink-0"
              fallbackColor="text-orange-500"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                Performance Statistics
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>

          {/* Show refresh button only when user is confirmed admin (or loading, but it will be disabled) */}
          {(!userLoading && currentUser?.role === 'admin') || userLoading ? (
            <Button
              onClick={() => refetchMetrics()}
              disabled={isLoading}
              variant="outline"
              className="btn-secondary-coherosphere"
            >
              <ConfiguredIcon
                iconName="RefreshCw"
                iconConfig={iconConfigs['RefreshCw']}
                size="w-4 h-4"
                className={`mr-2 ${isLoading ? 'animate-spin' : ''}`}
                fallbackColor="currentColor"
              />
              Refresh
            </Button>
          ) : null}
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Monitor page load times and identify performance bottlenecks across the app.
        </p>
      </motion.div>

      {/* Stats - Progressive Loading OR Skeleton */}
      {sectionsReady.stats ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0 }}
        >
          <StatCard
            iconName="Clock"
            iconConfig={iconConfigs['Clock']}
            value={metricsResponse?.totalMetrics || 0}
            label="Total Measurements"
            isLoading={false}
          />

          <StatCard
            iconName="Activity"
            iconConfig={iconConfigs['Activity']}
            value={Object.keys(stats).length}
            label="Tracked Endpoints"
            isLoading={false}
          />

          <StatCard
            iconName="TrendingDown"
            iconConfig={iconConfigs['TrendingDown']}
            value={sortedStats.length > 0 ? `${Math.round(sortedStats[0][sortBy])}ms` : '—'}
            label={`Slowest ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`}
            isLoading={false}
          />

          <StatCard
            iconName="Zap"
            iconConfig={iconConfigs['Zap']}
            value={sortedStats.length > 0 ? `${Math.round(sortedStats[sortedStats.length - 1][sortBy])}ms` : '—'}
            label={`Fastest ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`}
            isLoading={false}
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Removed: System Actions Section */}

      {/* Filters - Progressive Loading OR Skeleton */}
      {sectionsReady.filters ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex gap-2">
              <Button
                onClick={() => setTimeRange('24h')}
                variant="ghost"
                className={`filter-chip h-auto ${timeRange === '24h' ? 'active' : ''}`}
              >
                Last 2500 Measurements
              </Button>
              <Button
                onClick={() => setTimeRange('7d')}
                variant="ghost"
                className={`filter-chip h-auto ${timeRange === '7d' ? 'active' : ''}`}
              >
                Last 7 Days
              </Button>
              <Button
                onClick={() => setTimeRange('30d')}
                variant="ghost"
                className={`filter-chip h-auto ${timeRange === '30d' ? 'active' : ''}`}
              >
                Last 30 Days
              </Button>
              <Button
                onClick={() => setTimeRange('all')}
                variant="ghost"
                className={`filter-chip h-auto ${timeRange === 'all' ? 'active' : ''}`}
              >
                All Time
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setMetricTypeFilter('all')}
                variant="ghost"
                className={`filter-chip h-auto ${metricTypeFilter === 'all' ? 'active' : ''}`}
              >
                All Types
              </Button>
              <Button
                onClick={() => setMetricTypeFilter('frontend_load')}
                variant="ghost"
                className={`filter-chip h-auto ${metricTypeFilter === 'frontend_load' ? 'active' : ''}`}
              >
                Frontend Load
              </Button>
              <Button
                onClick={() => setMetricTypeFilter('backend_function')}
                variant="ghost"
                className={`filter-chip h-auto ${metricTypeFilter === 'backend_function' ? 'active' : ''}`}
              >
                Backend Functions
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-32 bg-slate-700/30 animate-pulse rounded-full" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => ( // Adjusted skeleton for filter buttons
              <div key={i} className="h-10 w-32 bg-slate-700/30 animate-pulse rounded-full" />
            ))}
          </div>
        </div>
      )}

      {/* Timeline Chart - Progressive Loading OR Skeleton */}
      {sectionsReady.timeline ? (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          {(() => {
            console.log('[PerfStats] 🎨 RENDERING TIMELINE CHART');
            const timelineData = getTimelineData();
            console.log('[PerfStats] 🎨 Chart data points:', timelineData.length);
            return null; // This IIFE is just for logging, it doesn't render anything itself
          })()}
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Performance Timeline</CardTitle>
              <p className="text-slate-400 text-sm mt-1">
                Aggregated median performance over time ({timeRange === '24h' ? 'hourly' : timeRange === '7d' || timeRange === '30d' ? 'daily' : 'weekly'} intervals)
              </p>
            </CardHeader>
            <CardContent>
              {getTimelineData().length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ConfiguredIcon
                    iconName="TrendingUp"
                    iconConfig={iconConfigs['TrendingUp']}
                    size="w-12 h-12"
                    className="mx-auto mb-4"
                    fallbackColor="text-slate-500"
                  />
                  <p>No timeline data available for the selected filters.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getTimelineData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                      label={{ value: 'Load Time (ms)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                      tickFormatter={(value) => {
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
                        return `${Math.round(value)}ms`;
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    {/* Min - Feine Linie */}
                    <Line 
                      type="monotone" 
                      dataKey="min" 
                      stroke="#34d399" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Min"
                    />
                    
                    {/* Median - Haupt-Linie (dick) */}
                    <Line 
                      type="monotone" 
                      dataKey="median" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      dot={{ fill: '#f97316', r: 5 }}
                      activeDot={{ r: 7 }}
                      name="Median"
                    />
                    
                    {/* Average - Feine Linie */}
                    <Line 
                      type="monotone" 
                      dataKey="avg" 
                      stroke="#60a5fa" 
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={false}
                      name="Avg"
                    />
                    
                    {/* Max - Feine Linie */}
                    <Line 
                      type="monotone" 
                      dataKey="max" 
                      stroke="#f87171" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Max"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="mb-8">
          <TimelineSkeleton />
        </div>
      )}

      {/* Thresholds - ALWAYS VISIBLE (static content, no skeleton after filter change) */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.15 }}
      >
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Performance Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Frontend Load Thresholds */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h3 className="text-white font-semibold">Frontend Page Loads</h3>
                  <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                    Core Web Vitals aligned
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-green-500/10 border border-green-500/20">
                    <span className="text-green-300 font-medium">Fast</span>
                    <span className="text-slate-400 font-mono">&lt; 500ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <span className="text-yellow-300 font-medium">Good</span>
                    <span className="text-slate-400 font-mono">500–1000ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-orange-500/10 border border-orange-500/20">
                    <span className="text-orange-300 font-medium">Slow</span>
                    <span className="text-slate-400 font-mono">1000–2000ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-red-300 font-medium">Very Slow</span>
                    <span className="text-slate-400 font-mono">≥ 2000ms</span>
                  </div>
                </div>
              </div>

              {/* Backend Function Thresholds */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <h3 className="text-white font-semibold">Backend Functions</h3>
                  <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                    API response times
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-green-500/10 border border-green-500/20">
                    <span className="text-green-300 font-medium">Fast</span>
                    <span className="text-slate-400 font-mono">&lt; 100ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <span className="text-yellow-300 font-medium">Good</span>
                    <span className="text-slate-400 font-mono">100–500ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-orange-500/10 border border-orange-500/20">
                    <span className="text-orange-300 font-medium">Slow</span>
                    <span className="text-slate-400 font-mono">500–1000ms</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-red-300 font-medium">Very Slow</span>
                    <span className="text-slate-400 font-mono">≥ 1000ms</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sort by Controls - NEW POSITION HERE */}
      {sectionsReady.sortByControls ? (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.2 }} // Adjusted delay
        >
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Sort Performance Breakdown</CardTitle>
              <p className="text-slate-400 text-sm mt-1">
                Choose which metric to use for sorting the breakdown below
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setSortBy('median')}
                  variant="ghost"
                  className={`filter-chip h-auto ${sortBy === 'median' ? 'active' : ''}`}
                >
                  <ConfiguredIcon 
                    iconName="TrendingUp" // Using TrendingUp for median as a general indicator of "central tendency"
                    iconConfig={iconConfigs['TrendingUp']}
                    size="w-4 h-4"
                    className="mr-2"
                    fallbackColor="currentColor"
                  />
                  Median
                </Button>
                <Button
                  onClick={() => setSortBy('min')}
                  variant="ghost"
                  className={`filter-chip h-auto ${sortBy === 'min' ? 'active' : ''}`}
                >
                  <ConfiguredIcon 
                    iconName="ArrowDown" // Using ArrowDown to indicate minimum/lowest value
                    iconConfig={iconConfigs['ArrowDown']}
                    size="w-4 h-4"
                    className="mr-2"
                    fallbackColor="currentColor"
                  />
                  Min
                </Button>
                <Button
                  onClick={() => setSortBy('avg')}
                  variant="ghost"
                  className={`filter-chip h-auto ${sortBy === 'avg' ? 'active' : ''}`}
                >
                  <ConfiguredIcon 
                    iconName="Activity" // Activity for average as it's often a common measure
                    iconConfig={iconConfigs['Activity']}
                    size="w-4 h-4"
                    className="mr-2"
                    fallbackColor="currentColor"
                  />
                  Average
                </Button>
                <Button
                  onClick={() => setSortBy('max')}
                  variant="ghost"
                  className={`filter-chip h-auto ${sortBy === 'max' ? 'active' : ''}`}
                >
                  <ConfiguredIcon 
                    iconName="ArrowUp" // Using ArrowUp to indicate maximum/highest value
                    iconConfig={iconConfigs['ArrowUp']}
                    size="w-4 h-4"
                    className="mr-2"
                    fallbackColor="currentColor"
                  />
                  Max
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="mb-8">
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <div className="h-6 w-64 bg-slate-700 animate-pulse rounded mb-2" />
              <div className="h-4 w-80 bg-slate-700/50 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-28 bg-slate-700/30 animate-pulse rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Breakdown - Progressive Loading OR Skeleton */}
      {sectionsReady.breakdown ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.25 }} // Adjusted delay
        >
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Performance Breakdown</CardTitle>
                  <p className="text-slate-400 text-sm mt-1">
                    Click on an item to lazy-load the latest 10 measurements ⚡
                  </p>
                </div>

                {/* Search Field */}
                <div className="relative w-full lg:w-96">
                  <ConfiguredIcon
                    iconName="Search"
                    iconConfig={iconConfigs['Search']}
                    size="w-4 h-4"
                    className="absolute left-3 top-1/2 transform -translate-y-1/2"
                    fallbackColor="text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by page name or metric type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      <ConfiguredIcon
                        iconName="X"
                        iconConfig={iconConfigs['X']}
                        size="w-4 h-4"
                        fallbackColor="currentColor"
                      />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStats.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  {searchQuery ? (
                    <>
                      <ConfiguredIcon
                        iconName="Search"
                        iconConfig={iconConfigs['Search']}
                        size="w-12 h-12"
                        className="mx-auto mb-4"
                        fallbackColor="text-slate-500"
                      />
                      <p>No results found for "{searchQuery}"</p>
                      <Button
                        onClick={() => setSearchQuery('')}
                        variant="outline"
                        className="mt-4 btn-secondary-coherosphere"
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <ConfiguredIcon
                        iconName="CircleGauge"
                        iconConfig={iconConfigs['CircleGauge']}
                        size="w-12 h-12"
                        className="mx-auto mb-4"
                        fallbackColor="text-slate-500"
                      />
                      <p>No performance data available for the selected filters.</p>
                      <p className="text-sm mt-2">Try selecting "All Time" or "All Types" to see historical data.</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {searchQuery && (
                    <div className="mb-4 text-sm text-slate-400">
                      Found {filteredStats.length} result{filteredStats.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </div>
                  )}
                  <div className="space-y-2">
                    {filteredStats.map((stat, index) => {
                      const badgeInfo = getMetricBadge(stat.median, stat.metric_type);
                      const pageUrl = createPageUrl(stat.page_name);
                      const itemKey = `${stat.page_name}::${stat.metric_type}`;
                      const isExpanded = expandedItem === itemKey;
                      const measurements = recentMeasurements[itemKey] || [];
                      const isLoadingThis = loadingMeasurements[itemKey] || false;
                      const cachePreset = getCachePreset(pageUrl);

                      return (
                        <motion.div
                          key={itemKey}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className="bg-slate-900/50 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all overflow-hidden">
                            <button
                              onClick={() => toggleExpand(stat.page_name, stat.metric_type)}
                              className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-orange-500/50 rounded-lg"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-white font-semibold text-lg font-mono">
                                      {pageUrl}
                                    </span>
                                    <Link to={pageUrl} target="_blank" rel="noopener noreferrer">
                                      <ConfiguredIcon
                                        iconName="ExternalLink"
                                        iconConfig={iconConfigs['ExternalLink']}
                                        size="w-4 h-4"
                                        fallbackColor="text-slate-400"
                                      />
                                    </Link>
                                    {isExpanded ? (
                                      <ConfiguredIcon
                                        iconName="ChevronUp"
                                        iconConfig={iconConfigs['ChevronUp']}
                                        size="w-5 h-5"
                                        fallbackColor="text-orange-400"
                                      />
                                    ) : (
                                      <ConfiguredIcon
                                        iconName="ChevronDown"
                                        iconConfig={iconConfigs['ChevronDown']}
                                        size="w-5 h-5"
                                        fallbackColor="text-slate-400"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-slate-700 text-slate-300">
                                      {stat.metric_type}
                                    </Badge>
                                    <Badge className={`${badgeInfo.bg} ${badgeInfo.text} border ${badgeInfo.border}`}>
                                      {badgeInfo.label}
                                    </Badge>
                                    {cachePreset && (
                                      <Badge className={getPresetBadgeClass(cachePreset)}>
                                        {cachePreset}
                                      </Badge>
                                    )}
                                    <span className="text-slate-500 text-sm">{stat.count} measurements</span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className={`text-2xl font-bold ${getMetricColor(stat.min, stat.metric_type)}`}>
                                    {Math.round(stat.min)}ms
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Min</div>
                                </div>

                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className={`text-2xl font-bold ${getMetricColor(stat.median, stat.metric_type)}`}>
                                    {Math.round(stat.median)}ms
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Median</div>
                                </div>

                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className={`text-2xl font-bold ${getMetricColor(stat.avg, stat.metric_type)}`}>
                                    {Math.round(stat.avg)}ms
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Average</div>
                                </div>

                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className={`text-2xl font-bold ${getMetricColor(stat.max, stat.metric_type)}`}>
                                    {Math.round(stat.max)}ms
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Max</div>
                                </div>
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  className="border-t border-slate-700"
                                >
                                  <div className="p-4 bg-slate-900/30">
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                      <ConfiguredIcon
                                        iconName="Clock"
                                        iconConfig={iconConfigs['Clock']}
                                        size="w-4 h-4"
                                        fallbackColor="text-orange-400"
                                      />
                                      Latest 10 Measurements
                                      {isLoadingThis && (
                                        <span className="text-sm text-slate-400">(Loading...)</span>
                                      )}
                                    </h4>
                                    
                                    {isLoadingThis ? (
                                      <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                          <div key={i} className="h-14 bg-slate-700/30 animate-pulse rounded-lg" />
                                        ))}
                                      </div>
                                    ) : measurements.length === 0 ? (
                                      <p className="text-slate-400 text-sm">No measurements found for this period.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {measurements.map((measurement, idx) => (
                                          <div
                                            key={measurement.id || idx}
                                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                                          >
                                            <div className="flex items-center gap-3 mb-1 sm:mb-0">
                                              <span className="text-slate-500 text-xs font-mono">#{idx + 1}</span>
                                              <span className="text-slate-300 text-sm font-mono">
                                                {formatTimestamp(measurement.timestamp)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              {measurement.metadata?.error && (
                                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                                  Error
                                                </Badge>
                                              )}
                                              <span className={`text-lg font-bold font-mono ${getMetricColor(measurement.value_ms, stat.metric_type)}`}>
                                                {Math.round(measurement.value_ms)}ms
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <BreakdownSkeleton />
      )}
    </div>
  );
}
