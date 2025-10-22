import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Proposal, Vote, User } from "@/api/entities";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import ResonanceVisualizer from "@/components/voting/ResonanceVisualizer";
import VoteStats from "@/components/voting/VoteStats";
import { base44 } from '@/api/base44Client';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData, useCachedMutation } from '@/components/caching/useCachedData';
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

export default function Voting() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [userVotes, setUserVotes] = useState({});
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalProposals: 0,
    votingProposals: 0,
    totalVotes: 0,
  });

  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // States für Mobile-Scroll-Navigation
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const mobileStatsScrollRef = useRef(null);

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    filters: false,
    proposals: false,
    documents: false
  });

  // Use cached data for current user, proposals, and votes
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['voting', 'currentUser'],
    () => User.me(),
    'governance'
  );

  const { data: proposals = [], isLoading: proposalsLoading } = useCachedData(
    ['voting', 'proposals'],
    async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return Proposal.list();
    },
    'governance'
  );

  const { data: votes = [], isLoading: votesLoading } = useCachedData(
    ['voting', 'votes'],
    () => Vote.list(),
    'governance'
  );

  // --- Daten laden für Stats ---
  // 1. Stat Konfigurationen laden (alle)
  const { data: allStats = [], isLoading: statsConfigLoading } = useCachedData(
    ['Voting', 'statConfigurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'voting'
  );

  // 2. Stat Werte laden (alle)
  const { data: allValues = [], isLoading: statsValuesLoading } = useCachedData(
    ['Voting', 'statValues'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'voting'
  );

  // 3. AppConfig für die Anzeigereihenfolge laden
  const { data: appConfigList = [] } = useCachedData(
    ['Voting', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'voting'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {};
  const displayOrder = displayOrderByPage['Voting'] || appConfig?.stat_display_order || [];

  // Combine loading states
  const isLoading = userLoading || proposalsLoading || votesLoading;

  // Set global loading state
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

  // Aktive Stat-Konfigurationen für Voting-Seite filtern
  const activeStatsForVoting = useMemo(() => {
    return allStats.filter(config =>
      config.is_active === true &&
      config.display_on_pages &&
      Array.isArray(config.display_on_pages) &&
      config.display_on_pages.includes('Voting')
    );
  }, [allStats]);

  // Sortierte Stat-Konfigurationen basierend auf displayOrder
  const sortedStatConfigs = useMemo(() => {
    if (!displayOrder || displayOrder.length === 0) {
      return [...activeStatsForVoting].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const configMap = new Map(activeStatsForVoting.map(config => [config.stat_key, config]));
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
  }, [activeStatsForVoting, displayOrder]);

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

  // Process votes into a map, memoized for performance
  const votesByProposal = React.useMemo(() => {
    return votes.reduce((acc, vote) => {
      const proposalId = vote.proposal_id || vote.project_id;
      if (proposalId) {
        if (!acc[proposalId]) acc[proposalId] = [];
        acc[proposalId].push(vote);
      }
      return acc;
    }, {});
  }, [votes]);

  // Calculate stats based on loaded data
  useEffect(() => {
    setStats({
      totalProposals: proposals.length,
      votingProposals: proposals.filter(p => p.status === 'voting').length,
      totalVotes: votes.length,
    });
  }, [proposals, votes]);

  // Track when stats section is ready
  useEffect(() => {
    if (!statsConfigLoading && !statsValuesLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [statsConfigLoading, statsValuesLoading]);

  // Track when filters section is ready
  useEffect(() => {
    if (!proposalsLoading) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [proposalsLoading]);

  // Track when proposals list is ready
  useEffect(() => {
    if (!proposalsLoading && !votesLoading && !userLoading) {
      setSectionsReady(prev => ({ ...prev, proposals: true }));
    }
  }, [proposalsLoading, votesLoading, userLoading]);

  // Track when documents section is ready
  useEffect(() => {
    setSectionsReady(prev => ({ ...prev, documents: true }));
  }, []);

  // Mutation hook for creating votes
  const createVoteMutation = useCachedMutation(
    async (voteData) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return await Vote.create(voteData);
    },
    {
      invalidateQueries: [['voting', 'votes']],
    }
  );

  const handleVote = async (proposalId, voteType) => {
    const voterId = currentUser?.id || `user_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await createVoteMutation.mutateAsync({
        proposal_id: proposalId,
        voter_id: voterId,
        vote_type: voteType,
        weight: 1.0,
      });
      
      setUserVotes(prev => ({ ...prev, [proposalId]: true }));

      // Record resonance event for governance participation
      try {
        const proposal = proposals.find(p => p.id === proposalId);
        
        let magnitude = 1.0;
        const now = new Date();
        
        if (proposal?.voting_deadline) {
          const deadline = new Date(proposal.voting_deadline);
          const votingStart = new Date(deadline.getTime() - 7 * 24 * 60 * 60 * 1000);
          const earlyVotingEnd = new Date(votingStart.getTime() + 24 * 60 * 60 * 1000);
          
          if (now < earlyVotingEnd && now >= votingStart) {
            magnitude += 0.1;
            console.log('✓ Early voting bonus applied (+0.1)');
          }
        }

        await base44.functions.invoke('recordResonanceEvent', {
          entity_type: 'user',
          entity_id: voterId,
          action_type: 'GOVERNANCE_VOTE',
          magnitude: magnitude,
          alignment_score: 1.0,
          metadata: {
            proposal_id: proposalId,
            proposal_title: proposal?.title || '',
            vote_type: voteType,
            is_early_vote: magnitude > 1.0
          }
        });

        await base44.functions.invoke('recordResonanceEvent', {
          entity_type: 'proposal',
          entity_id: proposalId,
          action_type: 'GOVERNANCE_VOTE',
          magnitude: 0.5,
          alignment_score: 1.0,
          metadata: {
            voter_id: voterId,
            vote_type: voteType
          }
        });

        console.log('✓ Governance vote resonance event recorded');
      } catch (error) {
        console.error('Failed to record resonance event:', error);
      }

    } catch (error) {
      console.error("Error casting vote:", error);
      setError("Failed to cast vote. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const categoryColors = {
    governance: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    treasury: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    policy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    technical: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    community: 'bg-green-500/20 text-green-400 border-green-500/30',
    default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const statusConfig = {
    draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: 'FileText', label: 'Draft' },
    voting: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: 'Vote', label: 'Voting' },
    passed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: 'CheckCircle', label: 'Passed' },
    rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: 'X', label: 'Rejected' },
    implemented: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: 'GitMerge', label: 'Implemented' },
    default: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: 'Archive', label: 'Archived' },
  };

  const filteredProposals = React.useCallback(() => {
    let filtered = proposals;
    if (selectedFilter !== 'all') {
      filtered = proposals.filter(p => p.status === selectedFilter);
    }
    
    const statusPriority = {
      voting: 1,
      draft: 2,
      proposed: 2,
      passed: 3,
      rejected: 3,
      implemented: 3,
    };

    return filtered.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 4;
      const priorityB = statusPriority[b.status] || 4;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      if (a.status === 'voting') {
        const deadlineA = a.voting_deadline ? new Date(a.voting_deadline).getTime() : 0;
        const deadlineB = b.voting_deadline ? new Date(b.voting_deadline).getTime() : 0;
        if (deadlineA !== deadlineB) {
          return deadlineB - deadlineA;
        }
      } 
      
      const createdA = new Date(a.created_date).getTime();
      const createdB = new Date(b.created_date).getTime();
      return createdB - createdA;
    });
  }, [proposals, selectedFilter]);
  
  const getTimeRemaining = (proposal) => {
    if (proposal.status !== 'voting' || !proposal.voting_deadline) return null;
    const now = new Date();
    const deadline = new Date(proposal.voting_deadline);
    const diffTime = deadline - now;
    if (diffTime <= 0) return "Voting ended";
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} left`;
  };

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

  // Skeleton Components
  const FiltersSkeleton = () => (
    <div className="mb-8">
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <div className="h-4 w-32 bg-slate-700 animate-pulse rounded mb-4" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 w-32 bg-slate-700/30 animate-pulse rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );

  const ProposalsSkeleton = () => (
    <div className="space-y-8">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="h-7 w-3/4 bg-slate-700 animate-pulse rounded mb-4" />
            <div className="flex gap-2 mb-3">
              <div className="h-6 w-20 bg-slate-700 animate-pulse rounded" />
              <div className="h-6 w-20 bg-slate-700 animate-pulse rounded" />
            </div>
            <div className="h-4 w-full bg-slate-700 animate-pulse rounded mb-2" />
            <div className="h-4 w-2/3 bg-slate-700 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-slate-700/20 animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <ConfiguredIcon 
              iconName="AlertTriangle"
              iconConfig={iconConfigs['AlertTriangle']}
              size="w-5 h-5"
              fallbackColor="text-orange-400"
            />
            <div className="text-orange-400 font-medium">{error}</div>
          </div>
        </motion.div>
      )}

      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <ConfiguredIcon 
            iconName="Vote" 
            iconConfig={iconConfigs['Vote']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              Governance & Proposals
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Shape our future together through transparent community decision-making.
        </p>
      </div>

      {/* Voting Stats - KORRIGIERT: Identisch zu Dashboard mit initialem "Loading statistics..." */}
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
          <p>No stats configured for Voting. Visit <Link to={createPageUrl('StatsAdmin')} className="text-orange-400 hover:text-orange-300 underline">Stats Admin</Link> to configure.</p>
        </div>
      )}

      {/* Filters - Progressive Loading */}
      {sectionsReady.filters ? (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ConfiguredIcon 
                iconName="Filter"
                iconConfig={iconConfigs['Filter']}
                size="w-4 h-4"
                fallbackColor="text-slate-400"
              />
              <span className="text-sm font-medium text-slate-300">Filter Proposals</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Proposals', count: proposals.length },
                { key: 'draft', label: 'Draft', count: proposals.filter(p=>p.status==='draft').length },
                { key: 'voting', label: 'Voting', count: proposals.filter(p=>p.status==='voting').length },
                { key: 'passed', label: 'Passed', count: proposals.filter(p=>p.status==='passed').length },
                { key: 'rejected', label: 'Rejected', count: proposals.filter(p=>p.status==='rejected').length },
                { key: 'implemented', label: 'Implemented', count: proposals.filter(p=>p.status==='implemented').length },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFilter(filter.key)}
                  className={`filter-chip h-auto justify-between min-w-fit whitespace-nowrap ${selectedFilter === filter.key ? 'active' : ''}`}
                >
                  <span className="flex-shrink-0">{filter.label}</span>
                  <Badge 
                    variant="secondary" 
                    className={`ml-[3px] transition-colors duration-200 flex-shrink-0 ${
                      selectedFilter === filter.key
                      ? 'bg-black/20 text-white' 
                      : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {filter.count || 0}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <FiltersSkeleton />
      )}

      {/* Voting Proposals - Progressive Loading */}
      {sectionsReady.proposals ? (
        <div className="space-y-8 lg:space-y-12">
          {filteredProposals().length > 0 ? (
            filteredProposals().map((proposal, index) => {
              const isClosedForInteraction = ['passed', 'rejected', 'implemented'].includes(proposal.status);
              const canVote = proposal.status === 'voting' && proposal.voting_deadline && new Date() < new Date(proposal.voting_deadline);
              const timeRemaining = getTimeRemaining(proposal);
              const currentStatusConfig = statusConfig[proposal.status] || statusConfig.default;
              
              return (
                <motion.div
                  key={proposal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 + index * 0.05 }}
                >
                  <Card className={`transition-all duration-300 ${
                    isClosedForInteraction 
                      ? 'bg-slate-800/20 border-slate-800 opacity-60 cursor-not-allowed'
                      : 'bg-slate-800/50 backdrop-blur-sm border border-slate-700'
                  }`}>
                    <CardHeader>
                      <CardTitle className={`text-2xl font-bold mb-2 ${
                        isClosedForInteraction ? 'text-slate-500' : 'text-white'
                      }`}>
                        {proposal.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={`border text-xs ${categoryColors[proposal.category?.toLowerCase()] || categoryColors.default} ${
                            isClosedForInteraction ? 'opacity-50' : ''
                          }`}
                        >
                          {proposal.category}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`border text-xs ${currentStatusConfig.color} ${
                            isClosedForInteraction ? 'opacity-50' : ''
                          }`}
                        >
                          {currentStatusConfig.label}
                        </Badge>
                        {proposal.created_date && (
                          <div className={`text-xs flex items-center gap-1 ${
                            isClosedForInteraction ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            <ConfiguredIcon 
                              iconName="Calendar"
                              iconConfig={iconConfigs['Calendar']}
                              size="w-3 h-3"
                              fallbackColor="currentColor"
                            />
                            Created {new Date(proposal.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                          </div>
                        )}
                        {timeRemaining && (
                          <div className={`text-xs flex items-center gap-1 ${canVote ? 'text-orange-400' : 'text-slate-500'}`}>
                            <ConfiguredIcon 
                              iconName="Clock"
                              iconConfig={iconConfigs['Clock']}
                              size="w-3 h-3"
                              fallbackColor="currentColor"
                            />
                            {timeRemaining}
                          </div>
                        )}
                      </div>
                      <p className={`${isClosedForInteraction ? 'text-slate-600' : 'text-slate-400'}`}>
                        {proposal.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid lg:grid-cols-2 gap-8 items-start">
                        <div className={isClosedForInteraction ? 'opacity-50' : ''}>
                          <ResonanceVisualizer votes={votesByProposal[proposal.id]} />
                        </div>
                        <VoteStats 
                          proposal={proposal} 
                          votes={votesByProposal[proposal.id]}
                          projectId={proposal.id}
                          onVote={handleVote}
                          userHasVoted={userVotes[proposal.id]}
                          isDisabled={!canVote}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })
          ) : (
            <div className="text-center py-20">
              <ConfiguredIcon 
                iconName="Vote"
                iconConfig={iconConfigs['Vote']}
                size="w-16 h-16"
                className="mx-auto mb-4"
                fallbackColor="text-slate-600"
              />
              <h2 className="text-2xl font-bold text-white">
                No Proposals Available
              </h2>
              <p className="text-slate-400 mt-2">
                {selectedFilter === 'all' ? 'Check back soon for new governance proposals.' :
                 `No proposals found with status "${selectedFilter}".`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <ProposalsSkeleton />
      )}

      {/* Governance Documents Section - Progressive Loading */}
      {sectionsReady.documents && (
        <motion.div
          className="mt-16 pt-8 border-t border-slate-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.15 }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Governance Documents</h2>
            <p className="text-slate-400">
              Explore the detailed frameworks that guide our decentralized governance model.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Governance Model Whitepaper */}
            <motion.a
              href="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d16297dc6ef6561cfa083f/135c0b429_GovernanceModelWhitepaperPublicv10.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl p-6 transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col">
                <div className="flex items-start gap-4 flex-grow">
                  <ConfiguredIcon 
                    iconName="FileText"
                    iconConfig={iconConfigs['FileText']}
                    size="w-8 h-8"
                    className="flex-shrink-0 mt-1 text-white"
                    fallbackColor="text-white"
                  />
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-2">
                      Governance Model Whitepaper
                    </h3>
                    <p className="text-white/90 text-sm mb-4 flex-grow">
                      The concrete framework of rules, processes, and formulas that operationalize our Manifesto through Proof-of-Contribution governance.
                    </p>
                    <div className="flex items-center gap-2 text-white/80 text-sm mt-auto">
                      <Badge className="bg-white/20 text-white border-white/30">
                        v1.0 – Public
                      </Badge>
                      <span>•</span>
                      <span>9 pages</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.a>

            {/* Metrics & Perspectives */}
            <motion.a
              href="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d16297dc6ef6561cfa083f/19effe538_MetricsPerspectivesPublicv10.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl p-6 transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col">
                <div className="flex items-start gap-4 flex-grow">
                  <ConfiguredIcon 
                    iconName="TrendingUp"
                    iconConfig={iconConfigs['TrendingUp']}
                    size="w-8 h-8"
                    className="flex-shrink-0 mt-1 text-white"
                    fallbackColor="text-white"
                  />
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-2">
                      Metrics & Perspectives
                    </h3>
                    <p className="text-white/90 text-sm mb-4 flex-grow">
                      A KPI system of resonance through six layers: alignment, members, knowledge, projects, resilience, and the sphere itself.
                    </p>
                    <div className="flex items-center gap-2 text-white/80 text-sm mt-auto">
                      <Badge className="bg-white/20 text-white border-white/30">
                        v1.0 – Public
                      </Badge>
                      <span>•</span>
                      <span>7 pages</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.a>
          </div>
        </motion.div>
      )}
    </div>
  );
}