
import React, { useState, useEffect } from "react";
import { Hub, Project, Event, User } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectDetail from "@/components/projects/ProjectDetail";
import EventCard from "@/components/hub/EventCard";
import MemberCard from "@/components/hub/MemberCard";
import EventDetail from "@/components/hub/EventDetail";
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

// Mock data for members as we can't insert into User entity
const mockMembers = [
  { id: '1', display_name: 'ResonantDev', bio: 'Building bridges between worlds.', avatar_url: 'https://i.pravatar.cc/150?u=dev1', skills: ['React', 'Solidity', 'Design'] },
  { id: '2', display_name: 'CommunityWeaver', bio: 'Connecting people and ideas.', avatar_url: 'https://i.pravatar.cc/150?u=dev2', skills: ['Facilitation', 'Writing'] },
  { id: '3', display_name: 'EcoSAGE', bio: 'Nurturing resilient ecosystems.', avatar_url: 'https://i.pravatar.cc/150?u=dev3', skills: ['Permaculture', 'Systems Thinking'] },
  { id: '4', display_name: 'TechAlchemist', bio: 'Transmuting code into value.', avatar_url: 'https://i.pravatar.cc/150?u=dev4', skills: ['AI', 'Nostr', 'Bitcoin'] },
  { id: '5', display_name: 'StorySeer', bio: 'Weaving narratives of the future.', avatar_url: 'https://i.pravatar.cc/150?u=dev5', skills: ['Filmmaking', 'Storytelling'] },
  { id: '6', display_name: 'SoundHealer', bio: 'Harmonizing communities with sound.', avatar_url: 'https://i.pravatar.cc/150?u=dev6', skills: ['Music', 'Meditation'] }
];

export default function HubPage() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('members');
  const [isExternalHub, setIsExternalHub] = useState(false);
  const [hubId, setHubId] = useState(null);
  const [hub, setHub] = useState(null);
  const [stats, setStats] = useState({
    members: mockMembers.length,
    projects: 0,
    events: 0,
    satsRaised: 0,
    satsNeeded: 0,
    hubResonance: 0,
  });

  // Progressive Loading States - each section loads in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    actions: false,
    tabs: false,
    content: false
  });

  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // Determine which hub to load (from URL or user's selected hub)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hubIdParam = urlParams.get('hubId');
    
    if (hubIdParam) {
      setIsExternalHub(true);
      setHubId(hubIdParam);
    } else {
      setIsExternalHub(false);
      setHubId('user'); // Will fetch user first to get their hub_id
    }
  }, []);

  // Use cached data for current user (only if not external hub)
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['hub', 'currentUser'],
    () => User.me(),
    'hub',
    { enabled: hubId === 'user' } // Only fetch if we need user's hub
  );

  // Determine actual hub ID after user is loaded
  const actualHubId = hubId === 'user' ? currentUser?.hub_id : hubId;

  // Use cached data for hubs
  const { data: allHubs = [], isLoading: hubsLoading } = useCachedData(
    ['hub', 'hubs'],
    () => Hub.list(),
    'hub',
    { enabled: !!actualHubId } // Only fetch when we have a hub ID
  );

  // Use cached data for projects
  const { data: projects = [], isLoading: projectsLoading } = useCachedData(
    ['hub', 'projects', actualHubId],
    () => Project.filter({ hub_id: actualHubId }),
    'hub',
    { enabled: !!actualHubId }
  );

  // Use cached data for events
  const { data: events = [], isLoading: eventsLoading } = useCachedData(
    ['hub', 'events', actualHubId],
    () => Event.filter({ hub_id: actualHubId }),
    'hub',
    { enabled: !!actualHubId }
  );

  // Use cached data for resonance score
  const { data: resonanceData, isLoading: resonanceLoading } = useCachedData(
    ['hub', 'resonance', actualHubId],
    async () => {
      try {
        const response = await base44.functions.invoke('getResonanceScore', {
          entity_type: 'hub',
          entity_id: actualHubId
        });
        return response.data;
      } catch (error) {
        console.error('Error loading hub resonance:', error);
        return null;
      }
    },
    'hub',
    { enabled: !!actualHubId }
  );

  const isLoading = (hubId === 'user' && userLoading) || hubsLoading || projectsLoading || eventsLoading || resonanceLoading;

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Set hub when data is loaded
  useEffect(() => {
    if (!actualHubId || allHubs.length === 0) return;

    const currentHub = allHubs.find(h => h.id === actualHubId);
    
    if (!currentHub) {
      if (isExternalHub) {
        setError("Hub not found. Please select a valid hub from the Global Hubs page.");
      } else {
        setError("Your selected hub could not be found. Please choose a new one in your profile.");
      }
      setHub(null);
      return;
    }

    setHub(currentHub);
    setError(null);
  }, [actualHubId, allHubs, isExternalHub]);

  // Calculate stats when data changes
  useEffect(() => {
    if (!hub) return;

    const satsRaised = projects.reduce((sum, p) => sum + (p.funding_raised || 0), 0);
    const satsNeeded = projects.reduce((sum, p) => sum + (p.funding_needed || 0), 0);
    const hubResonanceScore = resonanceData?.exists ? (resonanceData.score_total || 0) : 0;

    setStats({
      members: mockMembers.length,
      projects: projects.length,
      events: events.length,
      satsRaised,
      satsNeeded,
      hubResonance: hubResonanceScore,
    });
  }, [hub, projects, events, resonanceData]);

  // Progressive reveal effect - triggered when data is ready
  useEffect(() => {
    if (!hub || isLoading) {
      // Reset all sections when loading
      setSectionsReady({
        stats: false,
        actions: false,
        tabs: false,
        content: false
      });
      return;
    }

    // Data is ready - reveal all sections in parallel with slight stagger
    const staggerDelay = 50; // 50ms stagger between sections
    
    setTimeout(() => setSectionsReady(prev => ({ ...prev, stats: true })), 0);
    setTimeout(() => setSectionsReady(prev => ({ ...prev, actions: true })), staggerDelay);
    setTimeout(() => setSectionsReady(prev => ({ ...prev, tabs: true })), staggerDelay * 2);
    setTimeout(() => setSectionsReady(prev => ({ ...prev, content: true })), staggerDelay * 3);
  }, [hub, isLoading]);

  const handleCardClick = (project) => {
    if (project.status === 'completed' || project.status === 'cancelled') {
      return;
    }
    setSelectedProject(project);
    setIsDetailOpen(true);
  };

  const handleSupport = async (project) => {
    try {
      const currentUser = await User.me();
      
      const currentSupporters = project.supporters || [];
      if (currentSupporters.includes(currentUser.id)) {
        console.log('User is already supporting this project');
        return;
      }

      const updatedSupporters = [...currentSupporters, currentUser.id];
      
      await Project.update(project.id, {
        ...project,
        goal: project.goal || project.description || "Project goal",
        manifesto_compliance: project.manifesto_compliance || true,
        community_commitment: project.community_commitment || true,
        supporters: updatedSupporters
      });

      console.log(`Successfully added support! Total supporters: ${updatedSupporters.length}`);
      
    } catch (error) {
      console.error('Error supporting project:', error);
    }
  };

  const handleVote = (project) => {
    if (project.status === 'completed' || project.status === 'cancelled') {
      return;
    }
    console.log("Voting on project:", project.title);
  };

  const handleProjectUpdate = (updatedProject) => {
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  };

  const handleEventViewDetails = (event) => {
    setSelectedEvent(event);
    setIsEventDetailOpen(true);
  };

  const handleEventUpdate = (updatedEvent) => {
    if (selectedEvent && selectedEvent.id === updatedEvent.id) {
      setSelectedEvent(updatedEvent);
    }
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
            {error.includes("profile") ? (
              <Link to={createPageUrl("Profile")}>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  <ConfiguredIcon 
                    iconName="User" 
                    iconConfig={iconConfigs['User']}
                    size="w-4 h-4"
                    className="mr-2"
                  />
                  Go to Profile
                </Button>
              </Link>
            ) : error.includes("Hub not found") ? (
              <Link to={createPageUrl("GlobalHubs")}>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  <ConfiguredIcon 
                    iconName="Globe2" 
                    iconConfig={iconConfigs['Globe2']}
                    size="w-4 h-4"
                    className="mr-2"
                  />
                  Go to Global Hubs
                </Button>
              </Link>
            ) : (
              <Button 
                onClick={() => window.location.reload()}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Refresh Page
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Motion variants for fade-in
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.18 } }
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="MapPin" 
            iconConfig={iconConfigs['MapPin']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              {hub?.name || 'Local Hub'}
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          {hub?.description || 'Loading hub information...'}
        </p>
          
        {isExternalHub && (
          <div className="mt-4"> {/* Added a div to wrap the button and give it margin-top */}
            <Link to={createPageUrl("Hub")}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1.5"
              >
                <ConfiguredIcon 
                  iconName="ArrowLeft" 
                  iconConfig={iconConfigs['ArrowLeft']}
                  size="w-3 h-3"
                />
                Back to my hub
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats Section */}
      {!sectionsReady.stats ? (
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
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
        </div>
      ) : (
        <motion.div
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <Link to={`${createPageUrl('HubResonance')}?hubId=${hub.id}`} className="block">
              <Card className="bg-slate-800/50 backdrop-blur-sm border-orange-500/50 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 h-[98px] overflow-hidden cursor-pointer group">
                <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ConfiguredIcon 
                      iconName="Activity" 
                      iconConfig={iconConfigs['Activity']}
                      size="w-5 h-5"
                      className="group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <div className="text-lg font-bold text-orange-400">{Math.round(stats.hubResonance)}</div>
                  <div className="text-slate-300 text-xs flex items-center justify-center gap-1">
                    Hub Resonance
                    <ConfiguredIcon 
                      iconName="TrendingUp" 
                      iconConfig={iconConfigs['TrendingUp']}
                      size="w-3 h-3"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Users" 
                    iconConfig={iconConfigs['Users']}
                    size="w-5 h-5"
                  />
                </div>
                <div className="text-lg font-bold text-white">{stats.members}</div>
                <div className="text-slate-400 text-xs">Members</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Lightbulb" 
                    iconConfig={iconConfigs['Lightbulb']}
                    size="w-5 h-5"
                  />
                </div>
                <div className="text-lg font-bold text-white">{stats.projects}</div>
                <div className="text-slate-400 text-xs">Projects</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Calendar" 
                    iconConfig={iconConfigs['Calendar']}
                    size="w-5 h-5"
                  />
                </div>
                <div className="text-lg font-bold text-white">{stats.events}</div>
                <div className="text-slate-400 text-xs">Events</div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Bitcoin" 
                    iconConfig={iconConfigs['Bitcoin']}
                    size="w-5 h-5"
                  />
                </div>
                <div className="text-lg font-bold text-white">{stats.satsRaised.toLocaleString()}</div>
                <div className="text-slate-400 text-xs">Sats Raised</div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Bitcoin" 
                    iconConfig={iconConfigs['Bitcoin']}
                    size="w-5 h-5"
                  />
                </div>
                <div className="text-lg font-bold text-white">{stats.satsNeeded.toLocaleString()}</div>
                <div className="text-slate-400 text-xs">Sats Needed</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Action Buttons Section */}
      {!sectionsReady.actions ? (
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-700 animate-pulse rounded" />
            <div className="flex-1 h-10 bg-slate-700 animate-pulse rounded" />
          </div>
        </div>
      ) : (
        <motion.div
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="flex flex-col md:flex-row gap-3">
            <Link to={createPageUrl('CreateProject') + `?hubId=${hub.id}`} className="flex-1">
              <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold">
                <ConfiguredIcon 
                  iconName="Plus" 
                  iconConfig={iconConfigs['Plus']}
                  size="w-4 h-4"
                  className="mr-2"
                />
                Start a Project
              </Button>
            </Link>
            <Link to={createPageUrl('HostEvent') + `?hubId=${hub.id}`} className="flex-1">
              <Button className="w-full bg-gradient-to-r from-turquoise-500 to-cyan-500 hover:from-turquoise-600 hover:to-cyan-600 text-white font-semibold">
                <ConfiguredIcon 
                  iconName="Plus" 
                  iconConfig={iconConfigs['Plus']}
                  size="w-4 h-4"
                  className="mr-2"
                />
                Host an Event
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation Section */}
      {!sectionsReady.tabs ? (
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-32 bg-slate-700 animate-pulse rounded-full" />
            ))}
          </div>
        </div>
      ) : (
        <motion.div
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setActiveTab('members')}
              variant="ghost"
              className={`
                filter-chip h-auto p-2 px-4 rounded-full transition-colors duration-200 
                flex items-center justify-center space-x-[3px]
                ${activeTab === 'members' 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' 
                  : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
                }`
              }
            >
              <span>Members</span>
              <Badge 
                variant="secondary" 
                className={`transition-colors duration-200 
                ${activeTab === 'members'
                  ? 'bg-black/20 text-white' 
                  : 'bg-slate-700 text-slate-300'
                }`}
              >
                {mockMembers.length}
              </Badge>
            </Button>
            <Button
              onClick={() => setActiveTab('projects')}
              variant="ghost"
              className={`
                filter-chip h-auto p-2 px-4 rounded-full transition-colors duration-200 
                flex items-center justify-center space-x-[3px]
                ${activeTab === 'projects' 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' 
                  : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
                }`
              }
            >
              <span>Projects</span>
              <Badge 
                variant="secondary" 
                className={`transition-colors duration-200 
                ${activeTab === 'projects'
                  ? 'bg-black/20 text-white' 
                  : 'bg-slate-700 text-slate-300'
                }`}
              >
                {projects.length}
              </Badge>
            </Button>
            <Button
              onClick={() => setActiveTab('events')}
              variant="ghost"
              className={`
                filter-chip h-auto p-2 px-4 rounded-full transition-colors duration-200 
                flex items-center justify-center space-x-[3px]
                ${activeTab === 'events' 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' 
                  : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
                }`}
            >
              <span>Events</span>
              <Badge 
                variant="secondary" 
                className={`transition-colors duration-200 
                ${activeTab === 'events'
                  ? 'bg-black/20 text-white' 
                  : 'bg-slate-700 text-slate-300'
                }`}
              >
                {events.length}
              </Badge>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Content Section */}
      <div className="mt-6">
        {!sectionsReady.content ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700 h-full">
                <CardContent className="p-6 text-center">
                  <div className="w-20 h-20 bg-slate-700 animate-pulse rounded-full mx-auto mb-4" />
                  <div className="h-5 bg-slate-700 animate-pulse rounded w-24 mx-auto mb-3" />
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-full mb-2" />
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-3/4 mx-auto mb-3" />
                  <div className="flex flex-wrap justify-center gap-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-6 w-16 bg-slate-700 animate-pulse rounded" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
          >
            {activeTab === 'members' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {mockMembers.map((member, index) => (
                  <MemberCard key={member.id} member={member} index={index} />
                ))}
                {mockMembers.length === 0 && <p className="col-span-full text-center text-slate-400 py-10">No members found in this hub.</p>}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map((project, index) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    index={index} 
                    onCardClick={handleCardClick} 
                    onSupport={handleSupport} 
                    onVote={handleVote}
                    isDisabled={project.status === 'completed' || project.status === 'cancelled'}
                  />
                ))}
                {projects.length === 0 && (
                  <p className="col-span-full text-center text-slate-400 py-10">
                    No local projects found. Why not start one?
                  </p>
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-6">
                {events.map((event, index) => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    index={index}
                    onViewDetails={handleEventViewDetails}
                  />
                ))}
                {events.length === 0 && <p className="text-center text-slate-400 py-10">No upcoming events. Why not organize one?</p>}
              </div>
            )}
          </motion.div>
        )}
      </div>

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

      {/* Event Detail Modal */}
      <EventDetail
        event={selectedEvent}
        isOpen={isEventDetailOpen}
        onClose={() => {
          setIsEventDetailOpen(false);
          setSelectedEvent(null);
        }}
        onEventUpdate={handleEventUpdate}
      />
    </div>
  );
}
