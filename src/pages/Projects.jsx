
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Project, User, ResonanceScore } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { base44 } from '@/api/base44Client';

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ProjectDetail from "@/components/projects/ProjectDetail";
import StatCard from "@/components/StatCard";

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

// Funktion, die eine Reihe von StatCard-Skeletons rendert
const renderStatCardSkeletons = (count) => {
  return Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />);
};

export default function Projects() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [scope, setScope] = useState('global');
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();
  const [error, setError] = useState(null);

  // States für Mobile-Scroll-Navigation (identisch zum Dashboard)
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = useRef(null);

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    actionButton: false,
    filters: false,
    projectsGrid: false
  });

  // Read filter from URL on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam === 'no-support') {
      setSelectedCategory('no-support');
    }
  }, []);

  // Load current user
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['projects', 'currentUser'],
    () => User.me(),
    'projects'
  );

  // Load projects
  const { data: projects = [], isLoading: projectsLoading } = useCachedData(
    ['projects', 'list'],
    () => Project.list(),
    'projects'
  );

  // Load resonance scores
  const { data: resonanceScores = [], isLoading: resonanceLoading } = useCachedData(
    ['projects', 'resonance'],
    () => ResonanceScore.filter({ entity_type: 'project' }),
    'projects'
  );

  // --- Daten laden für Stats ---
  // 1. Stat Konfigurationen laden (alle)
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['Projects', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'Projects'
  );

  // 2. Stat Werte laden (alle)
  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['Projects', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'Projects'
  );

  // 3. AppConfig für die Anzeigereihenfolge laden
  const { data: appConfigList = [] } = useCachedData(
    ['Projects', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'Projects'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;

  // Page-spezifische Anzeigereihenfolge
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Projects'] || appConfig?.stat_display_order || [];

  const isLoading = userLoading || projectsLoading || resonanceLoading;

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

  // Aktive Stat-Konfigurationen für Projects-Seite filtern
  const activeStatsForProjects = useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Projects')
    );
  }, [allStats]);

  // Sortierte Stat-Konfigurationen basierend auf displayOrder oder default sort_order
  const sortedStatConfigs = useMemo(() => {
    if (!displayOrder || displayOrder.length === 0) {
      return [...activeStatsForProjects].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const configMap = new Map(activeStatsForProjects.map(config => [config.stat_key, config]));
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
  }, [activeStatsForProjects, displayOrder]);

  // Funktion zur Formatierung des Stat-Wertes (wie auf Dashboard)
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

  // Effect für Mobile-Scroll-Logik - WICHTIG: Auch wenn nur 2 Stats, sollen Pfeile erscheinen
  useEffect(() => {
    const container = mobileStatsScrollRef.current;
    if (!container || sortedStatConfigs.length <= 1) return; // Nur bei 0 oder 1 Stat keine Pfeile

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

  // Progressive Loading steuern
  useEffect(() => {
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  useEffect(() => {
    setSectionsReady(prev => ({ ...prev, actionButton: true }));
  }, []);

  useEffect(() => {
    if (!projectsLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [projectsLoading, userLoading]);

  useEffect(() => {
    if (!projectsLoading && !resonanceLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, projectsGrid: true }));
    }
  }, [projectsLoading, resonanceLoading, userLoading]);

  // Enrich projects with resonance scores
  const enrichedProjects = useMemo(() => {
    const resonanceMap = new Map();
    resonanceScores.forEach(score => {
      resonanceMap.set(score.entity_id, score);
    });

    return projects.map(project => {
      const resonanceScore = resonanceMap.get(project.id);
      const realResonance = resonanceScore ? (resonanceScore.intensity ?? resonanceScore.score_total ?? 0) : 0;
      return {
        ...project,
        realResonance: realResonance
      };
    });
  }, [projects, resonanceScores]);

  const handleCardClick = (project) => {
    if (project.status === 'success' || project.status === 'cancelled') {
      return;
    }
    setSelectedProject(project);
    setIsDetailOpen(true);
  };

  const handleSupport = async (updatedProject) => {
    // React Query will handle cache updates automatically
  };

  const handleVote = (project) => {
    if (project.status === 'success' || project.status === 'cancelled') {
      return;
    }
    console.log("Voting on project:", project.title);
  };

  const handleProjectUpdate = (updatedProject) => {
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  };

  const filteredAndSortedProjects = () => {
    let processedProjects = [...enrichedProjects];

    if (scope === 'local' && currentUser && currentUser.hub_id) {
      processedProjects = processedProjects.filter(p => p.hub_id === currentUser.hub_id);
    }

    if (selectedCategory === 'my-supported') {
      processedProjects = processedProjects.filter(project => 
        currentUser && project.supporters?.includes(currentUser.id)
      );
    } else if (selectedCategory === 'no-support') {
      processedProjects = processedProjects.filter(project => 
        currentUser && !project.supporters?.includes(currentUser.id)
      );
    } else if (selectedCategory !== 'all') {
      processedProjects = processedProjects.filter(project => project.category === selectedCategory);
    }

    const getFundingProgress = (project) => {
      if (!project.funding_needed || project.funding_needed === 0) return 0;
      return (project.funding_raised || 0) / project.funding_needed * 100;
    };

    switch (sortBy) {
      case 'most-supported':
        processedProjects.sort((a, b) => {
          const supportDiff = (b.supporters?.length || 0) - (a.supporters?.length || 0);
          if (supportDiff !== 0) return supportDiff;
          return getFundingProgress(b) - getFundingProgress(a);
        });
        break;
      case 'highest-resonance':
        processedProjects.sort((a, b) => {
          const resonanceDiff = (b.realResonance || 0) - (a.realResonance || 0);
          if (resonanceDiff !== 0) return resonanceDiff;
          return getFundingProgress(b) - getFundingProgress(a);
        });
        break;
      case 'most-funded':
        processedProjects.sort((a, b) => {
          const fundingDiff = (b.funding_raised || 0) - (a.funding_raised || 0);
          if (fundingDiff !== 0) return fundingDiff;
          return (b.realResonance || 0) - (a.realResonance || 0);
        });
        break;
      case 'newest':
      default:
        processedProjects.sort((a, b) => {
          const dateDiff = new Date(b.created_date) - new Date(a.created_date);
          if (dateDiff !== 0) return dateDiff;
          return (b.realResonance || 0) - (a.realResonance || 0);
        });
        break;
    }

    return processedProjects;
  };

  const projectCounts = {
    all: enrichedProjects.length,
    'my-supported': currentUser ? enrichedProjects.filter(p => p.supporters?.includes(currentUser.id)).length : 0,
    'no-support': currentUser ? enrichedProjects.filter(p => !p.supporters?.includes(currentUser.id)).length : enrichedProjects.length,
    resilience: enrichedProjects.filter(p => p.category === 'resilience').length,
    technology: enrichedProjects.filter(p => p.category === 'technology').length,
    community: enrichedProjects.filter(p => p.category === 'community').length,
    learning: enrichedProjects.filter(p => p.category === 'learning').length,
    environment: enrichedProjects.filter(p => p.category === 'environment').length,
    governance: enrichedProjects.filter(p => p.category === 'governance').length,
  };

  const displayProjects = filteredAndSortedProjects();

  // --- Render Funktionen für Stat Cards ---
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

  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl">
            <ConfiguredIcon 
              iconName="AlertTriangle" 
              iconConfig={iconConfigs['AlertTriangle']}
              size="w-12 h-12"
              className="mx-auto mb-4"
            />
            <div className="text-orange-400 text-xl font-semibold mb-4">{error}</div>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <ConfiguredIcon 
              iconName="Lightbulb" 
              iconConfig={iconConfigs['Lightbulb']}
              size="w-12 h-12"
              className="flex-shrink-0"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                Community Projects
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Discover and support initiatives that resonate with your values.
        </p>
      </div>

      {/* Project Stats - KORRIGIERT: Identisch zu Dashboard mit initialem "Loading statistics..." */}
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
          <p>No stats configured for Projects. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}
      
      {/* Action Button */}
      {!sectionsReady.actionButton ? (
        <div className="mb-8">
          <div className="w-full h-12 bg-slate-700 animate-pulse rounded"></div>
        </div>
      ) : (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <Link to={createPageUrl('CreateProject')} className="flex-1">
            <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 text-base">
              <ConfiguredIcon 
                iconName="Plus" 
                iconConfig={iconConfigs['Plus']}
                size="w-5 h-5"
                className="mr-2"
              />
              Start a Project
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Filters */}
      {!sectionsReady.filters ? (
        <div className="relative z-10 mb-8">
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <div className="space-y-4">
              <div className="h-10 bg-slate-700 animate-pulse rounded w-64"></div>
              <div className="h-10 bg-slate-700 animate-pulse rounded w-48"></div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-9 w-32 bg-slate-700 animate-pulse rounded-full"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          className="relative z-10 mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          <ProjectFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
            scope={scope}
            onScopeChange={setScope}
            projectCounts={projectCounts}
            currentUser={currentUser}
          />
        </motion.div>
      )}

      {/* Projects Grid */}
      {!sectionsReady.projectsGrid ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-full flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-slate-700 animate-pulse rounded w-3/4"></div>
                    <div className="flex gap-2">
                      <div className="h-5 w-20 bg-slate-700 animate-pulse rounded-full"></div>
                      <div className="h-5 w-24 bg-slate-700 animate-pulse rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-full"></div>
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6"></div>
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-4/6"></div>
                </div>
                <div className="h-2 bg-slate-700 animate-pulse rounded mb-4"></div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="text-center">
                      <div className="h-6 bg-slate-700 animate-pulse rounded w-full mb-1"></div>
                      <div className="h-3 bg-slate-700 animate-pulse rounded w-full"></div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="h-10 bg-slate-700 animate-pulse rounded flex-1"></div>
                  <div className="h-10 w-10 bg-slate-700 animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayProjects.length === 0 ? (
        <motion.div
          className="col-span-full text-center py-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <ConfiguredIcon 
            iconName="Lightbulb" 
            iconConfig={iconConfigs['Lightbulb']}
            size="w-12 h-12"
            className="mx-auto mb-4"
          />
          <p className="text-slate-400 text-lg">
            {selectedCategory === 'my-supported' ? 'You haven\'t supported any projects yet. Start by supporting some!' :
             selectedCategory === 'no-support' ? 'You currently support all available projects!' :
             selectedCategory === 'all' ? 'No projects found at the moment.' : 
             `No ${selectedCategory} projects found.`}
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.15 }}
        >
          {displayProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onCardClick={handleCardClick}
              onSupport={handleSupport}
              onVote={handleVote}
              isDisabled={project.status === 'success' || project.status === 'cancelled'}
            />
          ))}
        </motion.div>
      )}

      {/* Project Detail Modal */}
      <ProjectDetail
        project={selectedProject}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedProject(null);
        }}
        onSupport={handleSupport}
        onVote={handleVote}
        onProjectUpdate={handleProjectUpdate}
      />
    </div>
  );
}
