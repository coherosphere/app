
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

import TransactionRow from "@/components/treasury/TransactionRow";
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const BITCOIN_ADDRESS = "bc1q7davwh4083qrw8dsnazavamul4ngam99zt7nfy";

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

export default function Treasury() {
  const [selectedFilters, setSelectedFilters] = useState(['all']);
  const [currentPage, setCurrentPage] = useState(1);

  const getItemsPerPage = () => window.innerWidth < 768 ? 15 : 20;
  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage);

  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // States für Mobile-Scroll-Navigation
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = React.useRef(null);

  // Progressive Loading States - ALTE oldStats entfernt
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,    // Neue dynamische Stats
    filters: false,
    transactions: false
  });

  // Use React Query with our caching policy
  const {
    data: apiData,
    isLoading: isQueryLoading,
    error: queryError,
    dataUpdatedAt,
    refetch
  } = useCachedData(
    ['treasury', 'transactions'],
    () => base44.functions.invoke('checkApiStatus', { source: 'treasury_page' }),
    'treasury'
  );

  // --- Daten laden für Stats ---
  // 1. Stat Konfigurationen laden (alle)
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['treasury', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'treasury'
  );

  // 2. Stat Werte laden (alle)
  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['treasury', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'treasury'
  );

  // 3. AppConfig für die Anzeigereihenfolge laden
  const { data: appConfigList = [] } = useCachedData(
    ['treasury', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'treasury'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;

  // Page-spezifische Anzeigereihenfolge aus AppConfig
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Treasury'] || appConfig?.stat_display_order || [];

  // Sync React Query's loading state with the global loading context
  useEffect(() => {
    setLoading(isQueryLoading);
  }, [isQueryLoading, setLoading]);

  useEffect(() => {
    const handleResize = () => setItemsPerPage(getItemsPerPage());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getBitcoinTxAmount = useCallback((tx, address) => {
    let received = tx.vout?.reduce((sum, output) => 
        output.scriptpubkey_address === address ? sum + output.value : sum, 0) || 0;
    
    let sent = tx.vin?.reduce((sum, input) =>
        input.prevout?.scriptpubkey_address === address ? sum + input.prevout.value : sum, 0) || 0;

    const netAmount = received - sent;
    return { amount: Math.abs(netAmount), direction: netAmount >= 0 ? 'in' : 'out' };
  }, []);

  // Process API data into transactions using useMemo for efficiency
  const { transactions, onChainStatus, lightningStatus } = React.useMemo(() => {
    if (!apiData?.data) {
      return { transactions: [], onChainStatus: null, lightningStatus: null };
    }

    const data = apiData.data;

    const onChainTxs = (data.bitcoinTransactions || []).map(tx => {
      const { amount, direction } = getBitcoinTxAmount(tx, BITCOIN_ADDRESS);
      return {
        id: tx.txid,
        hash: tx.txid,
        amount,
        direction,
        timestamp: tx.status.block_time,
        type: 'bitcoin'
      };
    });

    const lightningTxs = (data.lightningTransactions || []).map(tx => ({
      id: tx.id || tx.payment_hash,
      hash: tx.id || tx.payment_hash,
      amount: tx.amount,
      direction: tx.type === 'incoming' ? 'in' : 'out',
      timestamp: tx.created_at,
      type: 'lightning'
    }));

    const allTransactions = [...onChainTxs, ...lightningTxs]
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      transactions: allTransactions,
      onChainStatus: data.mempool,
      lightningStatus: data.alby
    };
  }, [apiData, getBitcoinTxAmount]);

  // Track when each section's data is ready (parallel loading)
  // ENTFERNT: useEffect für oldStats
  
  useEffect(() => {
    // New stats ready when config and values loaded
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  useEffect(() => {
    // Filters ready when transactions loaded
    if (!isQueryLoading && transactions.length >= 0) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [isQueryLoading, transactions]);

  useEffect(() => {
    // Transactions list ready when data loaded
    if (!isQueryLoading && transactions.length >= 0) {
      setSectionsReady(prev => ({ ...prev, transactions: true }));
    }
  }, [isQueryLoading, transactions]);

  // Map für schnellen Zugriff auf Stat-Werte
  const valueMap = React.useMemo(() => {
    const map = {};
    allValues.forEach(value => {
      map[value.stat_key] = value;
    });
    return map;
  }, [allValues]);

  // Aktive Stat-Konfigurationen für Treasury-Seite filtern
  const activeStatsForThisPage = React.useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Treasury')
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
        return typeof rawValue === 'number' ? rawValue.toLocaleString() : String(rawValue);
      case 'percentage':
        return typeof rawValue === 'number' ? `${rawValue}%` : String(rawValue);
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

    setShowLeftArrow(scrollLeft > 20);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
  }, []);

  // Mobile-Scroll handhaben
  const handleScroll = useCallback((direction) => {
    const container = mobileStatsScrollRef.current;
    if (!container) return;

    const scrollAmount = 140;
    const { scrollLeft, scrollWidth, clientWidth } = container;

    if (direction === 'left') {
      if (scrollLeft <= 10) {
        container.scrollLeft = scrollWidth - clientWidth;
      } else {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    } else {
      if (scrollLeft >= scrollWidth - clientWidth - 10) {
        container.scrollLeft = 0;
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  }, []);

  // Effect für Mobile-Scroll-Logik - KORRIGIERT: Auch bei 2 Stats Pfeile zeigen
  useEffect(() => {
    const container = mobileStatsScrollRef.current;
    if (!container || sortedStatConfigs.length === 0) return; // Nur bei 0 Stats keine Pfeile

    checkScrollPosition();
    const handleResize = () => checkScrollPosition();
    const handleScrollEvent = () => checkScrollPosition();

    window.addEventListener('resize', handleResize);
    container.addEventListener('scroll', handleScrollEvent);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('scroll', handleScrollEvent);
    };
  }, [checkScrollPosition, sortedStatConfigs]);

  // Render-Funktionen für Stat-Karten - KORRIGIERT: isLoading Prop nutzen
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

  const handleRefresh = () => {
    refetch();
  };

  const handleFilterToggle = (filterType) => {
    if (filterType === 'all') {
      setSelectedFilters(['all']);
    } else {
      setSelectedFilters(prev => {
        const withoutAll = prev.filter(f => f !== 'all');
        if (withoutAll.includes(filterType)) {
          const newFilters = withoutAll.filter(f => f !== filterType);
          return newFilters.length === 0 ? ['all'] : newFilters;
        } else {
          return [...withoutAll, filterType];
        }
      });
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page) => setCurrentPage(page);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const filteredTransactions = transactions.filter(transaction => {
    if (selectedFilters.includes('all')) return true;
    const directionMatch = 
      (selectedFilters.includes('inflow') && transaction.direction === 'in') ||
      (selectedFilters.includes('outflow') && transaction.direction === 'out');
    const typeMatch = 
      (selectedFilters.includes('on-chain') && transaction.type === 'bitcoin') ||
      (selectedFilters.includes('lightning') && transaction.type === 'lightning');
    const hasActiveDirectionFilters = selectedFilters.some(f => ['inflow', 'outflow'].includes(f));
    const hasActiveTypeFilters = selectedFilters.some(f => ['on-chain', 'lightning'].includes(f));
    if (hasActiveDirectionFilters && hasActiveTypeFilters) return directionMatch && typeMatch;
    if (hasActiveDirectionFilters) return directionMatch;
    if (hasActiveTypeFilters) return typeMatch;
    return false;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const filterCounts = {
    all: transactions.length,
    inflow: transactions.filter(t => t.direction === 'in').length,
    outflow: transactions.filter(t => t.direction === 'out').length,
    'on-chain': transactions.filter(t => t.type === 'bitcoin').length,
    lightning: transactions.filter(t => t.type === 'lightning').length,
  };

  const calculateRunningBalance = (allTransactions, currentIndex) => {
    const reversedTransactions = [...allTransactions].reverse();

    let currentBalance = 0;
    const runningBalances = [];

    reversedTransactions.forEach(tx => {
      currentBalance += (tx.direction === 'in' ? tx.amount : -tx.amount);
      runningBalances.push(currentBalance);
    });

    const runningBalancesNewestToOldest = runningBalances.reverse();
    const transactionId = paginatedTransactions[currentIndex]?.id;
    const originalTransactionIndex = allTransactions.findIndex(tx => tx.id === transactionId);
    
    if (originalTransactionIndex !== -1 && originalTransactionIndex < runningBalancesNewestToOldest.length) {
      return runningBalancesNewestToOldest[originalTransactionIndex];
    }
    return 0;
  };

  const stats = {
    totalBalance: transactions.reduce((sum, tx) => sum + (tx.direction === 'in' ? tx.amount : -tx.amount), 0),
    totalIncoming: transactions.filter(tx => tx.direction === 'in').reduce((sum, tx) => sum + tx.amount, 0),
    totalOutgoing: transactions.filter(tx => tx.direction === 'out').reduce((sum, tx) => sum + tx.amount, 0),
    transactionCount: transactions.length
  };

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const error = queryError?.message || null;

  // Skeleton Components (kept here as per original file structure for these)
  const FiltersSkeleton = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 w-28 bg-slate-700/30 animate-pulse rounded-full" />
      ))}
    </div>
  );

  const TransactionsSkeleton = () => (
    <div>
      {/* Desktop Header Skeleton */}
      <div className="hidden md:grid grid-cols-12 gap-4 py-3 px-6 bg-slate-700/30 backdrop-blur-sm border-slate-700 rounded-t-xl mb-0">
        <div className="col-span-3 h-4 bg-slate-600/30 animate-pulse rounded" />
        <div className="col-span-2 h-4 bg-slate-600/30 animate-pulse rounded" />
        <div className="col-span-3 h-4 bg-slate-600/30 animate-pulse rounded" />
        <div className="col-span-3 h-4 bg-slate-600/30 animate-pulse rounded" />
        <div className="col-span-1 h-4 bg-slate-600/30 animate-pulse rounded" />
      </div>
      
      <div className="md:bg-slate-800/50 md:backdrop-blur-sm md:border-x md:border-b md:border-slate-700 md:rounded-b-xl">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mb-4 md:mb-0">
            {/* Desktop Row Skeleton */}
            <div className="hidden md:grid grid-cols-12 gap-4 items-center py-4 px-6 border-b border-slate-700/50">
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-slate-700/30 animate-pulse rounded mb-1" />
                  <div className="h-3 w-32 bg-slate-700/30 animate-pulse rounded" />
                </div>
              </div>
              <div className="col-span-2 h-4 w-20 bg-slate-700/30 animate-pulse rounded" />
              <div className="col-span-3 h-6 w-28 bg-slate-700/30 animate-pulse rounded" />
              <div className="col-span-3 h-6 w-28 bg-slate-700/30 animate-pulse rounded" />
              <div className="col-span-1 h-4 w-16 bg-slate-700/30 animate-pulse rounded" />
            </div>
            
            {/* Mobile Card Skeleton */}
            <Card className="md:hidden bg-slate-800/40 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                    <div>
                      <div className="h-5 w-24 bg-slate-700/30 animate-pulse rounded mb-1" />
                      <div className="h-4 w-20 bg-slate-700/30 animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-7 w-24 bg-slate-700/30 animate-pulse rounded" />
                </div>
                <div className="h-3 w-48 bg-slate-700/30 animate-pulse rounded mb-4" />
                <div className="bg-slate-700/50 p-3 rounded-lg h-12" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <ConfiguredIcon 
              iconName="Wallet" 
              iconConfig={iconConfigs['Wallet']}
              size="w-12 h-12"
              className="flex-shrink-0"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                Treasury & Transactions
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed mt-3">
          Complete financial transparency for coherosphere.
        </p>
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

      {/* ALTE TreasuryStats KOMPONENTE ENTFERNT */}

      {/* NEW Dynamic Stats Section - KORRIGIERT: 3-stufiges Loading wie Dashboard */}
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
          <p>No stats configured for Treasury. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}
      
      {/* Transaction Filters - Progressive Loading */}
      {sectionsReady.filters ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleFilterToggle('all')}
              variant="ghost"
              className={`filter-chip h-auto ${selectedFilters.includes('all') ? 'active' : ''}`}
            >
              All
              <Badge variant="secondary" className={`ml-[3px] transition-colors duration-200 ${selectedFilters.includes('all') ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{filterCounts.all}</Badge>
            </Button>
            <Button
              onClick={() => handleFilterToggle('inflow')}
              variant="ghost"
              className={`filter-chip h-auto ${selectedFilters.includes('inflow') ? 'active' : ''}`}
            >
              Received
              <Badge variant="secondary" className={`ml-[3px] transition-colors duration-200 ${selectedFilters.includes('inflow') ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{filterCounts.inflow}</Badge>
            </Button>
            <Button
              onClick={() => handleFilterToggle('outflow')}
              variant="ghost"
              className={`filter-chip h-auto ${selectedFilters.includes('outflow') ? 'active' : ''}`}
            >
              Sent
              <Badge variant="secondary" className={`ml-[3px] transition-colors duration-200 ${selectedFilters.includes('outflow') ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{filterCounts.outflow}</Badge>
            </Button>
            <Button
              onClick={() => handleFilterToggle('on-chain')}
              variant="ghost"
              className={`filter-chip h-auto ${selectedFilters.includes('on-chain') ? 'active' : ''}`}
            >
              On-Chain
              <Badge variant="secondary" className={`ml-[3px] transition-colors duration-200 ${selectedFilters.includes('on-chain') ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{filterCounts['on-chain']}</Badge>
            </Button>
            <Button
              onClick={() => handleFilterToggle('lightning')}
              variant="ghost"
              className={`filter-chip h-auto ${selectedFilters.includes('lightning') ? 'active' : ''}`}
            >
              Lightning
              <Badge variant="secondary" className={`ml-[3px] transition-colors duration-200 ${selectedFilters.includes('lightning') ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{filterCounts.lightning}</Badge>
            </Button>
          </div>
        </motion.div>
      ) : (
        <FiltersSkeleton />
      )}

      {/* Transactions List - Progressive Loading */}
      {sectionsReady.transactions ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          {paginatedTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No transactions found for selected filters
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 py-3 px-6 bg-slate-700/30 backdrop-blur-sm border border-slate-700 rounded-t-xl text-slate-300 text-sm font-medium">
                <div className="col-span-3">Transaction</div>
                <div className="col-span-2">Direction</div>
                <div className="col-span-3 text-right">Amount</div>
                <div className="col-span-3 text-right">Running Balance</div>
                <div className="col-span-1 text-right">Hash</div>
              </div>

              <div className="md:bg-slate-800/50 md:backdrop-blur-sm md:border-x md:border-b md:border-slate-700 md:rounded-b-xl md:rounded-t-none">
                {paginatedTransactions.map((transaction, index) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    index={index}
                    runningBalance={calculateRunningBalance(transactions, index)} 
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <motion.div
                  className="pt-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.2 }}
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
                        .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                        .map((page, index, arr) => (
                          <React.Fragment key={page}>
                            {index > 0 && arr[index - 1] !== page - 1 && <span className="text-slate-500 px-2">...</span>}
                            <Button onClick={() => handlePageChange(page)} variant="ghost" className={`filter-chip h-auto w-10 ${currentPage === page ? 'active' : ''}`}>{page}</Button>
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
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      ) : (
        <TransactionsSkeleton />
      )}
    </div>
  );
}
