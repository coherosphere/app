
import React, { useState, useEffect, useCallback } from "react";
import { AdminSettings } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Removed: import { checkNostrActivity } from "@/api/functions"; // Replaced by base44.functions.invoke
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";

import ActivityItem from "@/components/activity/ActivityItem";
import ActivityFilters from "@/components/activity/ActivityFilters";
import ActivityStats from "@/components/activity/ActivityStats";
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachingPolicy } from '@/components/caching/CachingPolicyContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function Activity() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { setLoading } = useLoading();
  const { getSettingsForDomain } = useCachingPolicy();
  const queryClient = useQueryClient();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
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
    () => base44.functions.invoke('checkNostrActivity', { source: 'activity_page' }), // Changed from checkNostrActivity
    'activity'
  );

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
    
    // LOG: Show when fresh data arrives from backend
    console.log('[Activity] Received data from backend:', {
      eventCount: data.events?.length || 0,
      timestamp: data.lastChecked,
      relayCount: data.relayCount,
      totalRelays: data.totalRelays
    });

    // Check for API error
    if (data.error) {
      setError(data.error);
      return;
    } else {
      setError(null);
    }

    const newActivities = data.events || [];
    const newRelayInfo = { connected: data.relayCount || 0, total: data.totalRelays || 0 };
    const newEventStats = data.eventStats || {};

    // Create a stable hash from activities
    const activityHash = newActivities
      .map(activity => `${activity.id}:${activity.type}:${activity.timestamp}`)
      .join('|');

    // For initial load, always set data
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

    // For subsequent updates, only update if hash changed
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
  useEffect(() => {
    // Stats ready when data loaded and activities available
    if (!isLoadingActivities && activities.length >= 0) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [isLoadingActivities, activities]);

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
    
    // First, invalidate the cache to mark it as stale
    queryClient.invalidateQueries({ queryKey: ['activity', 'nostr'] });
    
    // Then force a refetch (which will now definitely hit the backend)
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

  // Memoize stats
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

  // Skeleton Components
  const StatsSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded mx-auto mb-1.5" />
            <div className="h-6 w-12 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5" />
            <div className="h-3 w-20 bg-slate-700/30 animate-pulse rounded mx-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

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

      {/* Activity Stats - Progressive Loading */}
      {sectionsReady.stats ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0 }}
        >
          <ActivityStats
            totalEvents={stats.totalEvents}
            posts={stats.posts}
            mentions={stats.mentions}
            replies={stats.replies}
            reactions={stats.reactions}
            zapsIn={stats.zapsIn}
            zapsOut={stats.zapsOut}
            totalZapAmountIn={stats.totalZapAmountIn}
            totalZapAmountOut={stats.totalZapAmountOut}
            isLoading={false}
            iconConfigs={iconConfigs}
          />
        </motion.div>
      ) : (
        <StatsSkeleton />
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
                  {/* Pagination Buttons */}
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

                  {/* Page Info */}
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
