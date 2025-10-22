import React, { useState, useEffect } from "react";
import { Hub, Project, Event, ResonanceScore } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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

export default function GlobalHubs() {
  const [copiedId, setCopiedId] = useState(null);
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    hubsGrid: false
  });

  // States für Mobile-Scroll-Navigation
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = React.useRef(null);

  // Use cached data with correct 'globalHubs' domain
  const { data: hubs = [], isLoading: hubsLoading } = useCachedData(
    ['globalHubs', 'hubs'],
    () => Hub.list(),
    'globalHubs' 
  );

  const { data: allProjects = [], isLoading: projectsLoading } = useCachedData(
    ['globalHubs', 'projects'],
    () => Project.list(),
    'globalHubs' 
  );

  const { data: allEvents = [], isLoading: eventsLoading } = useCachedData(
    ['globalHubs', 'events'],
    () => Event.list(),
    'globalHubs' 
  );

  const { data: allResonanceScores = [], isLoading: resonanceLoading } = useCachedData(
    ['globalHubs', 'resonance'],
    () => ResonanceScore.filter({ entity_type: 'hub' }),
    'globalHubs' 
  );

  // --- NEU: Daten laden für dynamische Stats ---
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['GlobalHubs', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'globalHubs'
  );

  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['GlobalHubs', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'globalHubs'
  );

  const { data: appConfigList = [] } = useCachedData(
    ['GlobalHubs', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'globalHubs'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['GlobalHubs'] || [];

  const isLoading = hubsLoading || projectsLoading || eventsLoading || resonanceLoading || statsConfigLoading || statsValuesLoading;

  // Update global loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Map für schnellen Zugriff auf Stat-Werte
  const valueMap = React.useMemo(() => {
    const map = {};
    allValues.forEach(value => {
      map[value.stat_key] = value;
    });
    return map;
  }, [allValues]);

  // Aktive Stat-Konfigurationen für GlobalHubs-Seite filtern
  const activeStatsForGlobalHubs = React.useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('GlobalHubs')
    );
  }, [allStats]);

  // Sortierte Stat-Konfigurationen basierend auf displayOrder
  const sortedStatConfigs = React.useMemo(() => {
    if (!displayOrder || displayOrder.length === 0) {
      return [...activeStatsForGlobalHubs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const configMap = new Map(activeStatsForGlobalHubs.map(config => [config.stat_key, config]));
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
  }, [activeStatsForGlobalHubs, displayOrder]);

  // Funktion zur Formatierung des Stat-Wertes
  const formatStatValue = (config, value) => {
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
  };

  // Mobile-Scroll-Position überprüfen
  const checkScrollPosition = React.useCallback(() => {
    const container = mobileStatsScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;

    setShowLeftArrow(scrollLeft > 20);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
  }, []);

  // Mobile-Scroll handhaben
  const handleScroll = React.useCallback((direction) => {
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
    if (!container || sortedStatConfigs.length <= 1) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }

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

  // Track when stats data is ready
  useEffect(() => {
    if (!statsConfigLoading && !statsValuesLoading && !hubsLoading && !projectsLoading && !eventsLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading, hubsLoading, projectsLoading, eventsLoading]);

  useEffect(() => {
    if (!hubsLoading && !projectsLoading && !eventsLoading && !resonanceLoading) {
      setSectionsReady(prev => ({ ...prev, hubsGrid: true }));
    }
  }, [hubsLoading, projectsLoading, eventsLoading, resonanceLoading]);

  // Enrich hubs with stats (keep existing logic for hubsGrid)
  const hubsWithStats = React.useMemo(() => {
    const resonanceMap = new Map();
    allResonanceScores.forEach(score => {
      resonanceMap.set(score.entity_id, score);
    });

    const enriched = hubs.map((hub) => {
      const hubProjects = allProjects.filter(p => p.hub_id === hub.id);
      const hubEvents = allEvents.filter(e => e.hub_id === hub.id);

      const activeProjects = hubProjects.filter(p => 
        ['active', 'voting', 'proposed', 'ideation', 'planning', 'funding', 'launch'].includes(p.status)
      ).length;

      const resonanceScore = resonanceMap.get(hub.id);
      const realResonance = resonanceScore ? (resonanceScore.intensity || resonanceScore.score_total) : 0;

      return {
        ...hub,
        totalProjects: hubProjects.length,
        activeProjects: activeProjects,
        totalEvents: hubEvents.length,
        upcomingEvents: hubEvents.filter(e => new Date(e.date) > new Date()).length,
        realResonance: realResonance
      };
    });

    enriched.sort((a, b) => {
      if (b.realResonance !== a.realResonance) {
        return b.realResonance - a.realResonance;
      }
      return (b.member_count || 0) - (a.member_count || 0);
    });

    return enriched;
  }, [hubs, allProjects, allEvents, allResonanceScores]);

  const handleCopyId = (hubId) => {
    navigator.clipboard.writeText(hubId);
    setCopiedId(hubId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Render Funktionen für Stat Cards
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
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="Globe2" 
            iconConfig={iconConfigs['Globe2']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Global Hubs
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Explore and connect with coherosphere hubs around the world.
        </p>
      </div>

      {/* Dynamische Stats Section */}
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
          <p>No stats configured for GlobalHubs. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}

      {/* Hubs Grid */}
      {!sectionsReady.hubsGrid ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                {/* Hub Header Skeleton */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-full flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-6 bg-slate-700 animate-pulse rounded w-48 mb-2" />
                      <div className="h-4 bg-slate-700 animate-pulse rounded w-32" />
                    </div>
                  </div>
                </div>

                {/* Description Skeleton */}
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-3/4" />
                </div>

                {/* Stats Grid Skeleton */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="h-4 bg-slate-700 animate-pulse rounded w-16 mb-2" />
                      <div className="h-6 bg-slate-700 animate-pulse rounded w-12" />
                    </div>
                  ))}
                </div>

                {/* Footer Skeleton */}
                <div className="pt-3 border-t border-slate-700">
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hubsWithStats.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700">
            <CardContent className="p-12 text-center">
              <ConfiguredIcon 
                iconName="Globe2" 
                iconConfig={iconConfigs['Globe2']}
                size="w-16 h-16"
                className="mx-auto mb-4"
              />
              <h3 className="text-xl font-bold text-white mb-2">No Hubs Found</h3>
              <p className="text-slate-400">The resonance network is being initialized...</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hubsWithStats.map((hub, index) => (
            <motion.div
              key={hub.id}
              className="h-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 hover:bg-slate-800/60 transition-all duration-300 h-full flex flex-col">
                <CardContent className="p-6 space-y-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center resonance-glow"
                        style={{
                          boxShadow: `0 0 ${20 * Math.max(1, hub.realResonance / 10)}px rgba(255, 106, 0, ${0.3 * Math.max(0.5, Math.min(1, hub.realResonance / 20))})`
                        }}
                      >
                        <ConfiguredIcon 
                          iconName="MapPin" 
                          iconConfig={iconConfigs['MapPin']}
                          size="w-6 h-6"
                          className="text-white"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl text-white mb-1 font-semibold">{hub.name}</h3>
                        <p className="text-sm text-slate-400">{hub.location}</p>
                      </div>
                    </div>
                  </div>

                  {hub.description && (
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {hub.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 flex-grow">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <ConfiguredIcon 
                          iconName="Users" 
                          iconConfig={iconConfigs['Users']}
                          size="w-4 h-4"
                        />
                        <span className="text-xs">Members</span>
                      </div>
                      <div className="text-lg font-bold text-white">{hub.member_count || 0}</div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <ConfiguredIcon 
                          iconName="Lightbulb" 
                          iconConfig={iconConfigs['Lightbulb']}
                          size="w-4 h-4"
                        />
                        <span className="text-xs">Projects</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {hub.totalProjects || 0}
                        {hub.activeProjects > 0 && (
                          <span className="text-xs text-green-400 ml-1">({hub.activeProjects} active)</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <ConfiguredIcon 
                          iconName="Calendar" 
                          iconConfig={iconConfigs['Calendar']}
                          size="w-4 h-4"
                        />
                        <span className="text-xs">Events</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {hub.totalEvents || 0}
                        {hub.upcomingEvents > 0 && (
                          <span className="text-xs text-cyan-400 ml-1">({hub.upcomingEvents} upcoming)</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <ConfiguredIcon 
                          iconName="Activity" 
                          iconConfig={iconConfigs['Activity']}
                          size="w-4 h-4"
                        />
                        <span className="text-xs">Resonance</span>
                      </div>
                      <div className="text-lg font-bold text-orange-400">
                        {hub.realResonance > 0 ? hub.realResonance.toFixed(1) : '0.0'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700 mt-auto">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">Hub ID:</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                          {hub.id.substring(0, 8)}...{hub.id.substring(hub.id.length - 8)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-white"
                          onClick={() => handleCopyId(hub.id)}
                        >
                          {copiedId === hub.id ? (
                            <ConfiguredIcon 
                              iconName="Check" 
                              iconConfig={iconConfigs['Check']}
                              size="w-3 h-3"
                              className="text-green-400"
                            />
                          ) : (
                            <ConfiguredIcon 
                              iconName="Copy" 
                              iconConfig={iconConfigs['Copy']}
                              size="w-3 h-3"
                            />
                          )}
                        </Button>
                        <Link to={`${createPageUrl("Hub")}?hubId=${hub.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-orange-400 transition-colors"
                            title="View this hub"
                          >
                            <ConfiguredIcon 
                              iconName="ArrowRight" 
                              iconConfig={iconConfigs['ArrowRight']}
                              size="w-3 h-3"
                            />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}