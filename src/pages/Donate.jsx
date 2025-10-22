
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { generateQrCode } from '@/api/functions';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import DonateTransactionList from '@/components/donate/DonateTransactionList';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

export default function DonatePage() {
  const [onChainCopied, setOnChainCopied] = useState(false);
  const [lightningCopied, setLightningCopied] = useState(false);
  const [selectedTab, setSelectedTab] = useState('lightning');
  const [showQR, setShowQR] = useState(false);
  const [selectedQRImage, setSelectedQRImage] = useState(null);
  const [selectedQRType, setSelectedQRType] = useState('');
  
  // QR Code generation states
  const [lightningQR, setLightningQR] = useState(null);
  const [onChainQR, setOnChainQR] = useState(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  const lightningAddress = "coherosphere@getalby.com";

  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // States für Mobile-Scroll-Navigation (NEU für Stats)
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = React.useRef(null);

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    narrative: false,
    donationTabs: false,
    stats: false // NEU für Stats
  });

  // Use cached data for treasury transactions
  const {
    data: apiData,
    isLoading: isLoadingTransactions,
    error: transactionsError,
    refetch: refetchTransactions
  } = useCachedData(
    ['donate', 'transactions'],
    () => base44.functions.invoke('checkApiStatus', { source: 'donate_page' }),
    'donate'
  );

  // --- NEU: Daten laden für Stats ---
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['donate', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'donate'
  );

  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['donate', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'donate'
  );

  const { data: appConfigList = [] } = useCachedData(
    ['donate', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'donate'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;

  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Donate'] || appConfig?.stat_display_order || [];

  // Stable state for transactions
  const [transactions, setTransactions] = useState([]);
  const lastTransactionHashRef = React.useRef(null);
  const hasInitializedRef = React.useRef(false);

  // Sync loading state with global loading context
  useEffect(() => {
    setLoading(isLoadingTransactions);
  }, [isLoadingTransactions, setLoading]);

  // Generate QR codes on mount
  useEffect(() => {
    const generateQRCodes = async () => {
      setIsGeneratingQR(true);
      try {
        const lightningResponse = await generateQrCode({ data: `lightning:${lightningAddress}` });
        if (lightningResponse?.data && lightningResponse.data.qrCodeUrl) {
          setLightningQR(lightningResponse.data.qrCodeUrl);
        }

        const onChainResponse = await generateQrCode({ data: `bitcoin:${BITCOIN_ADDRESS}` });
        if (onChainResponse?.data && onChainResponse.data.qrCodeUrl) {
          setOnChainQR(onChainResponse.data.qrCodeUrl);
        }
      } catch (error) {
        console.error('Error generating QR codes:', error);
      } finally {
        setIsGeneratingQR(false);
      }
    };

    generateQRCodes();
  }, [lightningAddress]);

  // Helper to calculate Bitcoin transaction amount and direction
  const getBitcoinTxAmount = useCallback((tx, address) => {
    let received = tx.vout?.reduce((sum, output) => 
        output.scriptpubkey_address === address ? sum + output.value : sum, 0) || 0;
    
    let sent = tx.vin?.reduce((sum, input) =>
        input.prevout?.scriptpubkey_address === address ? sum + input.prevout.value : sum, 0) || 0;

    const netAmount = received - sent;
    return { amount: Math.abs(netAmount), direction: netAmount >= 0 ? 'in' : 'out' };
  }, []);

  // Process and update transactions - EXACT SAME PATTERN AS TREASURY
  useEffect(() => {
    if (!apiData?.data) {
      console.log('[Donate] No API data yet');
      return;
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
    }).filter(tx => tx.amount > 0);

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

    // Create a stable hash from transaction IDs and amounts
    const transactionHash = allTransactions
      .map(tx => `${tx.id}:${tx.amount}:${tx.timestamp}`)
      .join('|');
    
    // For initial load, always set transactions
    if (!hasInitializedRef.current && allTransactions.length > 0) {
      console.log('📊 [Donate] Initial transactions load:', {
        count: allTransactions.length,
        hash: transactionHash.substring(0, 50) + '...'
      });
      lastTransactionHashRef.current = transactionHash;
      hasInitializedRef.current = true;
      setTransactions(allTransactions);
      return;
    }
    
    // For subsequent updates, only update if hash changed
    if (hasInitializedRef.current && transactionHash !== lastTransactionHashRef.current) {
      console.log('📊 [Donate] Transactions changed:', {
        oldHash: lastTransactionHashRef.current ? lastTransactionHashRef.current.substring(0, 50) + '...' : 'none',
        newHash: transactionHash.substring(0, 50) + '...',
        oldCount: transactions.length,
        newCount: allTransactions.length
      });
      lastTransactionHashRef.current = transactionHash;
      setTransactions(allTransactions);
    } else if (hasInitializedRef.current) {
      console.log('[Donate] No changes detected, skipping update');
    }
  }, [apiData, getBitcoinTxAmount]);

  // Track when sections are ready (parallel loading)
  useEffect(() => {
    // Narrative sections always ready (static content)
    setSectionsReady(prev => ({ ...prev, narrative: true }));
  }, []);

  useEffect(() => {
    // Donation tabs ready when QR codes generated
    if (!isGeneratingQR && (lightningQR || onChainQR)) {
      setSectionsReady(prev => ({ ...prev, donationTabs: true }));
    }
  }, [isGeneratingQR, lightningQR, onChainQR]);

  // NEU: Stats ready tracking
  useEffect(() => {
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  // --- NEU: Stats-bezogene Memoized-Werte und Funktionen ---
  const valueMap = React.useMemo(() => {
    const map = {};
    allValues.forEach(value => {
      map[value.stat_key] = value;
    });
    return map;
  }, [allValues]);

  const activeStatsForThisPage = React.useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Donate')
    );
  }, [allStats]);

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

  const checkScrollPosition = useCallback(() => {
    const container = mobileStatsScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;

    setShowLeftArrow(scrollLeft > 20);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
  }, []);

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

  useEffect(() => {
    const container = mobileStatsScrollRef.current;
    if (!container || sortedStatConfigs.length === 0) return;

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
            isLoading={false}
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
          isLoading={false}
        />
      );
    });
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'on-chain') {
      setOnChainCopied(true);
      setTimeout(() => setOnChainCopied(false), 2000);
    } else {
      setLightningCopied(true);
      setTimeout(() => setLightningCopied(false), 2000);
    }
  };

  const handleShowQR = (imageUrl, type) => {
    setSelectedQRImage(imageUrl);
    setSelectedQRType(type);
    setShowQR(true);
  };

  // Memoize relevant transactions to prevent re-renders
  const relevantTransactions = React.useMemo(() => {
    const filtered = transactions.filter(tx => 
      selectedTab === 'lightning' ? tx.type === 'lightning' : tx.type === 'bitcoin'
    );
    return filtered.slice(0, 5);
  }, [transactions, selectedTab]);

  // Skeleton for Donation Tabs
  const DonationTabsSkeleton = () => (
    <div className="lg:col-span-2">
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <div className="h-14 bg-slate-700 animate-pulse rounded mb-6" />
        <div className="flex flex-col items-center gap-6">
          <div className="w-64 h-64 bg-slate-700 animate-pulse rounded-lg" />
          <div className="w-full max-w-md space-y-4">
            <div className="h-12 bg-slate-700 animate-pulse rounded" />
            <div className="h-14 bg-slate-700 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="p-4 lg:p-8">
        {/* Header - ALWAYS VISIBLE immediately */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <ConfiguredIcon 
              iconName="Heart"
              iconConfig={iconConfigs['Heart']}
              size="w-12 h-12"
              fallbackColor="text-orange-500"
              className="flex-shrink-0"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                Fund the Sphere
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Together we build a resilient and meaningful future – transparent, decentralized, and aligned with our shared values.
          </p>
        </motion.div>

        {/* NEU: Dynamic Stats Section - VOR der Two-column layout */}
        {(statsConfigLoading || statsValuesLoading) ? (
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
        ) : null}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Narrative Content - Progressive Loading */}
          <div className="lg:col-span-1 space-y-8">
            
            {sectionsReady.narrative ? (
              <>
                {/* Why Donate */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0 }}
                  className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Why Support Us?</h2>
                  <p className="text-slate-300 leading-relaxed">
                    Your donation is not charity – it is <span className="text-orange-400 font-semibold">participation</span>. 
                    Every sat flows into projects, hubs, and learning spaces that build resilience and meaning in the age of AI.
                  </p>
                </motion.div>

                {/* Transparency & Treasury */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.05 }}
                  className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Full Transparency</h2>
                  <div className="text-slate-300 leading-relaxed space-y-3 mb-4">
                    <p>Bitcoin on-chain transactions are publicly verifiable on the blockchain.</p>
                    <p>Lightning payments happen off-chain – yet we make them visible: all movements are disclosed in our live Treasury dashboard.</p>
                    <p>This way, every satoshi is accounted for, whether on-chain or Lightning.</p>
                  </div>
                  <Link
                    to={createPageUrl('Treasury')}
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors"
                  >
                    <ConfiguredIcon 
                      iconName="Eye"
                      iconConfig={iconConfigs['Eye']}
                      size="w-4 h-4"
                      fallbackColor="text-orange-500"
                    />
                    View Live Treasury
                  </Link>
                </motion.div>

                {/* Values Callout */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                  className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Our Values</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Globe"
                        iconConfig={iconConfigs['Globe']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Decentralized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Eye"
                        iconConfig={iconConfigs['Eye']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Intelligent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Shield"
                        iconConfig={iconConfigs['Shield']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Resilient</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Users"
                        iconConfig={iconConfigs['Users']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Collective</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Shield"
                        iconConfig={iconConfigs['Shield']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Trustless</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Globe"
                        iconConfig={iconConfigs['Globe']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Solid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Zap"
                        iconConfig={iconConfigs['Zap']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Progressive</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfiguredIcon 
                        iconName="Heart"
                        iconConfig={iconConfigs['Heart']}
                        size="w-5 h-5"
                        fallbackColor="text-orange-400"
                      />
                      <span className="text-slate-300 text-sm">Inviting</span>
                    </div>
                  </div>
                </motion.div>

                {/* Closing Invitation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.15 }}
                  className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/30 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Join the Movement</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    Join us. Every sat you contribute resonates through the coherosphere.
                  </p>
                  <div className="flex items-center gap-2 text-orange-400">
                    <ConfiguredIcon 
                      iconName="Heart"
                      iconConfig={iconConfigs['Heart']}
                      size="w-5 h-5"
                      fallbackColor="text-orange-500"
                    />
                    <span className="text-sm font-medium">Make Your Mark</span>
                  </div>
                </motion.div>
              </>
            ) : (
              // Narrative Skeleton
              <div className="space-y-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                    <div className="h-6 w-32 bg-slate-700 animate-pulse rounded mb-4" />
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-700 animate-pulse rounded" />
                      <div className="h-4 w-5/6 bg-slate-700 animate-pulse rounded" />
                      <div className="h-4 w-4/6 bg-slate-700 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Donation Options - Progressive Loading */}
          {sectionsReady.donationTabs ? (
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <Tabs 
                defaultValue="lightning" 
                className="w-full"
                onValueChange={(value) => setSelectedTab(value)}
              >
                <TabsList className="grid w-full grid-cols-2 bg-slate-800/80 border border-slate-700 h-14">
                  <TabsTrigger value="lightning" className="h-12 text-lg data-[state=active]:bg-orange-500/90 data-[state=active]:text-white">
                    <ConfiguredIcon 
                      iconName="Zap"
                      iconConfig={iconConfigs['Zap']}
                      size="w-5 h-5"
                      fallbackColor="text-current"
                      className="mr-2"
                    />
                    Lightning
                  </TabsTrigger>
                  <TabsTrigger value="on-chain" className="h-12 text-lg data-[state=active]:bg-orange-500/90 data-[state=active]:text-white">
                    <ConfiguredIcon 
                      iconName="Bitcoin"
                      iconConfig={iconConfigs['Bitcoin']}
                      size="w-5 h-5"
                      fallbackColor="text-current"
                      className="mr-2"
                    />
                    On-Chain
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="lightning" className="mt-6">
                  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-center">
                    <CardHeader>
                      <CardTitle className="text-2xl text-white">Lightning Donation</CardTitle>
                      <CardDescription className="text-slate-400">
                        Instant, low-fee payments. Scan with any Lightning-enabled wallet.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">
                      <div 
                        className="p-4 bg-white rounded-lg w-64 h-64 cursor-pointer hover:ring-4 hover:ring-orange-500/50 transition-all duration-200 flex items-center justify-center"
                        onClick={() => lightningQR && handleShowQR(lightningQR, "Lightning")}
                      >
                        {lightningQR ? (
                          <img 
                            src={lightningQR}
                            alt="Lightning QR Code"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-gray-500">QR Code not available</div>
                        )}
                      </div>
                      <div className="w-full max-w-md">
                        <div className="flex items-center">
                          <Input
                            readOnly
                            value={lightningAddress}
                            className="bg-slate-900 border-slate-600 text-slate-300 h-12 text-center"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(lightningAddress, 'lightning')}
                            className="ml-2 text-slate-400 hover:text-white"
                          >
                            {lightningCopied ? (
                              <ConfiguredIcon 
                                iconName="Check"
                                iconConfig={iconConfigs['Check']}
                                size="w-5 h-5"
                                fallbackColor="text-green-400"
                              />
                            ) : (
                              <ConfiguredIcon 
                                iconName="Copy"
                                iconConfig={iconConfigs['Copy']}
                                size="w-5 h-5"
                                fallbackColor="text-current"
                              />
                            )}
                          </Button>
                        </div>
                        <a href={`lightning:${lightningAddress}`} className="w-full">
                          <Button size="lg" className="w-full mt-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-lg h-14">
                            Open in Wallet
                          </Button>
                        </a>
                      </div>
                      
                      {/* Lightning Transactions - NICHT ÄNDERN */}
                      <div className="w-full max-w-md">
                        <DonateTransactionList 
                          type="lightning" 
                          transactions={relevantTransactions}
                          isLoading={isLoadingTransactions}
                          iconConfigs={iconConfigs}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="on-chain" className="mt-6">
                  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-center">
                    <CardHeader>
                      <CardTitle className="text-2xl text-white">On-Chain Bitcoin Donation</CardTitle>
                      <CardDescription className="text-slate-400">
                        For larger contributions directly to our treasury address.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">
                      <div 
                        className="p-4 bg-white rounded-lg w-64 h-64 cursor-pointer hover:ring-4 hover:ring-orange-500/50 transition-all duration-200 flex items-center justify-center"
                        onClick={() => onChainQR && handleShowQR(onChainQR, "On-Chain Bitcoin")}
                      >
                        {onChainQR ? (
                          <img 
                            src={onChainQR}
                            alt="On-Chain QR Code"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-gray-500">QR Code not available</div>
                        )}
                      </div>
                      <div className="w-full max-w-md">
                        <div className="flex items-center">
                          <Input
                            readOnly
                            value={BITCOIN_ADDRESS}
                            className="bg-slate-900 border-slate-600 text-slate-300 h-12 text-center text-sm md:text-base"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(BITCOIN_ADDRESS, 'on-chain')}
                            className="ml-2 text-slate-400 hover:text-white"
                          >
                            {onChainCopied ? (
                              <ConfiguredIcon 
                                iconName="Check"
                                iconConfig={iconConfigs['Check']}
                                size="w-5 h-5"
                                fallbackColor="text-green-400"
                              />
                            ) : (
                              <ConfiguredIcon 
                                iconName="Copy"
                                iconConfig={iconConfigs['Copy']}
                                size="w-5 h-5"
                                fallbackColor="text-current"
                              />
                            )}
                          </Button>
                        </div>
                        <a href={`bitcoin:${BITCOIN_ADDRESS}`} className="w-full">
                          <Button size="lg" className="w-full mt-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-lg h-14">
                            Open in Wallet
                          </Button>
                        </a>
                      </div>
                      
                      {/* On-Chain Transactions - NICHT ÄNDERN */}
                      <div className="w-full max-w-md">
                        <DonateTransactionList 
                          type="bitcoin" 
                          transactions={relevantTransactions}
                          isLoading={isLoadingTransactions}
                          iconConfigs={iconConfigs}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          ) : (
            <DonationTabsSkeleton />
          )}
        </div>
      </div>

      {/* QR Code Fullscreen Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedQRImage}
                alt={`${selectedQRType} QR Code`}
                className="w-full h-auto mx-auto rounded-lg"
              />
              <p className="text-center text-sm text-gray-600 mt-6 font-medium">
                {selectedQRType} Donation
              </p>
              <p className="text-center text-xs text-gray-400 mt-2">
                Click outside to close
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
