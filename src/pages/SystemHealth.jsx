
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { useCachedData } from '@/components/caching/useCachedData';
import { useQueryClient } from '@tanstack/react-query'; // Added import for useQueryClient

export default function SystemHealth() {
  const { iconConfigs } = useAllIconConfigs();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Initial loading for user check
  const [runningChecks, setRunningChecks] = useState({});
  const [message, setMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRefreshSkeleton, setShowRefreshSkeleton] = useState(false); // New state for refresh skeleton
  const itemsPerPage = 15;
  const queryClient = useQueryClient(); // Initialized useQueryClient
  const previousDataRef = useRef(null); // Ref to store previous data for comparison

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // Load health check results with caching and 10-second polling
  const { data: allResults = [], isLoading: loadingResults, refetch: refetchResults } = useCachedData(
    ['system-health', 'results'],
    () => base44.entities.SystemHealthCheckResult.list('-timestamp', 5000),
    'activity', // Using 'activity' domain for fresh data
    {
      refetchInterval: 10000, // Poll every 10 seconds
      refetchIntervalInBackground: true,
      onSuccess: (newData) => {
        // Check if data has actually changed
        // Using JSON.stringify for a deep comparison. For very large datasets, a more optimized comparison might be needed.
        if (previousDataRef.current && JSON.stringify(previousDataRef.current) !== JSON.stringify(newData)) {
          console.log('[SystemHealth] New data detected, showing refresh skeleton');
          setShowRefreshSkeleton(true);
          // Hide skeleton after a short delay (e.g., 300ms)
          setTimeout(() => setShowRefreshSkeleton(false), 300);
        }
        previousDataRef.current = newData;
      }
    }
  );

  // Define available health checks
  const healthChecks = [
    {
      id: 'mempool_api',
      name: 'Mempool API',
      description: 'Checks Bitcoin mempool.space API availability and block height',
      icon: 'Activity'
    },
    {
      id: 'alby_api',
      name: 'Alby Lightning',
      description: 'Checks Alby Lightning wallet API connectivity and balance',
      icon: 'Zap'
    },
    {
      id: 'nostr_relays',
      name: 'Nostr Relays',
      description: 'Monitors health of configured Nostr relay endpoints',
      icon: 'Radio'
    }
  ];

  // Calculate stats
  const stats = React.useMemo(() => {
    const totalChecks = allResults.length;
    const successfulChecks = allResults.filter(r => r.status === 'success').length;
    const failedChecks = allResults.filter(r => r.status === 'fail').length;
    const degradedChecks = allResults.filter(r => r.status === 'degraded').length;
    
    const avgResponseTime = totalChecks > 0 
      ? Math.round(allResults.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / totalChecks)
      : 0;
    
    // Uptime is generally success + degraded, but here we'll define it as just successful checks for simplicity
    const uptimePercentage = totalChecks > 0 
      ? Math.round((successfulChecks / totalChecks) * 100)
      : 0;

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      degradedChecks,
      avgResponseTime,
      uptimePercentage
    };
  }, [allResults]);

  // Prepare simplified timeline data for last 7 days with detailed counts
  const getTimelineData = () => {
    // Get current date/time
    const now = new Date(); 
    // Calculate the start of the current UTC day (e.g., "2023-10-27T00:00:00.000Z")
    const currentUtcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const last7Days = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Create buckets for each day, ensuring they are UTC-based
    for (let i = 6; i >= 0; i--) {
      // Calculate the start of the UTC day for each of the last 7 days
      // `subDays` on a UTC Date object will subtract days while keeping it a UTC Date.
      const targetUtcDay = subDays(currentUtcDayStart, i); 
      
      const year = targetUtcDay.getUTCFullYear();
      const month = targetUtcDay.getUTCMonth(); // 0-indexed
      const dayOfMonth = targetUtcDay.getUTCDate();

      // This string will be the consistent key for UTC day grouping
      const fullDateUtcString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      
      last7Days.push({
        // Manually construct 'MMM dd' to ensure it reflects the UTC day
        date: `${monthNames[month]} ${dayOfMonth}`, 
        fullDate: fullDateUtcString,
        timestamp: targetUtcDay.getTime()
      });
    }

    // Helper to map actual check_name from results to the simplified name from healthChecks array
    const getSimplifiedCheckName = (fullCheckName) => {
        if (fullCheckName.includes('Mempool')) return 'Mempool API';
        if (fullCheckName.includes('Alby')) return 'Alby Lightning';
        if (fullCheckName.includes('Nostr')) return 'Nostr Relays';
        return fullCheckName; // Fallback
    };

    // Group results by check and day with detailed counts
    const checkStatuses = {};
    healthChecks.forEach(check => {
      checkStatuses[check.name] = {};
      last7Days.forEach(day => {
        checkStatuses[check.name][day.fullDate] = { // Use the UTC fullDate string as key
          status: null,
          success: 0,
          degraded: 0,
          fail: 0,
          total: 0
        };
      });
    });

    // Fill in actual results
    allResults.forEach((result, index) => {
      // Parse timestamp (assumed ISO string) into a Date object (represents UTC instant)
      const timestamp = new Date(result.timestamp); 
      // Extract UTC year, month, day to get the UTC date string for grouping
      const resultDateUtcString = `${timestamp.getUTCFullYear()}-${(timestamp.getUTCMonth() + 1).toString().padStart(2, '0')}-${timestamp.getUTCDate().toString().padStart(2, '0')}`;
      const simplifiedCheckName = getSimplifiedCheckName(result.check_name);
      
      if (checkStatuses[simplifiedCheckName] && checkStatuses[simplifiedCheckName][resultDateUtcString]) {
        const dayData = checkStatuses[simplifiedCheckName][resultDateUtcString];
        
        // Count the results
        dayData.total++;
        if (result.status === 'success') dayData.success++;
        else if (result.status === 'degraded') dayData.degraded++;
        else if (result.status === 'fail') dayData.fail++;
        
        // Determine worst-case status for display for this specific check on this UTC day
        if (dayData.fail > 0) {
          dayData.status = 'fail';
        } else if (dayData.degraded > 0) {
          dayData.status = 'degraded';
        } else if (dayData.success > 0) { // Only set to success if no failures or degraded checks
          dayData.status = 'success';
        }
      }
    });

    return { days: last7Days, checkStatuses };
  };

  const timelineData = getTimelineData();

  // Get latest result for each check - This function is no longer strictly used for the compact design cards,
  // but keeping it as it might be used elsewhere or in future extensions.
  const getLatestResult = (checkName) => {
    // Filter by simplified check name to match the healthChecks array
    const simplifiedCheckName = (() => {
        if (checkName.includes('Mempool')) return 'Mempool API';
        if (checkName.includes('Alby')) return 'Alby Lightning';
        if (checkName.includes('Nostr')) return 'Nostr Relays';
        return checkName;
    })();

    const results = allResults.filter(r => {
        const resultSimplifiedName = (() => {
            if (r.check_name.includes('Mempool')) return 'Mempool API';
            if (r.check_name.includes('Alby')) return 'Alby Lightning';
            if (r.check_name.includes('Nostr')) return 'Nostr Relays';
            return r.check_name;
        })();
        return resultSimplifiedName === simplifiedCheckName;
    });
    return results.length > 0 ? results[0] : null;
  };

  // Run a health check
  const runCheck = async (checkType) => {
    setRunningChecks(prev => ({ ...prev, [checkType]: true }));
    setMessage(null);

    try {
      const response = await base44.functions.invoke('runHealthCheck', { 
        check_type: checkType,
        source: 'status_page'
      });
      
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `✓ ${response.data.check_name}: ${response.data.message}`
        });
      } else {
        setMessage({
          type: 'error',
          text: `✗ Check failed: ${response.data.message || 'Unknown error'}`
        });
      }

      // Refresh results
      await refetchResults();
    } catch (error) {
      console.error('Error running check:', error);
      setMessage({
        type: 'error',
        text: `Error: ${error.message}`
      });
    } finally {
      setRunningChecks(prev => ({ ...prev, [checkType]: false }));
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    if (status === 'success') {
      return (
        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
          <ConfiguredIcon
            iconName="CheckCircle"
            iconConfig={iconConfigs['CheckCircle']}
            size="w-3 h-3"
            className="mr-1"
            fallbackColor="currentColor"
          />
          Healthy
        </Badge>
      );
    }
    if (status === 'degraded') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
          <ConfiguredIcon
            iconName="AlertTriangle"
            iconConfig={iconConfigs['AlertTriangle']}
            size="w-3 h-3"
            className="mr-1"
            fallbackColor="currentColor"
          />
          Degraded
        </Badge>
      );
    }
    if (status === 'fail') {
      return (
        <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
          <ConfiguredIcon
            iconName="XCircle"
            iconConfig={iconConfigs['XCircle']}
            size="w-3 h-3"
            className="mr-1"
            fallbackColor="currentColor"
          />
          Failed
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">
        <ConfiguredIcon
          iconName="HelpCircle"
          iconConfig={iconConfigs['HelpCircle']}
          size="w-3 h-3"
          className="mr-1"
          fallbackColor="currentColor"
        />
        Unknown
      </Badge>
    );
  };

  // Pagination logic
  const totalPages = Math.ceil(allResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResults = allResults.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Access Denied
  if (!isLoading && currentUser?.role !== 'admin') {
    return (
      <div className="p-8 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="p-8 text-center">
            <ConfiguredIcon
              iconName="Shield"
              iconConfig={iconConfigs['Shield']}
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

  // Show loading skeleton for stats if initial loading or refreshing
  const showStatsSkeleton = loadingResults || showRefreshSkeleton;

  return (
    <div className="p-4 lg:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon
            iconName="Server"
            iconConfig={iconConfigs['Server']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-orange-500"
            />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              System Health Monitoring
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Monitor the health of external APIs and critical system components
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
      >
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="Activity"
                iconConfig={iconConfigs['Activity']}
                size="w-5 h-5"
                fallbackColor="text-slate-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-white mb-0.5">
                  {stats.totalChecks}
                </div>
                <div className="text-slate-400 text-xs">Last Checks</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="CheckCircle"
                iconConfig={iconConfigs['CheckCircle']}
                size="w-5 h-5"
                fallbackColor="text-green-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-green-400 mb-0.5">
                  {stats.successfulChecks}
                </div>
                <div className="text-slate-400 text-xs">Successful</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="XCircle"
                iconConfig={iconConfigs['XCircle']}
                size="w-5 h-5"
                fallbackColor="text-red-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-red-400 mb-0.5">
                  {stats.failedChecks}
                </div>
                <div className="text-slate-400 text-xs">Failed</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="AlertTriangle"
                iconConfig={iconConfigs['AlertTriangle']}
                size="w-5 h-5"
                fallbackColor="text-yellow-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-yellow-400 mb-0.5">
                  {stats.degradedChecks}
                </div>
                <div className="text-slate-400 text-xs">Degraded</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="Clock"
                iconConfig={iconConfigs['Clock']}
                size="w-5 h-5"
                fallbackColor="text-blue-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-white mb-0.5">
                  {stats.avgResponseTime}ms
                </div>
                <div className="text-slate-400 text-xs">Avg Response</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
          <CardContent className="p-3 h-full flex flex-col justify-center text-center">
            <div className="flex justify-center mb-1.5">
              <ConfiguredIcon 
                iconName="TrendingUp"
                iconConfig={iconConfigs['TrendingUp']}
                size="w-5 h-5"
                fallbackColor="text-orange-400"
              />
            </div>
            {showStatsSkeleton ? (
              <div className="space-y-0.5"> {/* Adjusted space-y */}
                <div className="h-5 w-16 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
                <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" /> {/* Adjusted height */}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-white mb-0.5">
                  {stats.uptimePercentage}%
                </div>
                <div className="text-slate-400 text-xs">Uptime</div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Health Timeline - Horizontal Bars */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ConfiguredIcon
                iconName="TrendingUp"
                iconConfig={iconConfigs['TrendingUp']}
                size="w-5 h-5"
                fallbackColor="text-orange-400"
              />
              Health Status Timeline (Last 7 Days - UTC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allResults.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No health check data available yet</p>
            ) : (
              <div className="space-y-4">
                {/* Day Labels */}
                <div className="flex items-center">
                  <div className="w-32 flex-shrink-0"></div>
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {timelineData.days.map((day, index) => (
                      <div key={index} className="text-center text-xs text-slate-400" title={day.fullDate}>
                        {day.date}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health Check Rows */}
                {healthChecks.map((check, checkIndex) => (
                  <div key={checkIndex} className="flex items-center">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-sm text-slate-300 font-medium">{check.name}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-7 gap-1">
                      {timelineData.days.map((day, dayIndex) => {
                        const dayData = timelineData.checkStatuses[check.name][day.fullDate];
                        const status = dayData.status;
                        let bgColor = 'bg-slate-700/30'; // No data
                        let tooltip = `${day.fullDate} - ${check.name}\nNo data`;
                        
                        if (dayData.total > 0) {
                          const successRate = Math.round((dayData.success / dayData.total) * 100);
                          
                          tooltip = `${day.fullDate} - ${check.name}\nTotal Checks: ${dayData.total}\nSuccess: ${dayData.success} (${successRate}%)\nDegraded: ${dayData.degraded}\nFailed: ${dayData.fail}`;
                          
                          if (status === 'success') {
                            bgColor = 'bg-green-500';
                          } else if (status === 'degraded') {
                            bgColor = 'bg-yellow-500';
                          } else if (status === 'fail') {
                            bgColor = 'bg-red-500';
                          }
                        }

                        return (
                          <div
                            key={`${check.id}-${dayIndex}`}
                            className={`h-8 rounded ${bgColor} transition-all hover:scale-105 cursor-pointer`}
                            title={tooltip}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 pt-4 mt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span className="text-sm text-slate-400">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500"></div>
                    <span className="text-sm text-slate-400">Degraded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-sm text-slate-400">Failed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-700/30"></div>
                    <span className="text-sm text-slate-400">No Data</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Message - NOW PLACED AFTER HEALTH TIMELINE */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            message.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Health Checks - New Compact Design */}
      <div className="space-y-3 mb-8">
        {healthChecks.map((check, index) => {
          const isRunning = runningChecks[check.id];

          return (
            <motion.div
              key={check.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 hover:bg-slate-800/60 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-2">{check.name}</h3>
                      <p className="text-slate-400 text-sm mb-3">{check.description}</p>
                    </div>
                    
                    <Button
                      onClick={() => runCheck(check.id)}
                      disabled={isRunning}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 ml-4"
                    >
                      {isRunning ? (
                        <>
                          <ConfiguredIcon
                            iconName="Loader2"
                            iconConfig={iconConfigs['Loader2']}
                            size="w-4 h-4"
                            className="mr-2 animate-spin"
                            fallbackColor="currentColor"
                          />
                          Running...
                        </>
                      ) : (
                        <>
                          <ConfiguredIcon
                            iconName="PlayCircle"
                            iconConfig={iconConfigs['PlayCircle']}
                            size="w-4 h-4"
                            className="mr-2"
                            fallbackColor="currentColor"
                          />
                          Manual Check
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Recent History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Check History</CardTitle>
          </CardHeader>
          <CardContent>
            {showRefreshSkeleton ? (
              // Short skeleton for refresh indicator (5 items)
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-3 bg-slate-900/50 rounded-lg flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-20 h-5 bg-slate-700 rounded" /> {/* Status Badge */}
                      <div className="flex-1 space-y-1">
                        <div className="w-3/4 h-4 bg-slate-700 rounded" /> {/* Check Name */}
                        <div className="w-1/2 h-3 bg-slate-800 rounded" /> {/* Message */}
                      </div>
                      <div className="w-16 h-5 bg-slate-700 rounded" /> {/* Source Badge */}
                    </div>
                    <div className="ml-4 space-y-1 text-right">
                      <div className="w-24 h-3 bg-slate-800 rounded" /> {/* Timestamp */}
                      <div className="w-12 h-3 bg-slate-800 rounded" /> {/* Duration */}
                    </div>
                  </div>
                ))}
              </div>
            ) : loadingResults ? (
              // Full skeleton for initial loading (itemsPerPage items)
              <div className="space-y-3">
                {[...Array(itemsPerPage)].map((_, i) => (
                  <div key={i} className="p-3 bg-slate-900/50 rounded-lg flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-20 h-5 bg-slate-700 rounded" /> {/* Status Badge */}
                      <div className="flex-1 space-y-1">
                        <div className="w-3/4 h-4 bg-slate-700 rounded" /> {/* Check Name */}
                        <div className="w-1/2 h-3 bg-slate-800 rounded" /> {/* Message */}
                      </div>
                      <div className="w-16 h-5 bg-slate-700 rounded" /> {/* Source Badge */}
                    </div>
                    <div className="ml-4 space-y-1 text-right">
                      <div className="w-24 h-3 bg-slate-800 rounded" /> {/* Timestamp */}
                      <div className="w-12 h-3 bg-slate-800 rounded" /> {/* Duration */}
                    </div>
                  </div>
                ))}
              </div>
            ) : allResults.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No health check history yet</p>
            ) : (
              <>
                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 py-3 px-6 bg-slate-700/30 backdrop-blur-sm border border-slate-700 rounded-t-xl text-slate-300 text-sm font-medium mb-0">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-3">Check Name</div>
                  <div className="col-span-3">Message</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-2 text-right">Timestamp</div>
                  <div className="col-span-1 text-right">Duration</div>
                </div>

                <div className="md:bg-slate-800/50 md:backdrop-blur-sm md:border-x md:border-b md:border-slate-700 md:rounded-b-xl">
                  {paginatedResults.map((result, index) => {
                    // Determine source badge
                    let sourceBadge = null;
                    if (result.triggered_by === 'cron') {
                      sourceBadge = (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Clock"
                            iconConfig={iconConfigs['Clock']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Cron
                        </Badge>
                      );
                    } else if (result.triggered_by === 'status_page') {
                      sourceBadge = (
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Activity"
                            iconConfig={iconConfigs['Activity']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Status Page
                        </Badge>
                      );
                    } else if (result.triggered_by === 'activity_page') {
                      sourceBadge = (
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Globe2"
                            iconConfig={iconConfigs['Globe2']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Activity
                        </Badge>
                      );
                    } else if (result.triggered_by === 'treasury_page') {
                      sourceBadge = (
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Wallet"
                            iconConfig={iconConfigs['Wallet']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Treasury
                        </Badge>
                      );
                    } else if (result.triggered_by === 'donate_page') {
                      sourceBadge = (
                        <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Heart"
                            iconConfig={iconConfigs['Heart']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Donate
                        </Badge>
                      );
                    } else if (result.triggered_by === 'engage_page') {
                      sourceBadge = (
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="Handshake"
                            iconConfig={iconConfigs['Handshake']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Engage
                        </Badge>
                      );
                    } else if (result.triggered_by?.startsWith('user_')) {
                      sourceBadge = (
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                          <ConfiguredIcon 
                            iconName="User"
                            iconConfig={iconConfigs['User']}
                            size="w-3 h-3"
                            className="mr-1"
                            fallbackColor="currentColor"
                          />
                          Manual
                        </Badge>
                      );
                    }

                    return (
                      <div key={result.id}>
                        {/* Desktop Row */}
                        <div className="hidden md:grid grid-cols-12 gap-4 items-center py-4 px-6 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors last:border-b-0">
                          <div className="col-span-1">
                            <StatusBadge status={result.status} />
                          </div>
                          <div className="col-span-3">
                            <p className="text-white text-sm font-medium">{result.check_name}</p>
                          </div>
                          <div className="col-span-3">
                            <p className="text-slate-400 text-xs">{result.message}</p>
                          </div>
                          <div className="col-span-2">
                            {sourceBadge}
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-slate-400 text-xs">
                              {format(new Date(result.timestamp), 'MMM dd, HH:mm:ss')}
                            </p>
                          </div>
                          <div className="col-span-1 text-right">
                            <p className="text-slate-500 text-xs">{result.duration_ms}ms</p>
                          </div>
                        </div>

                        {/* Mobile Card */}
                        <div className="md:hidden mb-4 last:mb-0">
                          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                  <StatusBadge status={result.status} />
                                  <div>
                                    <p className="text-white text-sm font-medium">{result.check_name}</p>
                                    <p className="text-slate-400 text-xs mt-1">{result.message}</p>
                                  </div>
                                </div>
                                {sourceBadge}
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                                <span className="text-slate-400 text-xs">
                                  {format(new Date(result.timestamp), 'MMM dd, HH:mm:ss')}
                                </span>
                                <span className="text-slate-500 text-xs">{result.duration_ms}ms</span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-6">
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
                          .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                          .map((page, index, arr) => (
                            <React.Fragment key={page}>
                              {index > 0 && arr[index - 1] !== page - 1 && <span className="text-slate-500 px-2">...</span>}
                              <Button
                                onClick={() => handlePageChange(page)}
                                variant="ghost"
                                className={`filter-chip h-auto w-10 ${currentPage === page ? 'active' : ''}`}
                              >
                                {page}
                              </Button>
                            </React.Fragment>
                          ))}
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
                      Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, allResults.length)} of {allResults.length} checks
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
