
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ResourceCard from '@/components/learning/ResourceCard';
import LearningCircleCard from '@/components/learning/LearningCircleCard';
import MindfulnessCheckIn from '@/components/learning/MindfulnessCheckIn';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Resource, LearningCircle, User, DailyCheckIn } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useQueryClient } from '@tanstack/react-query';

export default function Learning() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const libraryRef = useRef(null);

  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  const queryClient = useQueryClient();

  const itemsPerPage = 20;

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    actions: false,
    filters: false,
    resourcesGrid: false,
    circlesSection: false,
    mindfulness: false
  });

  // Use cached data for resources
  const { data: resources = [], isLoading: resourcesLoading } = useCachedData(
    ['learning', 'resources'],
    () => Resource.list(),
    'learning'
  );

  // Use cached data for learning circles
  const { data: circles = [], isLoading: circlesLoading } = useCachedData(
    ['learning', 'circles'],
    () => LearningCircle.list(),
    'learning'
  );

  // Use cached data for current user
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['learning', 'currentUser'],
    () => User.me().catch(() => null),
    'learning'
  );

  // Use cached data for daily check-ins
  const { data: checkIns = [], isLoading: checkInsLoading } = useCachedData(
    ['learning', 'checkIns'],
    () => DailyCheckIn.list().catch(() => []),
    'learning'
  );

  const isLoading = resourcesLoading || circlesLoading || userLoading || checkInsLoading;

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    if (!resourcesLoading && !circlesLoading && !checkInsLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [resourcesLoading, circlesLoading, checkInsLoading]);

  useEffect(() => {
    setSectionsReady(prev => ({ ...prev, actions: true }));
  }, []);

  useEffect(() => {
    if (!resourcesLoading) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [resourcesLoading]);

  useEffect(() => {
    if (!resourcesLoading) {
      setSectionsReady(prev => ({ ...prev, resourcesGrid: true }));
    }
  }, [resourcesLoading]);

  useEffect(() => {
    if (!circlesLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, circlesSection: true }));
    }
  }, [circlesLoading, userLoading]);

  useEffect(() => {
    if (!checkInsLoading) {
      setSectionsReady(prev => ({ ...prev, mindfulness: true }));
    }
  }, [checkInsLoading]);

  const stats = {
    knowledge: resources.length,
    circles: circles.length,
    checkIns: checkIns.length,
  };

  const handleCircleUpdate = async () => {
    // Invalidate all relevant caches to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['learning', 'circles'] });
    queryClient.invalidateQueries({ queryKey: ['learning', 'currentUser'] });
    queryClient.invalidateQueries({ queryKey: ['profile', 'circles'] });
    queryClient.invalidateQueries({ queryKey: ['profile', 'user'] });
    queryClient.invalidateQueries({ queryKey: ['mindfulness', 'currentUser'] });
    
    console.log("✓ Circle caches invalidated, UI will update");
  };
  
  const handleSetSelectedCategory = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const filteredResources = selectedCategory === 'all'
    ? resources
    : resources.filter(r => r.category && r.category.replace(/ & /g, '').replace(/ /g, '') === selectedCategory);
  
  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResources = filteredResources.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'CommunityBuilding', label: 'Community Building' },
    { key: 'HolisticHealth', label: 'Holistic Health' },
    { key: 'DecentralizedTech', label: 'Decentralized Tech' },
    { key: 'NatureSustainability', label: 'Nature & Sustainability' },
  ];
  
  const getCategoryCount = (categoryKey) => {
    if (categoryKey === 'all') return resources.length;
    return resources.filter(r => r.category && r.category.replace(/ & /g, '').replace(/ /g, '') === categoryKey).length;
  };

  return (
    <div className="p-4 lg:p-8 text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="BookOpen" 
            iconConfig={iconConfigs['BookOpen']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              Learning Hub
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Explore resources, join learning circles, and share your knowledge.
        </p>
      </div>
      
      {/* Stats Section */}
      {!sectionsReady.stats ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                </div>
                <div className="h-6 w-12 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5" />
                <div className="h-3 w-20 bg-slate-700/30 animate-pulse rounded mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {[
            { icon: 'BookOpen', value: stats.knowledge, label: 'Knowledge', delay: 0 },
            { icon: 'Users', value: stats.circles, label: 'Circles', delay: 0.05 },
            { icon: 'CheckCircle', value: stats.checkIns, label: "Check-In's", delay: 0.1 }
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: stat.delay }}
            >
              <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
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
      
      {/* Action Buttons */}
      {!sectionsReady.actions ? (
        <div className="mb-8 flex flex-col md:flex-row gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 h-12 bg-slate-700 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <motion.div
          className="mb-8 flex flex-col md:flex-row gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <Link to={createPageUrl('ShareKnowledge')} className="flex-1">
            <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 text-base">
              <ConfiguredIcon 
                iconName="Plus" 
                iconConfig={iconConfigs['Plus']}
                size="w-5 h-5"
                className="mr-2"
              />
              Share Knowledge
            </Button>
          </Link>
          <Link to={createPageUrl('StartCircle')} className="flex-1">
            <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 text-base">
              <ConfiguredIcon 
                iconName="Plus" 
                iconConfig={iconConfigs['Plus']}
                size="w-5 h-5"
                className="mr-2"
              />
              Start a Learning Circle
            </Button>
          </Link>
        </motion.div>
      )}

      <div className="space-y-12">
        <section>
          <div ref={libraryRef}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold">Library of Resilience</h2>
            </div>

            {/* Filters */}
            {!sectionsReady.filters ? (
              <div className="flex flex-wrap gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 w-32 bg-slate-700 animate-pulse rounded-full" />
                ))}
              </div>
            ) : (
              <motion.div
                className="flex flex-wrap gap-2 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
              >
                {categories.map((cat, index) => (
                  <motion.div
                    key={cat.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.05 }}
                  >
                    <Button
                      onClick={() => handleSetSelectedCategory(cat.key)}
                      variant="ghost"
                      className={`filter-chip h-auto ${selectedCategory === cat.key ? 'active' : ''}`}
                    >
                      {cat.label}
                      <Badge 
                        variant="secondary" 
                        className={`ml-2 transition-colors duration-200 ${selectedCategory === cat.key ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}
                      >
                        {getCategoryCount(cat.key)}
                      </Badge>
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* Resources Grid */}
              {!sectionsReady.resourcesGrid ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-lg flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-6 bg-slate-700 animate-pulse rounded w-3/4 mb-2" />
                            <div className="h-4 bg-slate-700 animate-pulse rounded w-1/2" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                          <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedResources.length > 0 ? (
                      paginatedResources.map((resource, index) => (
                        <motion.div
                          key={resource.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: index * 0.05 }}
                        >
                          <Link to={createPageUrl(`ResourceDetail?id=${resource.id}`)}>
                            <ResourceCard resource={resource} index={index} iconConfig={iconConfigs[resource.icon_name]} />
                          </Link>
                        </motion.div>
                      ))
                    ) : (
                      <motion.p
                        className="col-span-full text-center text-slate-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.18 }}
                      >
                        No resources found for this category.
                      </motion.p>
                    )}
                  </div>
                  
                  {totalPages > 1 && (
                    <motion.div
                      className="pt-8"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: 0.1 }}
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

                      <div className="text-slate-400 text-sm text-center">
                        Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredResources.length)} of {filteredResources.length} resources
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            <aside className="lg:col-span-1">
              {!sectionsReady.mindfulness ? (
                <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
                  <CardContent className="p-6">
                    <div className="h-6 bg-slate-700 animate-pulse rounded w-48 mb-4" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                >
                  <MindfulnessCheckIn iconConfigs={iconConfigs} />
                </motion.div>
              )}
            </aside>
          </div>
        </section>

        {/* Learning Circles Section */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Learning Circles</h2>
              </div>

              {!sectionsReady.circlesSection ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
                      <CardContent className="p-6">
                        <div className="h-6 bg-slate-700 animate-pulse rounded w-2/3 mb-3" />
                        <div className="space-y-2 mb-4">
                          <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                          <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6" />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-8 w-32 bg-slate-700 animate-pulse rounded" />
                          <div className="h-4 bg-slate-700 animate-pulse rounded w-48" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {circles.length > 0 ? (
                    circles.map((circle, index) => (
                      <motion.div
                        key={circle.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: index * 0.05 }}
                      >
                        <LearningCircleCard 
                          circle={circle} 
                          index={index} 
                          currentUser={currentUser}
                          onUpdate={handleCircleUpdate}
                          iconConfigs={iconConfigs}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.p
                      className="text-center text-slate-400"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18 }}
                    >
                      No learning circles found. Be the first to start one!
                    </motion.p>
                  )}
                </div>
              )}
            </div>
            <div className="hidden lg:block"></div>
          </div>
        </section>
      </div>
    </div>
  );
}
