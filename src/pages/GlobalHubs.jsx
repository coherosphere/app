
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

export default function GlobalHubs() {
  const [copiedId, setCopiedId] = useState(null);
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    hubsGrid: false
  });

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

  const isLoading = hubsLoading || projectsLoading || eventsLoading || resonanceLoading;

  // Update global loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats section is ready when we have projects and events
    if (!projectsLoading && !eventsLoading && !hubsLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [projectsLoading, eventsLoading, hubsLoading]);

  useEffect(() => {
    // Hubs grid is ready when all data is loaded
    if (!hubsLoading && !projectsLoading && !eventsLoading && !resonanceLoading) {
      setSectionsReady(prev => ({ ...prev, hubsGrid: true }));
    }
  }, [hubsLoading, projectsLoading, eventsLoading, resonanceLoading]);

  // Enrich hubs with stats
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

  // Calculate stats
  const stats = React.useMemo(() => ({
    totalHubs: hubs.length,
    totalMembers: hubsWithStats.reduce((sum, h) => sum + (h.member_count || 0), 0),
    totalProjects: hubsWithStats.reduce((sum, h) => sum + (h.totalProjects || 0), 0),
    totalEvents: hubsWithStats.reduce((sum, h) => sum + (h.totalEvents || 0), 0)
  }), [hubs, hubsWithStats]);

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

      {/* Stats Summary */}
      {!sectionsReady.stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5" />
                <div className="h-3 w-24 bg-slate-700/30 animate-pulse rounded mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {[
            { icon: 'Globe2', value: stats.totalHubs, label: 'Total Hubs', delay: 0 },
            { icon: 'Users', value: stats.totalMembers, label: 'Total Members', delay: 0.05 },
            { icon: 'Lightbulb', value: stats.totalProjects, label: 'Total Projects', delay: 0.1 },
            { icon: 'Calendar', value: stats.totalEvents, label: 'Total Events', delay: 0.15 }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: stat.delay }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
                <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                  <div className="flex justify-center mb-1.5">
                    <ConfiguredIcon 
                      iconName={stat.icon}
                      iconConfig={iconConfigs[stat.icon]}
                      size="w-5 h-5"
                    />
                  </div>
                  <div className="text-lg font-bold text-white">{stat.value}</div>
                  <div className="text-slate-400 text-xs">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
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
