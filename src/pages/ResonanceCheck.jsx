
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DailyCheckIn, Hub, Project } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { useLoading } from '@/components/loading/LoadingContext';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

const moodLabels = ['Struggling', 'Okay', 'Good', 'Great', 'Vibrant'];
const moodColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export default function ResonanceCheck() {
  const [timeRange, setTimeRange] = useState('week');
  
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    chart: false,
    distribution: false,
    narrative: false
  });

  // Use cached data for check-ins
  const { data: checkIns = [], isLoading: checkInsLoading } = useCachedData(
    ['resonanceCheck', 'checkIns'],
    () => DailyCheckIn.list(),
    'resonanceCheck'
  );

  // Use cached data for hubs
  const { data: hubs = [], isLoading: hubsLoading } = useCachedData(
    ['resonanceCheck', 'hubs'],
    () => Hub.list(),
    'resonanceCheck'
  );

  // Use cached data for projects
  const { data: projects = [], isLoading: projectsLoading } = useCachedData(
    ['resonanceCheck', 'projects'],
    () => Project.list(),
    'resonanceCheck'
  );

  const isLoading = checkInsLoading || hubsLoading || projectsLoading;

  // Sync with global loading context
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Filter check-ins by time range
  const getFilteredCheckIns = () => {
    const now = new Date();
    const cutoff = new Date();
    
    if (timeRange === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (timeRange === 'all') {
      return checkIns;
    }
    
    return checkIns.filter(c => new Date(c.timestamp) >= cutoff);
  };

  const filteredCheckIns = getFilteredCheckIns();

  // Calculate mood distribution
  const getMoodDistribution = () => {
    const distribution = [0, 0, 0, 0, 0];
    filteredCheckIns.forEach(checkIn => {
      if (checkIn.mood_selection >= 0 && checkIn.mood_selection <= 4) {
        distribution[checkIn.mood_selection]++;
      }
    });
    
    return distribution.map((count, index) => ({
      name: moodLabels[index],
      value: count,
      color: moodColors[index]
    }));
  };

  // Calculate daily average resonance
  const getDailyResonance = () => {
    const dailyData = {};
    
    filteredCheckIns.forEach(checkIn => {
      const date = new Date(checkIn.timestamp).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, count: 0 };
      }
      dailyData[date].total += checkIn.mood_selection;
      dailyData[date].count++;
    });
    
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        resonance: (data.total / data.count).toFixed(2),
        count: data.count
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Calculate overall resonance index (0-4 scale)
  const getResonanceIndex = () => {
    if (filteredCheckIns.length === 0) return 0;
    const total = filteredCheckIns.reduce((sum, checkIn) => sum + checkIn.mood_selection, 0);
    return (total / filteredCheckIns.length).toFixed(2);
  };

  // Get hub with highest resonance
  const getTopHub = () => {
    const hubResonance = {};
    
    checkIns.forEach(checkIn => {
      // NOTE: Original code assigns a random hub to each check-in. This might not be intentional
      // and could lead to inconsistent "Happiest Hub" reporting if check-ins don't explicitly
      // link to hubs. For now, preserving original logic.
      const randomHub = hubs.length > 0 ? hubs[Math.floor(Math.random() * hubs.length)] : null;
      if (randomHub) {
        if (!hubResonance[randomHub.id]) {
          hubResonance[randomHub.id] = { name: randomHub.name, total: 0, count: 0 };
        }
        hubResonance[randomHub.id].total += checkIn.mood_selection;
        hubResonance[randomHub.id].count++;
      }
    });
    
    const hubsWithAvg = Object.values(hubResonance).map(h => ({
      ...h,
      avg: h.count > 0 ? h.total / h.count : 0
    }));
    
    return hubsWithAvg.sort((a, b) => b.avg - a.avg)[0];
  };

  // Dynamic title based on time range
  const getResonanceTitle = () => {
    if (timeRange === 'week') return 'This Week in Resonance';
    if (timeRange === 'month') return 'This Month in Resonance';
    return 'Resonance Overview';
  };

  const moodDistribution = getMoodDistribution();
  const dailyResonance = getDailyResonance();
  const resonanceIndex = getResonanceIndex();
  const topHub = getTopHub();

  // To make the `resource` variable in the outline functional, we define it here.
  // Assuming it's null by default if not passed as a prop or derived from context.
  // This will make the <p> tag use its fallback string.
  const resource = null; 

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats ready when checkIns and hubs loaded
    if (!checkInsLoading && !hubsLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [checkInsLoading, hubsLoading]);

  useEffect(() => {
    // Chart ready when checkIns loaded
    if (!checkInsLoading) {
      setSectionsReady(prev => ({ ...prev, chart: true }));
    }
  }, [checkInsLoading]);

  useEffect(() => {
    // Distribution ready when checkIns loaded
    if (!checkInsLoading) {
      setSectionsReady(prev => ({ ...prev, distribution: true }));
    }
  }, [checkInsLoading]);

  useEffect(() => {
    // Narrative ready when all data loaded
    if (!checkInsLoading && !hubsLoading && !projectsLoading) {
      setSectionsReady(prev => ({ ...prev, narrative: true }));
    }
  }, [checkInsLoading, hubsLoading, projectsLoading]);

  // Custom Tooltip for Chart
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-1">{label}</p>
          <p className="text-orange-400 text-sm">
            Mood: {payload[0].value}
          </p>
          {payload[0].payload.count !== undefined && (
            <p className="text-slate-300 text-xs mt-1">
              {payload[0].payload.count} Check-In{payload[0].payload.count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="Activity" 
            iconConfig={iconConfigs['Activity']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              Resonance Check
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {resource ? `Check ${resource.title}'s resonance` : 'Check resource alignment with coherosphere values'}
        </p>
      </div>

      {/* Key Metrics */}
      {!sectionsReady.stats ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
              <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-slate-700/30 animate-pulse rounded mx-auto mb-0.5" />
                <div className="h-3 w-32 bg-slate-700/30 animate-pulse rounded mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {[
            { iconName: 'Sparkles', value: resonanceIndex, label: 'Average Resonance', delay: 0 },
            { iconName: 'Heart', value: filteredCheckIns.length, label: 'Total Check-Ins', delay: 0.05 },
            { iconName: 'MapPin', value: topHub?.name || 'N/A', label: 'Happiest Hub', delay: 0.1 }
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

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setTimeRange('week')}
          className={`filter-chip h-auto ${timeRange === 'week' ? 'active' : ''}`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setTimeRange('month')}
          className={`filter-chip h-auto ${timeRange === 'month' ? 'active' : ''}`}
        >
          Last 30 Days
        </button>
        <button
          onClick={() => setTimeRange('all')}
          className={`filter-chip h-auto ${timeRange === 'all' ? 'active' : ''}`}
        >
          All Time
        </button>
      </div>

      {/* Resonance Over Time Graph */}
      {!sectionsReady.chart ? (
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 mb-8">
          <CardHeader>
            <div className="h-6 bg-slate-700 animate-pulse rounded w-64" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-slate-700/30 animate-pulse rounded" />
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
          className="mb-8"
        >
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ConfiguredIcon 
                  iconName="TrendingUp" 
                  iconConfig={iconConfigs['TrendingUp']}
                  size="w-5 h-5"
                />
                Mood Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyResonance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyResonance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis domain={[0, 4]} stroke="#94a3b8" />
                    <Tooltip content={CustomChartTooltip} />
                    <Line 
                      type="monotone" 
                      dataKey="resonance" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      dot={{ fill: '#f97316', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  No data available for selected time range
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Mood Distribution and Insights */}
      {!sectionsReady.distribution ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
              <CardHeader>
                <div className="h-6 bg-slate-700 animate-pulse rounded w-40" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-slate-700/30 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: 0.05 }}
            className="h-full"
          >
            <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-white">Mood Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center">
                {moodDistribution.filter(d => d.value > 0).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={moodDistribution.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        {moodDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #475569', 
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                        itemStyle={{ color: '#ffffff' }}
                        labelStyle={{ color: '#ffffff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    No mood data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Insights & Reflections */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: 0.1 }}
            className="h-full"
          >
            <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ConfiguredIcon 
                    iconName="Calendar" 
                    iconConfig={iconConfigs['Calendar']}
                    size="w-5 h-5"
                  />
                  {getResonanceTitle()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {filteredCheckIns.length > 0 ? (
                      <>
                        The community has completed <span className="text-orange-400 font-semibold">{filteredCheckIns.length} mood check-ins</span> with 
                        an average resonance mood of <span className="text-orange-400 font-semibold">{resonanceIndex}</span>. 
                        {resonanceIndex >= 3 ? ' The collective atmosphere feels vibrant and connected.' : resonanceIndex >= 2 ? ' We\'re maintaining good coherence.' : ' Let\'s nurture our connection.'}
                      </>
                    ) : (
                      'No check-ins recorded yet. Start your daily practice to see insights here.'
                    )}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-orange-500/10 to-orange-600/10 rounded-lg border border-orange-500/30">
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <ConfiguredIcon 
                      iconName="Sparkles" 
                      iconConfig={iconConfigs['Sparkles']}
                      size="w-4 h-4"
                    />
                    Mindful Practice
                  </h4>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    "What brought you a sense of connection or calm this week? Take a moment to reflect on what helped you stay in resonance."
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-white font-semibold mb-2">Community Pulse</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Active Projects</span>
                      <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                        {projects.filter(p => ['voting', 'funding', 'launch'].includes(p.status)).length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Resonance Hubs</span>
                      <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                        {hubs.length}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Narrative Layer */}
      {!sectionsReady.narrative ? (
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="h-8 bg-slate-700 animate-pulse rounded w-80" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-slate-700 animate-pulse rounded w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">From Fragmentation to Feeling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 leading-relaxed">
                Our collective resonance is not just data — it's a living reflection of how we feel connected as a community. 
                Each check-in is a moment of awareness, showing how individual moods weave into our shared atmosphere.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Together, we learn to move from disconnection to resonance — from tension to flow.
              </p>
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-orange-400 font-semibold mb-3">Milestones in Our Journey</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                    <div>
                      <div className="text-white font-medium">Manifesto Inscribed on Bitcoin</div>
                      <div className="text-slate-400 text-sm">Block 914508 – Our values, immutable and eternal</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                    <div>
                      <div className="text-white font-medium">First Daily Check-In</div>
                      <div className="text-slate-400 text-sm">The beginning of our collective resonance practice</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                    <div>
                      <div className="text-white font-medium">Global Hubs Network Launched</div>
                      <div className="text-slate-400 text-sm">Local roots, global connection</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
