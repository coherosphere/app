
import React, { useState, useEffect } from 'react';
import { User, Hub, Project, Resource, Event, LearningCircle } from '@/api/entities';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import ProfileHeader from '@/components/profile/ProfileHeader';
import HubSelector from '@/components/profile/HubSelector';
import SupportedProjects from '@/components/profile/SupportedProjects';
import ValuesEditor from '@/components/profile/ValuesEditor';
import SkillsEditor from '@/components/profile/SkillsEditor';
import StatCard from '@/components/StatCard';
import RecentConversations from '@/components/profile/RecentConversations';
import { useCachedData } from '@/components/caching/useCachedData';
import ScreensaverToggle from '@/components/profile/ScreensaverToggle';
import { useUser } from '@/components/auth/UserContext';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useLoading } from '@/components/loading/LoadingContext';
import JoinedCircles from '@/components/profile/JoinedCircles'; // New import

export default function Profile() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [canPostToNostr, setCanPostToNostr] = useState(true);
  const [daysUntilNextPost, setDaysUntilNextPost] = useState(0);
  const [resonanceScore, setResonanceScore] = useState(0);
  const [isLoadingResonance, setIsLoadingResonance] = useState(true);
  const [stats, setStats] = useState({
    sharedKnowledge: 0,
    hostedEvents: 0,
    startedCircles: 0,
    supportedProjects: 0,
    startedProjects: 0,
  });

  // Form state
  const [selectedHubId, setSelectedHubId] = useState('');
  const [values, setValues] = useState([]);
  const [skills, setSkills] = useState([]);
  const [screensaverEnabled, setScreensaverEnabled] = useState(true);

  const { refreshUser } = useUser();
  const { iconConfigs } = useAllIconConfigs();
  const { setLoading } = useLoading();

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    statsBar: false,
    profileHeader: false,
    hubSelector: false,
    supportedProjects: false,
    recentConversations: false,
    valuesEditor: false,
    skillsEditor: false,
    screensaverToggle: false,
    actionButtons: false,
    joinedCircles: false, // New state for JoinedCircles
  });

  // Use cached data
  const { data: user, isLoading: userLoading, refetch: refetchUser } = useCachedData(
    ['profile', 'user'],
    () => User.me(),
    'profile'
  );

  const { data: hubs = [], isLoading: hubsLoading } = useCachedData(
    ['profile', 'hubs'],
    () => Hub.list(),
    'profile'
  );

  const { data: allProjects = [], isLoading: projectsLoading } = useCachedData(
    ['profile', 'projects'],
    () => Project.list(),
    'profile'
  );

  const { data: resources = [], isLoading: resourcesLoading } = useCachedData(
    ['profile', 'resources'],
    () => Resource.list().catch(() => []),
    'profile'
  );

  const { data: events = [], isLoading: eventsLoading } = useCachedData(
    ['profile', 'events'],
    () => Event.list().catch(() => []),
    'profile'
  );

  const { data: circles = [], isLoading: circlesLoading } = useCachedData(
    ['profile', 'circles'],
    () => LearningCircle.list().catch(() => []),
    'profile'
  );

  const isLoading = userLoading || hubsLoading || projectsLoading || resourcesLoading || eventsLoading || circlesLoading;

  // Sync with global loading context
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Initialize form state when user data loads
  useEffect(() => {
    if (user) {
      setSelectedHubId(user.hub_id || '');
      setValues(user.values || ['Resilience', 'Innovation', 'Community']);
      setSkills(user.skills || ['Web Development', 'Community Building']);
      setScreensaverEnabled(user.screensaver_enabled !== false);
      
      console.log('[Profile] User screensaver_enabled:', user.screensaver_enabled);
    }
  }, [user]);

  // Check Nostr posting cooldown
  useEffect(() => {
    if (user?.last_nostr_post_date) {
      const lastPostDate = new Date(user.last_nostr_post_date);
      const now = new Date();
      const timeDiff = now.getTime() - lastPostDate.getTime();
      const daysSinceLastPost = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const daysRemaining = 20 - daysSinceLastPost;

      if (daysRemaining > 0) {
        setCanPostToNostr(false);
        setDaysUntilNextPost(daysRemaining);
      } else {
        setCanPostToNostr(true);
        setDaysUntilNextPost(0);
      }
    } else {
      setCanPostToNostr(true);
      setDaysUntilNextPost(0);
    }
  }, [user]);

  // Load resonance score
  useEffect(() => {
    const loadResonance = async () => {
      if (!user) return;
      
      setIsLoadingResonance(true);
      try {
        const scoreResponse = await base44.functions.invoke('getResonanceScore', {
          entity_type: 'user',
          entity_id: user.id
        });

        if (scoreResponse.data && scoreResponse.data.exists) {
          setResonanceScore(Math.round(scoreResponse.data.score_total));
        } else {
          setResonanceScore(0);
        }
      } catch (error) {
        console.error('Error loading resonance score:', error);
        setResonanceScore(0);
      } finally {
        setIsLoadingResonance(false);
      }
    };

    loadResonance();
  }, [user]);

  // Calculate stats
  useEffect(() => {
    if (!user) return;

    const supportedProjects = allProjects.filter(project =>
      project.supporters && Array.isArray(project.supporters) && project.supporters.includes(user.id)
    );

    const userCreatedResources = resources.filter(r => r.creator_id === user.id || r.created_by === user.email);
    const userHostedEvents = events.filter(e => e.organizer_id === user.id);
    const userStartedCircles = circles.filter(c => c.participants && c.participants.length > 0 && c.participants[0] === user.id);
    const userStartedProjects = allProjects.filter(p => p.creator_id === user.id);

    setStats({
      sharedKnowledge: userCreatedResources.length,
      hostedEvents: userHostedEvents.length,
      startedCircles: userStartedCircles.length,
      supportedProjects: supportedProjects.length,
      startedProjects: userStartedProjects.length,
    });
  }, [user, allProjects, resources, events, circles]);

  const supportedProjects = React.useMemo(() => {
    if (!user) return [];
    return allProjects.filter(project =>
      project.supporters && Array.isArray(project.supporters) && project.supporters.includes(user.id)
    );
  }, [user, allProjects]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats bar ready when all data loaded and resonance loaded
    if (!userLoading && !projectsLoading && !resourcesLoading && !eventsLoading && !circlesLoading && !isLoadingResonance) {
      setSectionsReady(prev => ({ ...prev, statsBar: true }));
    }
  }, [userLoading, projectsLoading, resourcesLoading, eventsLoading, circlesLoading, isLoadingResonance]);

  useEffect(() => {
    // Profile header ready when user loaded
    if (!userLoading) {
      setSectionsReady(prev => ({ ...prev, profileHeader: true }));
    }
  }, [userLoading]);

  useEffect(() => {
    // Hub selector ready when user and hubs loaded
    if (!userLoading && !hubsLoading) {
      setSectionsReady(prev => ({ ...prev, hubSelector: true }));
    }
  }, [userLoading, hubsLoading]);

  useEffect(() => {
    // Supported projects ready when user and projects loaded
    if (!userLoading && !projectsLoading) {
      setSectionsReady(prev => ({ ...prev, supportedProjects: true }));
    }
  }, [userLoading, projectsLoading]);

  useEffect(() => {
    // Joined circles ready when user and circles loaded
    if (!userLoading && !circlesLoading) {
      setSectionsReady(prev => ({ ...prev, joinedCircles: true }));
    }
  }, [userLoading, circlesLoading]);

  useEffect(() => {
    // Recent conversations ready when user loaded
    if (!userLoading) {
      setSectionsReady(prev => ({ ...prev, recentConversations: true }));
    }
  }, [userLoading]);

  useEffect(() => {
    // Values editor ready when user loaded
    if (!userLoading) {
      setSectionsReady(prev => ({ ...prev, valuesEditor: true }));
    }
  }, [userLoading]);

  useEffect(() => {
    // Skills editor ready when user loaded
    if (!userLoading) {
      setSectionsReady(prev => ({ ...prev, skillsEditor: true }));
    }
  }, [userLoading]);

  useEffect(() => {
    // Screensaver toggle ready when user loaded
    if (!userLoading) {
      setSectionsReady(prev => ({ ...prev, screensaverToggle: true }));
    }
  }, [userLoading]);

  useEffect(() => {
    // Action buttons always ready
    setSectionsReady(prev => ({ ...prev, actionButtons: true }));
  }, []);

  const handleSaveChanges = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      console.log('[Profile] Saving screensaver_enabled:', screensaverEnabled);
      
      await User.updateMyUserData({
        hub_id: selectedHubId,
        values: values,
        skills: skills,
        screensaver_enabled: screensaverEnabled,
        resonance_score: (user.resonance_score || 0) + 1
      });

      setSaveMessage('Profile updated successfully!');
      await refetchUser();
      await refreshUser();
      
      console.log('[Profile] User data saved and UserContext refreshed');

      setTimeout(() => setSaveMessage(null), 3000);

    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveMessage('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameChange = async (newName) => {
    if (!user) return;

    try {
      await User.updateMyUserData({
        full_name: newName
      });

      setSaveMessage('Name updated successfully!');
      await refetchUser();
      await refreshUser();
      
      setTimeout(() => setSaveMessage(null), 3000);

    } catch (err) {
      console.error('Error updating name:', err);
      setSaveMessage('Failed to update name. Please try again.');
    }
  };

  const handlePublishToNostr = async () => {
    if (!user || !canPostToNostr) return;

    setSaveMessage('Publishing to Nostr...');

    try {
      const content = "I'm on coherosphere — where humans, technology, and values resonate together. join https://coherosphere.com";

      const response = await base44.functions.invoke('publishNostrNote', {
        content
      });

      if (response.data.publishStatus === 'published') {
        await User.updateMyUserData({
          last_nostr_post_date: new Date().toISOString()
        });

        try {
          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'user',
            entity_id: user.id,
            action_type: 'NOSTR_SIGNAL',
            magnitude: 1.0,
            alignment_score: 1.0,
            metadata: {
              content: content,
              relays_published: response.data.successCount,
              total_relays: response.data.totalRelays,
              publish_status: response.data.publishStatus
            }
          });

          console.log('✓ Nostr signal resonance recorded (+1 point)');
        } catch (error) {
          console.error('Failed to record resonance event:', error);
        }

        await refetchUser();

        setSaveMessage(`✓ Published to Nostr! (${response.data.successCount}/${response.data.totalRelays} relays) +1 Resonance`);
      } else if (response.data.publishStatus === 'partial') {
        setSaveMessage(`⚠ Partially published to ${response.data.successCount}/${response.data.totalRelays} relays`);
      } else {
        setSaveMessage('✗ Failed to publish to Nostr. Please try again.');
      }

      setTimeout(() => setSaveMessage(null), 5000);

    } catch (err) {
      console.error('Error publishing to Nostr:', err);
      setSaveMessage('Failed to publish to Nostr. Please try again.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleProjectsUpdate = async () => {
    // React Query will handle refetch automatically
  };

  // Skeleton Components
  const StatCardSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        <div className="flex items-center justify-center mb-1.5">
          <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
        </div>
        <div className="h-6 w-12 mx-auto bg-slate-700/30 animate-pulse rounded mb-0.5" />
        <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" />
      </CardContent>
    </Card>
  );

  const SectionSkeleton = ({ title }) => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6">
        <div className="h-6 w-48 bg-slate-700 animate-pulse rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-700 animate-pulse rounded" />
          <div className="h-4 w-5/6 bg-slate-700 animate-pulse rounded" />
          <div className="h-4 w-4/6 bg-slate-700 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="UserCircle" 
            iconConfig={iconConfigs['UserCircle']}
            size="w-12 h-12"
            className="flex-shrink-0 text-orange-400"
            fallbackColor="text-orange-400"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              My Profile
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Manage your identity, values, and contributions.
        </p>
      </div>

      {/* Stats Bar - Progressive Loading */}
      {sectionsReady.statsBar ? (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 }}
        >
          <Link to={createPageUrl('UserResonance')} className="block">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-orange-500/50 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 h-[98px] overflow-hidden cursor-pointer group">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <ConfiguredIcon 
                    iconName="Activity"
                    iconConfig={iconConfigs['Activity']}
                    size="w-5 h-5"
                    fallbackColor="text-orange-400"
                    className="group-hover:scale-110 transition-transform"
                  />
                </div>
                <div className="text-lg font-bold text-orange-400">
                  {resonanceScore}
                </div>
                <div className="text-slate-300 text-xs leading-tight flex items-center justify-center gap-1">
                  User Resonance
                  <ConfiguredIcon 
                    iconName="TrendingUp"
                    iconConfig={iconConfigs['TrendingUp']}
                    size="w-3 h-3"
                    fallbackColor="text-slate-300"
                  />
                </div>
              </CardContent>
            </Card>
          </Link>

          <StatCard
            iconName="BookOpen"
            iconConfig={iconConfigs['BookOpen']}
            value={stats.sharedKnowledge}
            label="Shared Knowledge"
            isLoading={false}
          />
          <StatCard
            iconName="Calendar"
            iconConfig={iconConfigs['Calendar']}
            value={stats.hostedEvents}
            label="Hosted Events"
            isLoading={false}
          />
          <StatCard
            iconName="Users"
            iconConfig={iconConfigs['Users']}
            value={stats.startedCircles}
            label="Started Circles"
            isLoading={false}
          />
          <StatCard
            iconName="Heart"
            iconConfig={iconConfigs['Heart']}
            value={stats.supportedProjects}
            label="Supported Projects"
            isLoading={false}
          />
          <StatCard
            iconName="Lightbulb"
            iconConfig={iconConfigs['Lightbulb']}
            value={stats.startedProjects}
            label="Started Projects"
            isLoading={false}
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Alert className="border-green-500/50 bg-green-500/10">
            <AlertDescription className="text-green-400">
              {saveMessage}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Two-Column Layout for Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Profile Header */}
          {sectionsReady.profileHeader ? (
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <ProfileHeader user={user} onNameChange={handleNameChange} />
            </motion.div>
          ) : (
            <SectionSkeleton title="Profile Header" />
          )}

          {/* Hub Selector */}
          {sectionsReady.hubSelector ? (
            <motion.div
              className="relative z-40"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <HubSelector
                hubs={hubs}
                selectedHubId={selectedHubId}
                onHubChange={setSelectedHubId}
              />
            </motion.div>
          ) : (
            <SectionSkeleton title="Hub Selector" />
          )}

          {/* Supported Projects */}
          {sectionsReady.supportedProjects ? (
            <motion.div
              className="relative z-30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              <SupportedProjects
                projects={supportedProjects}
                user={user}
                onProjectsUpdate={handleProjectsUpdate}
              />
            </motion.div>
          ) : (
            <SectionSkeleton title="Supported Projects" />
          )}

          {/* Joined Circles */}
          {sectionsReady.joinedCircles ? (
            <motion.div
              className="relative z-25"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              <JoinedCircles circles={circles} user={user} />
            </motion.div>
          ) : (
            <SectionSkeleton title="Learning Circles" />
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Recent Conversations */}
          {sectionsReady.recentConversations ? (
            <motion.div
              className="relative z-25" // Increased z-index to avoid potential overlap with JoinedCircles dropdowns
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.25 }} // Adjusted delay
            >
              <RecentConversations user={user} />
            </motion.div>
          ) : (
            <SectionSkeleton title="Recent Conversations" />
          )}

          {/* Values Editor */}
          {sectionsReady.valuesEditor ? (
            <motion.div
              className="relative z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.3 }} // Adjusted delay
            >
              <ValuesEditor
                values={values}
                onValuesChange={setValues}
              />
            </motion.div>
          ) : (
            <SectionSkeleton title="Values Editor" />
          )}

          {/* Skills Editor */}
          {sectionsReady.skillsEditor ? (
            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.35 }} // Adjusted delay
            >
              <SkillsEditor
                skills={skills}
                onSkillsChange={setSkills}
              />
            </motion.div>
          ) : (
            <SectionSkeleton title="Skills Editor" />
          )}

          {/* Screensaver Toggle */}
          {sectionsReady.screensaverToggle ? (
            <motion.div
              className="relative z-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.4 }} // Adjusted delay
            >
              <ScreensaverToggle
                enabled={screensaverEnabled}
                onToggle={() => setScreensaverEnabled(!screensaverEnabled)}
              />
            </motion.div>
          ) : (
            <SectionSkeleton title="Screensaver Settings" />
          )}
        </div>
      </div>

      {/* Action Buttons - Progressive Loading */}
      {sectionsReady.actionButtons ? (
        <motion.div
          className="flex flex-col sm:flex-row gap-4 pt-8 mt-8 border-t border-slate-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.45 }} // Adjusted delay
        >
          <Button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3"
          >
            <ConfiguredIcon 
              iconName="Save"
              iconConfig={iconConfigs['Save']}
              size="w-4 h-4"
              className="mr-2"
            />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            onClick={handlePublishToNostr}
            disabled={!canPostToNostr}
            variant="outline"
            className="btn-secondary-coherosphere flex-1 py-3"
            title={!canPostToNostr ? `Available again in ${daysUntilNextPost} days` : ''}
          >
            <ConfiguredIcon 
              iconName="Activity"
              iconConfig={iconConfigs['Activity']}
              size="w-4 h-4"
              className="mr-2"
            />
            {!canPostToNostr ? `Resonate again in ${daysUntilNextPost}d` : 'Resonate on Nostr'}
          </Button>
        </motion.div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 pt-8 mt-8 border-t border-slate-700">
          <div className="flex-1 h-12 bg-slate-700 animate-pulse rounded" />
          <div className="flex-1 h-12 bg-slate-700 animate-pulse rounded" />
        </div>
      )}
    </div>
  );
}
