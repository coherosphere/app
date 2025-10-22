
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard';

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

const participationOptions = [
  {
    title: 'Send Message',
    description: 'Connect directly with community members through private, encrypted Nostr messages.',
    link: createPageUrl('Messages'),
    iconName: 'MessageSquare',
  },
  {
    title: 'Share Knowledge',
    description: 'Contribute an article, guide, or tutorial to our collective Library of Resilience.',
    link: createPageUrl('ShareKnowledge'),
    iconName: 'BookOpen',
  },
  {
    title: 'Host an Event',
    description: 'Organize a gathering, workshop, or online meetup to connect your local hub or the global community.',
    link: createPageUrl('HostEvent'),
    iconName: 'Calendar',
  },
  {
    title: 'Start a Learning Circle',
    description: 'Create or join a group to explore topics together and foster shared understanding.',
    link: createPageUrl('StartCircle'),
    iconName: 'Users',
  },
  {
    title: 'Start a Project',
    description: 'Propose a new initiative and gather community support and funding to make it a reality.',
    link: createPageUrl('CreateProject'),
    iconName: 'Lightbulb',
  },
  {
    title: 'Fund the Sphere',
    description: 'Support the coherosphere with Bitcoin donations – every sat strengthens our collective resilience.',
    link: createPageUrl('Donate'),
    iconName: 'Heart',
  },
];

export default function Engage() {
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // States für Mobile-Scroll-Navigation
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = useRef(null);

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    options: false
  });

  // Load all entities with useCachedData
  const { data: messages = [], isLoading: messagesLoading } = useCachedData(
    ['engage', 'messages'],
    async () => {
      const { NostrMessage } = await import('@/api/entities');
      return NostrMessage.list();
    },
    'engage'
  );

  const { data: resources = [], isLoading: resourcesLoading } = useCachedData(
    ['engage', 'resources'],
    async () => {
      const { Resource } = await import('@/api/entities');
      return Resource.list();
    },
    'engage'
  );

  const { data: events = [], isLoading: eventsLoading } = useCachedData(
    ['engage', 'events'],
    async () => {
      const { Event } = await import('@/api/entities');
      return Event.list();
    },
    'engage'
  );

  const { data: projects = [], isLoading: projectsLoading } = useCachedData(
    ['engage', 'projects'],
    async () => {
      const { Project } = await import('@/api/entities');
      return Project.list();
    },
    'engage'
  );

  const { data: circles = [], isLoading: circlesLoading } = useCachedData(
    ['engage', 'circles'],
    async () => {
      const { LearningCircle } = await import('@/api/entities');
      return LearningCircle.list();
    },
    'engage'
  );

  // --- Daten laden für Stats ---
  // 1. Stat Konfigurationen laden (alle)
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['engage', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'engage'
  );

  // 2. Stat Werte laden (alle)
  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['engage', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'engage'
  );

  // 3. AppConfig für die Anzeigereihenfolge laden
  const { data: appConfigList = [] } = useCachedData(
    ['engage', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'engage'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Engage'] || appConfig?.stat_display_order || [];

  const isLoading = messagesLoading || resourcesLoading || eventsLoading || projectsLoading || circlesLoading;

  // Sync loading state with global loading context
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Map für schnellen Zugriff auf Stat-Werte
  const valueMap = useMemo(() => {
    const map = {};
    allValues.forEach(value => {
      map[value.stat_key] = value;
    });
    return map;
  }, [allValues]);

  // Aktive Stat-Konfigurationen für Engage-Seite filtern
  const activeStatsForEngage = useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Engage')
    );
  }, [allStats]);

  // Sortierte Stat-Konfigurationen basierend auf displayOrder
  const sortedStatConfigs = useMemo(() => {
    if (!displayOrder || displayOrder.length === 0) {
      return [...activeStatsForEngage].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const configMap = new Map(activeStatsForEngage.map(config => [config.stat_key, config]));
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
  }, [activeStatsForEngage, displayOrder]);

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

  // Effect für Mobile-Scroll-Logik
  useEffect(() => {
    const container = mobileStatsScrollRef.current;
    if (!container || sortedStatConfigs.length <= 1) return;

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

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats ready when data loaded and stats config available
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  useEffect(() => {
    // Options always ready (static content, no data dependency)
    setSectionsReady(prev => ({ ...prev, options: true }));
  }, []);

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

  return (
    <div className="p-4 lg:p-8 text-white">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="Handshake" 
            iconConfig={iconConfigs['Handshake']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Engage with Community
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3">
          Connect, share, and contribute to coherosphere's collective knowledge.
        </p>
      </div>

      {/* Stats Section - KORRIGIERT: Identisch zu Dashboard mit initialem "Loading statistics..." */}
      {statsConfigLoading ? (
        <div className="mb-12">
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
            className="lg:hidden mb-12 relative"
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
                    <ConfiguredIcon
                      iconName="ChevronLeft"
                      iconConfig={iconConfigs['ChevronLeft']}
                      size="w-4 h-4"
                      fallbackColor="text-slate-400"
                    />
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
                    <ConfiguredIcon
                      iconName="ChevronRight"
                      iconConfig={iconConfigs['ChevronRight']}
                      size="w-4 h-4"
                      fallbackColor="text-slate-400"
                    />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Desktop Ansicht: Grid */}
          <motion.div
            className="hidden lg:grid mb-12"
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
        <div className="mb-12 text-center py-8 text-slate-400">
          <p>No stats configured for Engage. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}

      {/* Participation Options - Progressive Loading */}
      {!sectionsReady.options ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-8 flex flex-col h-full">
                <div className="w-16 h-16 bg-slate-700 animate-pulse rounded-xl mb-6" />
                <div className="flex-grow space-y-3">
                  <div className="h-7 bg-slate-700 animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6" />
                </div>
                <div className="mt-8 h-6 bg-slate-700 animate-pulse rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {participationOptions.map((option, index) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.05 }}
            >
              <Link to={option.link} className="block h-full group">
                <Card className="h-full bg-slate-800/50 backdrop-blur-sm border-slate-700 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-2xl hover:-translate-y-2 hover:border-orange-500/50">
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className="flex-shrink-0 mb-6">
                      <div className="w-16 h-16 bg-slate-700/50 rounded-xl flex items-center justify-center">
                        <ConfiguredIcon 
                          iconName={option.iconName}
                          iconConfig={iconConfigs[option.iconName]}
                          size="w-8 h-8"
                        />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-2xl font-bold text-white mb-3">{option.title}</h2>
                      <p className="text-slate-400 leading-relaxed">{option.description}</p>
                    </div>
                    <div className="mt-8">
                      <div className="flex items-center gap-2 text-orange-400 font-semibold">
                        <span>Get Started</span>
                        <ConfiguredIcon 
                          iconName="ArrowRight"
                          iconConfig={iconConfigs['ArrowRight']}
                          size="w-4 h-4"
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
