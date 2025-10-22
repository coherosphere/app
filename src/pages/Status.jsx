
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import StatCard from '@/components/StatCard';

// Helper function for Bitcoin transaction amount calculation
const getBitcoinTxAmountHelper = (tx, address) => {
  let received = 0;
  let sent = 0;

  tx.vout?.forEach((output) => {
    if (output.scriptpubkey_address === address) {
      received += output.value;
    }
  });

  tx.vin?.forEach((input) => {
    if (input.prevout?.scriptpubkey_address === address) {
      sent += input.prevout.value;
    }
  });

  const netAmount = received - sent;
  return { amount: Math.abs(netAmount), direction: netAmount > 0 ? 'in' : 'out' };
};

const StatusIndicator = ({ status, name, message, extraInfo, relayStatuses, isLoading, iconConfigs }) => {
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 animate-pulse lg:h-[400px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-6 w-3/4 bg-slate-700 rounded mb-2"></div>
          <div className="w-6 h-6 bg-slate-700 rounded-full"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-1/2 bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-full bg-slate-700 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const isFullyOperational = status === true;

  // Logic for Degraded Status
  let isDegraded = false;
  if (name === "Nostr Relays" && relayStatuses) {
    const total = relayStatuses.length;
    const connected = relayStatuses.filter((r) => r.status === 'connected').length;
    if (connected > 0 && connected < total) {
      isDegraded = true;
    }
  }

  const getStatusConfig = () => {
    if (isDegraded) {
      return {
        cardColor: 'border-orange-500/30',
        iconColor: 'text-orange-400',
        textColor: 'text-orange-400',
        iconName: 'MinusCircle',
        label: 'Degraded'
      };
    }
    if (isFullyOperational) {
      return {
        cardColor: 'border-green-500/30',
        iconColor: 'text-green-400',
        textColor: 'text-green-400',
        iconName: 'CheckCircle',
        label: 'Operational'
      };
    }
    return {
      cardColor: 'border-red-500/30',
      iconColor: 'text-red-400',
      textColor: 'text-red-400',
      iconName: 'XCircle',
      label: 'Error'
    };
  };

  const { cardColor, iconColor, textColor, iconName, label } = getStatusConfig();

  return (
    <Card className={`bg-slate-800/50 backdrop-blur-sm ${cardColor} lg:h-[400px] flex flex-col`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-medium text-white">{name}</CardTitle>
        <ConfiguredIcon 
          iconName={iconName}
          iconConfig={iconConfigs[iconName]}
          size="w-6 h-6"
          fallbackColor={iconColor}
        />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className={`text-2xl font-bold ${textColor}`}>
          {label}
        </p>
        <p className="text-xs text-slate-400 mt-1">{message}</p>

        {/* API Status for On-Chain API and Lightning API */}
        {(name === "On-Chain API" || name === "Lightning API") && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-sm text-slate-300 mb-2">API Status:</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {name === "On-Chain API" ? "mempool.space/api" : "api.getalby.com"}
              </span>
              <div className="flex items-center gap-1">
                {isFullyOperational ? (
                  <>
                    <ConfiguredIcon 
                      iconName="CheckCircle"
                      iconConfig={iconConfigs['CheckCircle']}
                      size="w-3 h-3"
                      fallbackColor="text-green-400"
                    />
                    <span className="text-green-400">OK</span>
                  </>
                ) : (
                  <>
                    <ConfiguredIcon 
                      iconName="XCircle"
                      iconConfig={iconConfigs['XCircle']}
                      size="w-3 h-3"
                      fallbackColor="text-red-400"
                    />
                    <span className="text-red-400">Error</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {relayStatuses && relayStatuses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-sm text-slate-300 mb-2">Relay Status:</p>
            <div className="space-y-1">
              {relayStatuses.map((relay) => (
                <div key={relay.url} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate flex-1 pr-2">
                    {relay.url.replace('wss://', '')}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {relay.status === 'connected' ? (
                      <>
                        <ConfiguredIcon 
                          iconName="CheckCircle"
                          iconConfig={iconConfigs['CheckCircle']}
                          size="w-3 h-3"
                          fallbackColor="text-green-400"
                        />
                        <span className="text-green-400">OK</span>
                      </>
                    ) : (
                      <>
                        <ConfiguredIcon 
                          iconName="XCircle"
                          iconConfig={iconConfigs['XCircle']}
                          size="w-3 h-3"
                          fallbackColor="text-red-400"
                        />
                        <span className="text-red-400">Failed</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {extraInfo && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-sm text-slate-300">{extraInfo}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TransactionCard = ({ title, transactions, type, iconName, address, error, isLoading, iconConfigs }) => {
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 animate-pulse lg:h-[400px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="h-6 w-3/4 bg-slate-700 rounded mb-2"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 w-full bg-slate-700 rounded"></div>
          <div className="h-10 w-full bg-slate-700 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const formatAmount = (sats) => {
    return new Intl.NumberFormat().format(sats);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return 'not confirmed';
    }
    try {
      let date;
      if (typeof timestamp === 'number') {
        date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return 'not confirmed';
      }

      if (isNaN(date.getTime())) return 'not confirmed';

      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) + ', ' + date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'not confirmed';
    }
  };

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 lg:h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <ConfiguredIcon 
            iconName={iconName}
            iconConfig={iconConfigs[iconName]}
            size="w-5 h-5"
            fallbackColor="text-orange-400"
          />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? (
          <p className="text-red-400 text-sm">Error: {error.message || error.toString()}</p>
        ) : transactions.length === 0 ? (
          <p className="text-slate-400 text-sm">No recent transactions</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, index) => {
              const { amount, direction } = tx;

              return (
                <motion.div
                  key={tx.id || tx.txid || index}
                  layout="position"
                  initial={false}
                  className="flex items-center justify-between py-3 px-4 bg-slate-600/40 rounded-lg hover:bg-slate-600/60 transition-colors min-h-[68px]"
                >
                  <div className="flex items-center gap-3">
                    {direction === 'in' ? (
                      <ConfiguredIcon 
                        iconName="ArrowDownCircle"
                        iconConfig={iconConfigs['ArrowDownCircle']}
                        size="w-4 h-4"
                        fallbackColor="text-green-400"
                      />
                    ) : (
                      <ConfiguredIcon 
                        iconName="ArrowUpCircle"
                        iconConfig={iconConfigs['ArrowUpCircle']}
                        size="w-4 h-4"
                        fallbackColor="text-red-400"
                      />
                    )}
                    <div className="text-left">
                      <div className="text-white text-sm font-medium">
                        {direction === 'in' ? 'Received' : 'Sent'}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold text-sm ${direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                      {direction === 'in' ? '+' : '-'}{formatAmount(amount)}
                    </div>
                    <div className="text-slate-400 text-xs">sats</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const NostrEventCard = ({ events, error, isLoading, iconConfigs }) => {
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 animate-pulse lg:h-[400px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="h-6 w-3/4 bg-slate-700 rounded mb-2"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 w-full bg-slate-700 rounded"></div>
          <div className="h-10 w-full bg-slate-700 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (timestamp) => {
    try {
      let date;
      if (typeof timestamp === 'number') {
        date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return 'Unknown date';
      }

      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) + ', ' + date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Date error';
    }
  };

  const truncateContent = (content, maxLength = 50) => {
    if (!content || typeof content !== 'string') return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const formatAmount = (sats) => {
    return new Intl.NumberFormat().format(sats);
  };

  const getReactionIcon = (content, iconConfigs) => {
    switch (content) {
      case '+':
        return <ConfiguredIcon 
          iconName="ThumbsUp"
          iconConfig={iconConfigs['ThumbsUp']}
          size="w-4 h-4"
          className="inline-block"
          fallbackColor="text-slate-400"
        />;
      case '-':
        return <ConfiguredIcon 
          iconName="ThumbsDown"
          iconConfig={iconConfigs['ThumbsDown']}
          size="w-4 h-4"
          className="inline-block"
          fallbackColor="text-slate-400"
        />;
      case '❤️':
      case '💜':
        return <ConfiguredIcon 
          iconName="Heart"
          iconConfig={iconConfigs['Heart']}
          size="w-4 h-4"
          className="inline-block"
          fallbackColor="text-slate-400"
        />;
      default:
        return content.match(/\p{Emoji}/u) ? <span className="text-slate-400">{content}</span> : <ConfiguredIcon 
          iconName="Smile"
          iconConfig={iconConfigs['Smile']}
          size="w-4 h-4"
          className="inline-block"
          fallbackColor="text-slate-400"
        />;
    }
  };

  const getActivityIcon = (type, iconConfigs) => {
    switch (type) {
      case 'post':
        return <ConfiguredIcon 
          iconName="MessageSquare"
          iconConfig={iconConfigs['MessageSquare']}
          size="w-4 h-4"
          fallbackColor="text-blue-400"
        />;
      case 'mention':
        return <ConfiguredIcon 
          iconName="AtSign"
          iconConfig={iconConfigs['AtSign']}
          size="w-4 h-4"
          fallbackColor="text-purple-400"
        />;
      case 'reply':
        return <ConfiguredIcon 
          iconName="Reply"
          iconConfig={iconConfigs['Reply']}
          size="w-4 h-4"
          fallbackColor="text-green-400"
        />;
      case 'zap-in':
        return <ConfiguredIcon 
          iconName="Zap"
          iconConfig={iconConfigs['Zap']}
          size="w-4 h-4"
          fallbackColor="text-yellow-400"
        />;
      case 'zap-out':
        return <ConfiguredIcon 
          iconName="Zap"
          iconConfig={iconConfigs['Zap']}
          size="w-4 h-4"
          fallbackColor="text-orange-400"
        />;
      case 'reaction':
        return <ConfiguredIcon 
          iconName="Heart"
          iconConfig={iconConfigs['Heart']}
          size="w-4 h-4"
          fallbackColor="text-pink-400"
        />;
      default:
        return <ConfiguredIcon 
          iconName="MessageSquare"
          iconConfig={iconConfigs['MessageSquare']}
          size="w-4 h-4"
          fallbackColor="text-slate-400"
        />;
    }
  };

  const renderEventContent = (event) => {
    const isZapIn = event.type === 'zap-in';
    const isZapOut = event.type === 'zap-out';
    const isZap = isZapIn || isZapOut;
    const isReaction = event.type === 'reaction';

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">{getActivityIcon(event.type, iconConfigs)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium capitalize">
              {event.type.replace('-', ' ')}
            </div>

            <div className="text-slate-400 text-xs mt-0.5 leading-relaxed truncate">
              {isReaction ? (
                <span className="flex items-center gap-1.5">
                  {getReactionIcon(event.content, iconConfigs)}
                  <span>on a post</span>
                </span>
              ) : (
                truncateContent(event.content, 50) || (isZap ? (isZapIn ? "Received Zap" : "Sent Zap") : "No content")
              )}
            </div>
          </div>
        </div>

        <div className="text-right ml-4 flex-shrink-0">
          {isZap && event.amount > 0 && (
            <div className={`font-semibold text-sm mb-0.5 ${isZapIn ? 'text-green-400' : 'text-red-400'}`}>
              {isZapIn ? '+' : '-'}{formatAmount(event.amount)} sats
            </div>
          )}
          <div className="text-slate-500 text-xs">
            {formatDate(event.created_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 lg:h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <ConfiguredIcon 
            iconName="MessageSquare"
            iconConfig={iconConfigs['MessageSquare']}
            size="w-5 h-5"
            fallbackColor="text-purple-400"
          />
          Latest Nostr Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? (
          <p className="text-red-400 text-sm">Error: {error.message || error.toString()}</p>
        ) : events.length === 0 ? (
          <p className="text-slate-400 text-sm">No recent Nostr events found</p>
        ) : (
          events.map((event, index) => (
            <div key={`${event.id || index}`} className="py-3 px-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors min-h-[68px] flex items-center">
              {renderEventContent(event)}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default function Status() {
  const { iconConfigs } = useAllIconConfigs();
  const BITCOIN_ADDRESS = "bc1q7davwh4083qrw8dsnazavamul4ngam99zt7nfy";

  // Eindeutige Session-ID für diesen Mount
  const sessionId = useRef(`status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // State für API-Checks
  const [apiData, setApiData] = useState(null);
  const [isLoadingApi, setIsLoadingApi] = useState(true);
  const [apiError, setApiError] = useState(null);

  // State für Nostr-Checks
  const [nostrData, setNostrData] = useState(null);
  const [isLoadingNostr, setIsLoadingNostr] = useState(true);
  const [nostrError, setNostrError] = useState(null);

  // State für Health Check Results
  const [allResults, setAllResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);

  // Refs um sicherzustellen, dass jede Funktion NUR EINMAL aufgerufen wird
  const hasFetchedApi = useRef(false);
  const hasFetchedNostr = useRef(false);
  const hasFetchedResults = useRef(false);

  // Fetch API status ONCE on mount
  useEffect(() => {
    if (hasFetchedApi.current) return;
    hasFetchedApi.current = true;
    
    console.log(`[Status ${sessionId.current}] Fetching API status ONCE...`);
    base44.functions.invoke('checkApiStatus', { 
      source: `status_page_${sessionId.current}` // Eindeutiger Source
    })
      .then(response => {
        console.log(`[Status ${sessionId.current}] API check completed`);
        setApiData(response.data);
        setIsLoadingApi(false);
      })
      .catch(error => {
        console.error(`[Status ${sessionId.current}] API check error:`, error);
        setApiError(error);
        setIsLoadingApi(false);
      });
  }, []);

  // Fetch Nostr status ONCE on mount
  useEffect(() => {
    if (hasFetchedNostr.current) return;
    hasFetchedNostr.current = true;
    
    console.log(`[Status ${sessionId.current}] Fetching Nostr status ONCE...`);
    base44.functions.invoke('checkNostrActivity', {
      source: `status_page_${sessionId.current}` // Eindeutiger Source
    })
      .then(response => {
        console.log(`[Status ${sessionId.current}] Nostr check completed`);
        setNostrData(response.data);
        setIsLoadingNostr(false);
      })
      .catch(error => {
        console.error(`[Status ${sessionId.current}] Nostr check error:`, error);
        setNostrError(error);
        setIsLoadingNostr(false);
      });
  }, []);

  // Fetch health check results ONCE on mount
  useEffect(() => {
    if (hasFetchedResults.current) return;
    hasFetchedResults.current = true;
    
    console.log(`[Status ${sessionId.current}] Fetching health check results ONCE...`);
    base44.entities.SystemHealthCheckResult.list('-timestamp', 5000)
      .then(results => {
        setAllResults(results);
        setLoadingResults(false);
      })
      .catch(error => {
        console.error(`[Status ${sessionId.current}] Error fetching results:`, error);
        setLoadingResults(false);
      });
  }, []);

  // Log beim Unmount
  useEffect(() => {
    return () => {
      console.log(`[Status ${sessionId.current}] Component unmounting`);
    };
  }, []);

  // Extract processed data from API response
  const bitcoinStatus = apiData?.mempool || null;
  const lightningStatus = apiData?.alby || null;
  const bitcoinTransactions = (apiData?.bitcoinTransactions || [])
    .map((tx) => {
      const { amount, direction } = getBitcoinTxAmountHelper(tx, BITCOIN_ADDRESS);
      return {
        ...tx,
        amount,
        direction,
        timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : null, // Convert to ms, fallback to null
        type: 'bitcoin'
      };
    })
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) // Sort by timestamp, handling nulls
    .slice(0, 3); // Keep only 3 for display

  const lightningTransactions = (apiData?.lightningTransactions || [])
    .map((tx) => ({
      ...tx,
      timestamp: tx.created_at ? tx.created_at * 1000 : null, // Convert to ms, fallback to null
      direction: tx.type === 'incoming' ? 'in' : 'out', // ✅ KORRIGIERT: Genau wie auf /Treasury
    }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) // Sort by timestamp, handling nulls
    .slice(0, 3); // Keep only 3 for display

  // Extract Nostr data
  const relayStatuses = nostrData?.relayStatuses || [];
  const connectedCount = relayStatuses.filter((r) => r.status === 'connected').length;
  const totalCount = relayStatuses.length;

  const nostrStatus = {
    connected: connectedCount > 0,
    message: connectedCount > 0 ? 'Connection successful' : 'Connection failed',
    events: nostrData?.events || [],
    relayStatuses: relayStatuses,
    relayCount: connectedCount,
    totalRelays: totalCount
  };

  const nostrEvents = (nostrData?.events || []).slice(0, 3); // Keep only 3 for display

  // Calculate stats from ALL historical results
  const stats = React.useMemo(() => {
    const totalChecks = allResults.length;
    const successfulChecks = allResults.filter(r => r.status === 'success').length;
    const failedChecks = allResults.filter(r => r.status === 'fail').length;
    const degradedChecks = allResults.filter(r => r.status === 'degraded').length;
    
    const avgResponseTime = totalChecks > 0 
      ? Math.round(allResults.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / totalChecks)
      : 0;
    
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

  const showStatsSkeleton = isLoadingApi || isLoadingNostr || loadingResults;

  return (
    <div className="p-4 lg:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="Server" 
            iconConfig={iconConfigs['Server']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-slate-400"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              System Health
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Real-time monitoring of API services and system health.
        </p>
      </div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
      >
        <StatCard
          iconName="Activity"
          iconConfig={iconConfigs['Activity']}
          value={showStatsSkeleton ? '—' : stats.totalChecks}
          label="Last Checks"
          isLoading={showStatsSkeleton}
        />
        <StatCard
          iconName="CheckCircle"
          iconConfig={iconConfigs['CheckCircle']}
          value={showStatsSkeleton ? '—' : stats.successfulChecks}
          label="Successful"
          isLoading={showStatsSkeleton}
        />
        <StatCard
          iconName="XCircle"
          iconConfig={iconConfigs['XCircle']}
          value={showStatsSkeleton ? '—' : stats.failedChecks}
          label="Failed"
          isLoading={showStatsSkeleton}
        />
        <StatCard
          iconName="AlertTriangle"
          iconConfig={iconConfigs['AlertTriangle']}
          value={showStatsSkeleton ? '—' : stats.degradedChecks}
          label="Degraded"
          isLoading={showStatsSkeleton}
        />
        <StatCard
          iconName="Clock"
          iconConfig={iconConfigs['Clock']}
          value={showStatsSkeleton ? '—' : `${stats.avgResponseTime}ms`}
          label="Avg Response"
          isLoading={showStatsSkeleton}
        />
        <StatCard
          iconName="TrendingUp"
          iconConfig={iconConfigs['TrendingUp']}
          value={showStatsSkeleton ? '—' : `${stats.uptimePercentage}%`}
          label="Uptime"
          isLoading={showStatsSkeleton}
        />
      </motion.div>

      {/* Status Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      >
        {/* Column 1: On-Chain */}
        <div className="space-y-6 flex flex-col">
          <StatusIndicator
            name="On-Chain API"
            status={bitcoinStatus?.connected}
            message={bitcoinStatus?.message}
            extraInfo={
              <>
                {bitcoinStatus?.blockHeight && (
                  <div>Current Block Height: {bitcoinStatus.blockHeight.toLocaleString()}</div>
                )}
                {bitcoinStatus?.txCount24h !== undefined && (
                  <div>Number of Transactions last 24h: {bitcoinStatus.txCount24h}</div>
                )}
              </>
            }
            isLoading={isLoadingApi}
            iconConfigs={iconConfigs}
          />

          <TransactionCard
            title="Recent Bitcoin Transactions"
            transactions={bitcoinTransactions}
            type="bitcoin"
            iconName="Bitcoin"
            address={BITCOIN_ADDRESS}
            error={apiError}
            isLoading={isLoadingApi}
            iconConfigs={iconConfigs}
          />
        </div>

        {/* Column 2: Lightning */}
        <div className="space-y-6 flex flex-col">
          <StatusIndicator
            name="Lightning API"
            status={lightningStatus?.connected}
            message={lightningStatus?.message}
            extraInfo={lightningStatus?.txCount24h !== undefined ? `Number of Transactions last 24h: ${lightningStatus.txCount24h}` : null}
            isLoading={isLoadingApi}
            iconConfigs={iconConfigs}
          />

          <TransactionCard
            title="Recent Lightning Transactions"
            transactions={lightningTransactions}
            type="lightning"
            iconName="Zap"
            error={apiError}
            isLoading={isLoadingApi}
            iconConfigs={iconConfigs}
          />
        </div>

        {/* Column 3: Nostr */}
        <div className="space-y-6 flex flex-col">
          <StatusIndicator
            name="Nostr Relays"
            status={nostrStatus?.connected}
            message={nostrStatus?.message || (nostrStatus?.connected ? 'Connection successful' : 'Connection failed')}
            extraInfo={nostrStatus?.events ? `Number of Events: ${nostrStatus.events.length}` : null}
            relayStatuses={nostrStatus?.relayStatuses}
            isLoading={isLoadingNostr}
            iconConfigs={iconConfigs}
          />

          <NostrEventCard
            events={nostrEvents}
            error={nostrError}
            isLoading={isLoadingNostr}
            iconConfigs={iconConfigs}
          />
        </div>
      </motion.div>
    </div>
  );
}
