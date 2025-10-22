
import React, { useState, useEffect, useCallback } from "react";
import { AdminSettings } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";

import ActivityItem from "@/components/activity/ActivityItem";
import ActivityFilters from "@/components/activity/ActivityFilters";
// Removed: import ActivityStats from "@/components/activity/ActivityStats"; // Replaced by dynamic stats
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachingPolicy } from '@/components/caching/CachingPolicyContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard'; // Added
import { ChevronLeft, ChevronRight } from 'lucide-react'; // Added
import { Link } from 'react-router-dom'; // Added
import { createPageUrl } from '@/utils'; // Added

// Skeleton für einzelne StatCard
const StatCardSkeleton = () => (
  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
    <CardContent className="p-3 h-full flex flex-col justify-center text-center">
      <div className="flex justify-center mb-1.5">
        <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
      </div>
      <div className="h-6 w-12 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5" />
      <div className="h-3 w-20 bg-slate-700/30 animate-pulse rounded mx-auto" />
    </CardContent>
  </Card>
);

export default function Activity() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { setLoading } = useLoading();
  const { getSettingsForDomain } = useCachingPolicy();
  const queryClient = useQueryClient();
  const { iconConfigs } = useAllIconConfigs();

  // States für Mobile-Scroll-Navigation
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = React.useRef(null);

  // Progressive Loading States - identisch zu Treasury (ohne oldStats)
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,    // Neue dynamische Stats
    filters: false,
    activities: false
  });

  // Responsive items per page: 10 on mobile, 20 on desktop
  const getItemsPerPage = () => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 20;
  };

  const [itemsPerPage, setItemsPerPage] = React.useState(getItemsPerPage());

  // Update items per page on window resize
  React.useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = getItemsPerPage();
      if (newItemsPerPage !== itemsPerPage) {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [itemsPerPage]);

  // Use cached data with automatic polling
  const {
    data: apiData,
    isLoading: isLoadingActivities,
    error: activitiesError,
    refetch: refetchActivities
  } = useCachedData(
    ['activity', 'nostr'],
    () => base44.functions.invoke('checkNostrActivity', { source: 'activity_page' }),
    'activity'
  );

  // --- Daten laden für Stats ---
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['activity', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'activity'
  );

  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['activity', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'activity'
  );

  const { data: appConfigList = [] } = useCachedData(
    ['activity', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'activity'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;

  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Activity'] || appConfig?.stat_display_order || [];

  // Stable state for activities
  const [activities, setActivities] = useState([]);
  const [relayInfo, setRelayInfo] = useState({ connected: 0, total: 0 });
  const [eventStats, setEventStats] = useState({});
  const lastActivityHashRef = React.useRef(null);
  const hasInitializedRef = React.useRef(false);

  // Sync loading state with global loading context
  useEffect(() => {
    setLoading(isLoadingActivities);
  }, [isLoadingActivities, setLoading]);

  // Process and update activities ONLY when data actually changes
  useEffect(() => {
    if (!apiData?.data) {
      console.log('[Activity] No API data yet');
      return;
    }

    const data = apiData.data;
    
    console.log('[Activity] Received data from backend:', {
      eventCount: data.events?.length || 0,
      timestamp: data.lastChecked,
      relayCount: data.relayCount,
      totalRelays: data.totalRelays
    });

    if (data.error) {
      setError(data.error);
      return;
    } else {
      setError(null);
    }

    const newActivities = data.events || [];
    const newRelayInfo = { connected: data.relayCount || 0, total: data.totalRelays || 0 };
    const newEventStats = data.eventStats || {};

    const activityHash = newActivities
      .map(activity => `${activity.id}:${activity.type}:${activity.timestamp}`)
      .join('|');

    if (!hasInitializedRef.current && newActivities.length > 0) {
      console.log('[Activity] Initial activities load:', {
        count: newActivities.length,
        hash: activityHash.substring(0, 50) + '...'
      });
      lastActivityHashRef.current = activityHash;
      hasInitializedRef.current = true;
      setActivities(newActivities);
      setRelayInfo(newRelayInfo);
      setEventStats(newEventStats);
      return;
    }

    if (hasInitializedRef.current && activityHash !== lastActivityHashRef.current) {
      console.log('[Activity] Activities changed:', {
        oldHash: lastActivityHashRef.current ? lastActivityHashRef.current.substring(0, 50) + '...' : 'none',
        newHash: activityHash.substring(0, 50) + '...',
        oldCount: activities.length,
        newCount: newActivities.length
      });
      lastActivityHashRef.current = activityHash;
      setActivities(newActivities);
      setRelayInfo(newRelayInfo);
      setEventStats(newEventStats);
    } else if (hasInitializedRef.current) {
      console.log('[Activity] No changes detected, skipping update');
    }
  }, [apiData]);

  // Track when each section's data is ready (parallel loading)
  // ENTFERNT: useEffect für oldStats
  
  useEffect(() => {
    // New stats ready when config and values loaded
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  useEffect(() => {
    // Filters ready when activities loaded
    if (!isLoadingActivities && activities.length >= 0) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [isLoadingActivities, activities]);

  useEffect(() => {
    // Activities list ready when data loaded
    if (!isLoadingActivities && activities.length >= 0) {
      setSectionsReady(prev => ({ ...prev, activities: true }));
    }
  }, [isLoadingActivities, activities]);

  // Map für schnellen Zugriff auf Stat-Werte
  const valueMap = React.useMemo(() => {
    const map = {};
    allValues.forEach(value => {
      map[value.stat_key] = value;
    });
    return map;
  }, [allValues]);

  // Aktive Stat-Konfigurationen für Activity-Seite filtern
  const activeStatsForThisPage = React.useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Activity')
    );
  }, [allStats]);

  // Sortierte Stat-Konfigurationen basierend auf displayOrder
  const sortedStatConfigs = React.useMemo(() => {
    if (!displayOrder || displayOrder.length === 0) {
      return [...activeStatsForThisPage].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const configMap = new Map(activeStatsForThisPage.map(config => [config.stat_key, config]));
    const ordered = [];
    const unordered = [];

    displayOrder.forEach(key => {
      if (configMap.has(key)) {
        ordered.push(configMap.get(key));
        configMap.delete(key);
      }
    });

    unordered.push(...Array.from(configMap.values()));
    unordered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return [...ordered, ...unordered];
  }, [activeStatsForThisPage, displayOrder]);

  // Funktion zur Formatierung des Stat-Wertes
  const formatStatValue = useCallback((config, value) => {
    if (!value) return '—';

    const rawValue = value.value_number !== null ? value.value_number : value.value_string;

    if (rawValue === null || rawValue === undefined) return '—';

    switch (config.format_hint) {
      case 'number':
        return typeof rawValue === 'number' ? rawValue.toLocaleString() : String(rawValue);
      case 'currency':
        // For currencies, add two decimal places for satoshis / fractions
        return typeof rawValue === 'number' ? rawValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(rawValue);
      case 'percentage':
        return typeof rawValue === 'number' ? `${rawValue.toLocaleString()}%` : String(rawValue);
      case 'time':
        return String(rawValue);
      default:
        return String(rawValue);
    }
  }, []);

  // Mobile-Scroll-Position überprüfen
  const checkScrollPosition = useCallback(() => {
    const container = mobileStatsScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;

    // Check if the scrollWidth is greater than clientWidth to enable arrows
    if (scrollWidth <= clientWidth) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }

    setShowLeftArrow(scrollLeft > 20);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
  }, []);

  // Mobile-Scroll handhaben
  const handleScroll = useCallback((direction) => {
    const container = mobileStatsScrollRef.current;
    if (!container) return;

    const scrollAmount = 140; // Roughly the width of a StatCard + gap
    const { scrollLeft, scrollWidth, clientWidth } = container;

    if (direction === 'left') {
      let newScrollLeft = scrollLeft - scrollAmount;
      if (newScrollLeft < 0) {
        newScrollLeft = scrollWidth - clientWidth; // Loop to end
      }
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    } else {
      let newScrollLeft = scrollLeft + scrollAmount;
      if (newScrollLeft > scrollWidth - clientWidth) {
        newScrollLeft = 0; // Loop to beginning
      }
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  }, []);

  // Effect für Mobile-Scroll-Logik
  useEffect(() => {
    const container = mobileStatsScrollRef.current;
    if (!container || sortedStatConfigs.length === 0) return;

    checkScrollPosition(); // Initial check
    const handleResize = () => checkScrollPosition();
    const handleScrollEvent = () => checkScrollPosition();

    window.addEventListener('resize', handleResize);
    container.addEventListener('scroll', handleScrollEvent);

    // Re-check scroll position if stats change (e.g., loaded)
    const timeoutId = setTimeout(checkScrollPosition, 100); 

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('scroll', handleScrollEvent);
      clearTimeout(timeoutId);
    };
  }, [checkScrollPosition, sortedStatConfigs]);


  // Render-Funktionen für Stat-Karten
  const renderStatCardsMobile = () => {
    return sortedStatConfigs.map((config) => {
      const value = valueMap[config.stat_key];
      const formattedValue = formatStatValue(config, value);

      return (
        <div key={config.id} className="snap-start flex-shrink-0 w-[128px]">
          <StatCard
            iconName={config.icon_name}
            iconConfig={iconConfigs[config.icon_name]}
            value={formattedValue}
            label={config.display_name}
            isLoading={statsValuesLoading}
          />
        </div>
      );
    });
  };

  const renderStatCardsGridDesktop = () => {
    return sortedStatConfigs.map((config) => {
      const value = valueMap[config.stat_key];
      const formattedValue = formatStatValue(config, value);

      return (
        <StatCard
          key={config.id}
          iconName={config.icon_name}
          iconConfig={iconConfigs[config.icon_name]}
          value={formattedValue}
          label={config.display_name}
          isLoading={statsValuesLoading}
        />
      );
    });
  };

  // Memoize filtered activities
  const filteredActivities = React.useMemo(() => {
    console.log('[Activity] === FILTER DEBUG START ===');
    console.log('[Activity] Filtering with selectedFilter:', selectedFilter);
    console.log('[Activity] Total activities:', activities.length);
    
    // DEBUG: Log ALL activity types we have
    const allTypes = [...new Set(activities.map(a => a.type))];
    console.log('[Activity] ALLE verfügbaren Activity-Types:', allTypes);
    
    // DEBUG: Log first 3 activities to see their structure
    console.log('[Activity] First 3 activities:', activities.slice(0, 3).map(a => ({
      id: a.id,
      type: a.type,
      from: a.from_name,
      content: a.content?.substring(0, 50)
    })));
    
    if (selectedFilter === 'all') {
      return activities;
    }
    
    const filtered = activities.filter(activity => {
      // Separate Zap-In filter (includes zap-in and zap-request)
      if (selectedFilter === 'zap-in') {
        return activity.type === 'zap-in' || activity.type === 'zap-request';
      }
      
      // Separate Zap-Out filter
      if (selectedFilter === 'zap-out') {
        return activity.type === 'zap-out';
      }
      
      // Post filter: includes 'post' and 'reply'
      if (selectedFilter === 'post') {
        return activity.type === 'post' || activity.type === 'reply';
      }
      
      // Reaction filter: includes 'reaction' and 'repost'
      if (selectedFilter === 'reaction') {
        return activity.type === 'reaction' || activity.type === 'repost';
      }
      
      // Mention filter
      if (selectedFilter === 'mention') {
        return activity.type === 'mention';
      }
      
      // Reply filter
      if (selectedFilter === 'reply') {
        return activity.type === 'reply';
      }
      
      // Default: exact match
      return activity.type === selectedFilter;
    });
    
    console.log('[Activity] Filtered to:', filtered.length, 'activities');
    console.log('[Activity] Types in filtered result:', [...new Set(filtered.map(a => a.type))]);
    console.log('[Activity] === FILTER DEBUG END ===');
    
    return filtered;
  }, [activities, selectedFilter]);

  // Memoize paginated activities
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  
  const paginatedActivities = React.useMemo(() => {
    return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredActivities, startIndex, itemsPerPage]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Force refresh - invalidate cache and refetch
  const handleRefresh = async () => {
    console.log('[Activity] Manual refresh triggered - invalidating cache and forcing backend call');
    
    queryClient.invalidateQueries({ queryKey: ['activity', 'nostr'] });
    
    await refetchActivities();
  };

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Memoize activity counts
  const activityCounts = React.useMemo(() => ({
    all: activities.length,
    post: eventStats.posts || 0,
    mention: eventStats.mentions || 0,
    reply: eventStats.replies || 0,
    reaction: eventStats.reactions || 0,
    'zap-in': eventStats.zapsIn || 0,
    'zap-out': eventStats.zapsOut || 0,
  }), [activities.length, eventStats]);

  // The old 'stats' memoization is no longer directly used in JSX
  // as ActivityStats component is removed, but keeping it in case
  // it was intended for other internal logic or derived values.
  const stats = React.useMemo(() => ({
    totalEvents: activities.length,
    posts: eventStats.posts || 0,
    mentions: eventStats.mentions || 0,
    replies: eventStats.replies || 0,
    reactions: eventStats.reactions || 0,
    zapsIn: eventStats.zapsIn || 0,
    zapsOut: eventStats.zapsOut || 0,
    totalZapAmountIn: eventStats.totalZapAmountIn || 0,
    totalZapAmountOut: eventStats.totalZapAmountOut || 0,
  }), [activities.length, eventStats]);


  // Skeleton Components - identisch zu Treasury
  const FiltersSkeleton = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-10 w-28 bg-slate-700/30 animate-pulse rounded-full" />
      ))}
    </div>
  );

  const ActivitiesSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                <div className="h-7 w-24 bg-slate-700 animate-pulse rounded" />
                <div className="h-5 w-32 bg-slate-700 animate-pulse rounded" />
              </div>
              <div className="h-5 w-12 bg-slate-700 animate-pulse rounded" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 w-full bg-slate-700 animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-slate-700 animate-pulse rounded" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-700">
              <div className="h-4 w-32 bg-slate-700 animate-pulse rounded" />
              <div className="h-4 w-4 bg-slate-700 animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <ConfiguredIcon 
              iconName="Globe2"
              iconConfig={iconConfigs['Globe2']}
              size="w-12 h-12"
              className="flex-shrink-0"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                Nostr Activity Feed
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-lg text-slate-400 leading-relaxed" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Real-time coherosphere community activity from the Nostr network.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 bg-orange-500/10 border-orange-500/30">
          <ConfiguredIcon 
            iconName="AlertTriangle"
            iconConfig={iconConfigs['AlertTriangle']}
            size="w-4 h-4"
          />
          <AlertDescription className="text-orange-400">{error}</AlertDescription>
        </Alert>
      )}

      {/* Dynamic Stats Section - KORRIGIERT: Identisch zu Treasury */}
      {statsConfigLoading ? (
        <div className="mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl h-[98px] overflow-hidden">
            <div className="p-3 h-full flex items-center justify-center">
              <div className="text-slate-500 text-xs">Loading statistics...</div>
            </div>
          </div>
        </div>
      ) : sortedStatConfigs.length > 0 ? (
        <>
          {/* Mobile Ansicht: Horizontales Scrollen */}
          <motion.div
            className="lg:hidden mb-8 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="bg-transparent border-none p-0 m-0">
              <div className="relative">
                {showLeftArrow && (
                  <button
                    onClick={() => handleScroll('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-full p-2 hover:bg-slate-800 transition-colors"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                <div
                  ref={mobileStatsScrollRef}
                  className="flex gap-3 overflow-x-auto px-3 py-3 snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
                >
                  {renderStatCardsMobile()}
                </div>

                {showRightArrow && (
                  <button
                    onClick={() => handleScroll('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-full p-2 hover:bg-slate-800 transition-colors"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Desktop Ansicht: Grid */}
          <motion.div
            className="hidden lg:grid mb-8"
            style={{
              gridTemplateColumns: `repeat(${sortedStatConfigs.length}, 1fr)`,
              gap: '1rem'
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {renderStatCardsGridDesktop()}
          </motion.div>
        </>
      ) : (
        <div className="mb-8 text-center py-8 text-slate-400">
          <p>No stats configured for Activity. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}
      
      {/* Activity Filters - Progressive Loading */}
      {sectionsReady.filters ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <ActivityFilters
            selectedFilter={selectedFilter}
            onFilterChange={handleFilterChange}
            activityCounts={activityCounts}
            iconConfigs={iconConfigs}
          />
        </motion.div>
      ) : (
        <FiltersSkeleton />
      )}

      {/* Activity Stream - Progressive Loading */}
      {sectionsReady.activities ? (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          {paginatedActivities.length === 0 ? (
            <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700">
              <CardContent className="p-12 text-center">
                <ConfiguredIcon 
                  iconName="Globe2"
                  iconConfig={iconConfigs['Globe2']}
                  size="w-12 h-12"
                  className="mx-auto mb-4"
                />
                <p className="text-slate-400">
                  {selectedFilter === 'all' ? 'No activities found' : `No ${selectedFilter.replace('-', ' ')} activities found`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedActivities.map((activity, index) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  index={index}
                  iconConfigs={iconConfigs}
                />
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <motion.div
                  className="pt-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.15 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="ghost"
                      className={`filter-chip h-auto ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      ←
                    </Button>

                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1) 
                        )
                        .map((page, index, arr) => (
                          <React.Fragment key={page}>
                            {index > 0 && arr[index - 1] !== page - 1 && (
                              <span className="text-slate-500 px-2">...</span>
                            )}
                            <Button
                              onClick={() => handlePageChange(page)}
                              variant="ghost"
                              className={`filter-chip h-auto w-10 ${currentPage === page ? 'active' : ''}`}
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        ))
                      }
                    </div>

                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="ghost"
                      className={`filter-chip h-auto ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      →
                    </Button>
                  </div>

                  <div className="text-slate-400 text-sm text-center">
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredActivities.length)} of {filteredActivities.length} activities
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      ) : (
        <ActivitiesSkeleton />
      )}
    </div>
  );
}
