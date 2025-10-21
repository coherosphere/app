
import React, { useState, useEffect } from "react";
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

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ProjectDetail from "@/components/projects/ProjectDetail";

export default function Projects() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [scope, setScope] = useState('global');
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();
  const [error, setError] = useState(null);

  // Progressive Loading States - sections load in parallel
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

  // Use cached data
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['projects', 'currentUser'],
    () => User.me(),
    'projects'
  );

  const { data: projects = [], isLoading: projectsLoading } = useCachedData(
    ['projects', 'list'],
    () => Project.list(),
    'projects'
  );

  const { data: resonanceScores = [], isLoading: resonanceLoading } = useCachedData(
    ['projects', 'resonance'],
    () => ResonanceScore.filter({ entity_type: 'project' }),
    'projects'
  );

  const isLoading = userLoading || projectsLoading || resonanceLoading;

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Enrich projects with resonance scores
  const enrichedProjects = React.useMemo(() => {
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

  // Calculate stats
  const [stats, setStats] = useState({
    ideation: 0,
    voting: 0,
    funding: 0,
    implementation: 0,
    success: 0,
    satsRaised: 0,
    satsNeeded: 0,
  });

  useEffect(() => {
    const statusCounts = {
      ideation: enrichedProjects.filter(p => p.status === 'ideation').length,
      voting: enrichedProjects.filter(p => p.status === 'voting').length,
      funding: enrichedProjects.filter(p => p.status === 'funding').length,
      implementation: enrichedProjects.filter(p => p.status === 'launch').length,
      success: enrichedProjects.filter(p => p.status === 'success').length,
      satsRaised: enrichedProjects.reduce((sum, p) => sum + (p.funding_raised || 0), 0),
      satsNeeded: enrichedProjects.reduce((sum, p) => sum + (p.funding_needed || 0), 0),
    };
    setStats(statusCounts);
  }, [enrichedProjects]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats ready when projects loaded
    if (!projectsLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [projectsLoading]);

  useEffect(() => {
    // Action button always ready (no data dependency)
    setSectionsReady(prev => ({ ...prev, actionButton: true }));
  }, []);

  useEffect(() => {
    // Filters ready when projects and user loaded
    if (!projectsLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [projectsLoading, userLoading]);

  useEffect(() => {
    // Projects grid ready when all data loaded
    if (!projectsLoading && !resonanceLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, projectsGrid: true }));
    }
  }, [projectsLoading, resonanceLoading, userLoading]);

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
    // React Query will handle cache updates
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  };

  const filteredAndSortedProjects = () => {
    let processedProjects = [...enrichedProjects];

    // 1. Apply Scope Filter
    if (scope === 'local' && currentUser && currentUser.hub_id) {
      processedProjects = processedProjects.filter(p => p.hub_id === currentUser.hub_id);
    }

    // 2. Apply Category & Support Filter
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

    // 3. Apply Sorting
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
      {/* Header - ALWAYS VISIBLE with final content immediately */}
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

      {/* Project Stats - Progressive Loading */}
      {!sectionsReady.stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                </div>
                <div className="h-6 w-12 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5"></div>
                <div className="h-3 w-16 bg-slate-700/30 animate-pulse rounded mx-auto"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {[
            { iconName: 'Clock', value: stats.ideation, label: 'Ideation' },
            { iconName: 'Vote', value: stats.voting, label: 'Voting' },
            { iconName: 'Zap', value: stats.funding, label: 'Funding' },
            { iconName: 'GitMerge', value: stats.implementation, label: 'Implementation' },
            { iconName: 'CheckCircle', value: stats.success, label: 'Success' },
            { iconName: 'Bitcoin', value: stats.satsRaised.toLocaleString(), label: 'Sats Raised' },
            { iconName: 'Bitcoin', value: stats.satsNeeded.toLocaleString(), label: 'Sats Needed' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.05 }}
            >
              <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
                <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                  <div className="flex justify-center mb-1.5">
                    <ConfiguredIcon 
                      iconName={stat.iconName}
                      iconConfig={iconConfigs[stat.iconName]}
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
      
      {/* Interaction Buttons - Progressive Loading */}
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

      {/* Filters - Progressive Loading */}
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

      {/* Projects Grid - Progressive Loading */}
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
