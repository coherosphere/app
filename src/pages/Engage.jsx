
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

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
  const [totalDonations, setTotalDonations] = useState(0);

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

  // Load donation data separately (uses checkApiStatus function)
  const { data: apiData, isLoading: apiLoading } = useCachedData(
    ['engage', 'donations'],
    () => base44.functions.invoke('checkApiStatus', { source: 'engage_page' }),
    'engage'
  );

  const isLoading = messagesLoading || resourcesLoading || eventsLoading || projectsLoading || circlesLoading || apiLoading;

  // Sync loading state with global loading context
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Calculate total donations when API data changes
  useEffect(() => {
    if (!apiData?.data) return;

    const BITCOIN_ADDRESS = "bc1q7davwh4083qrw8dsnazavamul4ngam99zt7nfy";
    let totalReceived = 0;

    const bitcoinTxs = apiData.data.bitcoinTransactions || [];
    bitcoinTxs.forEach(tx => {
      let received = 0;
      let sent = 0;

      tx.vout?.forEach((output) => {
        if (output.scriptpubkey_address === BITCOIN_ADDRESS) {
          received += output.value;
        }
      });

      tx.vin?.forEach((input) => {
        if (input.prevout?.scriptpubkey_address === BITCOIN_ADDRESS) {
          sent += input.prevout.value;
        }
      });

      const netAmount = received - sent;
      if (netAmount > 0) {
        totalReceived += netAmount;
      }
    });

    const lightningTxs = apiData.data.lightningTransactions || [];
    lightningTxs.forEach(tx => {
      if (tx.type === 'incoming') {
        totalReceived += tx.amount;
      }
    });

    setTotalDonations(totalReceived);
  }, [apiData]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats ready when all data loaded
    if (!messagesLoading && !resourcesLoading && !eventsLoading && !projectsLoading && !circlesLoading && !apiLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [messagesLoading, resourcesLoading, eventsLoading, projectsLoading, circlesLoading, apiLoading]);

  useEffect(() => {
    // Options always ready (static content, no data dependency)
    setSectionsReady(prev => ({ ...prev, options: true }));
  }, []);

  // Compute stats from loaded data
  const stats = {
    messages: messages.length,
    knowledge: resources.length,
    events: events.length,
    projects: projects.length,
    circles: circles.length,
    totalDonations: totalDonations,
  };

  const statsConfig = [
    { iconName: 'MessageSquare', value: stats.messages, label: 'Messages' },
    { iconName: 'BookOpen', value: stats.knowledge, label: 'Knowledge' },
    { iconName: 'Calendar', value: stats.events, label: 'Events' },
    { iconName: 'Users', value: stats.circles, label: 'Circles' },
    { iconName: 'Lightbulb', value: stats.projects, label: 'Projects' },
    { iconName: 'TrendingUp', value: stats.totalDonations.toLocaleString(), label: 'Received (sats)' },
  ];

  return (
    <div className="p-4 lg:p-8 text-white">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
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
      </motion.div>

      {/* Stats Grid - Progressive Loading */}
      {!sectionsReady.stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded-lg mx-auto mb-1.5" />
                <div className="h-6 bg-slate-700/30 animate-pulse rounded w-12 mx-auto mb-0.5" />
                <div className="h-3 bg-slate-700/30 animate-pulse rounded w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {statsConfig.map((stat, index) => (
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
                  <motion.div
                    key={stat.value}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-lg font-bold text-white mb-0.5"
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-slate-400 text-xs leading-tight">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
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
