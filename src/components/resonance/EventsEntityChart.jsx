
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

export default function EventsEntityChart({ events, timeRange = 7 }) {
  const { iconConfigs } = useAllIconConfigs();

  // Group events by date and entity type
  const chartData = useMemo(() => {
    if (!events || events.length === 0) return { data: [], entityTypes: [] };

    const now = new Date();
    const startDate = startOfDay(subDays(now, timeRange - 1));

    // Initialize date buckets
    const dateBuckets = {};
    for (let i = 0; i < timeRange; i++) {
      const date = startOfDay(subDays(now, timeRange - 1 - i));
      const dateKey = format(date, 'yyyy-MM-dd');
      dateBuckets[dateKey] = {
        date: dateKey,
        displayDate: format(date, 'MMM dd'),
        total: 0
      };
    }

    // Count events by date and entity type
    const entityTypes = new Set();
    events.forEach(event => {
      const eventDate = startOfDay(parseISO(event.timestamp));
      const dateKey = format(eventDate, 'yyyy-MM-dd');
      
      if (dateBuckets[dateKey]) {
        dateBuckets[dateKey].total++;
        
        const entityKey = event.entity_type;
        entityTypes.add(entityKey);
        
        if (!dateBuckets[dateKey][entityKey]) {
          dateBuckets[dateKey][entityKey] = 0;
        }
        dateBuckets[dateKey][entityKey]++;
      }
    });

    return {
      data: Object.values(dateBuckets),
      entityTypes: Array.from(entityTypes)
    };
  }, [events, timeRange]);

  // Color mapping for entity types
  const entityColors = {
    'user': '#3B82F6',          // Blue
    'project': '#FF6A00',       // Orange
    'hub': '#10B981',           // Green
    'proposal': '#8B5CF6',      // Purple
    'knowledge': '#F59E0B',     // Amber
    'event': '#EC4899',         // Pink
    'circle': '#14B8A6',        // Teal
    'message_thread': '#6366F1', // Indigo
    'treasury_tx': '#22C522',   // Light Green (changed from 22C5E to better fit green palette)
    'daily_checkin': '#F97316'  // Orange-Red
  };

  // Entity type display names
  const entityDisplayNames = {
    'user': 'User',
    'project': 'Project',
    'hub': 'Hub',
    'proposal': 'Proposal',
    'knowledge': 'Knowledge',
    'event': 'Event',
    'circle': 'Learning Circle',
    'message_thread': 'Message Thread',
    'treasury_tx': 'Treasury',
    'daily_checkin': 'Daily Check-In'
  };

  // Calculate totals per entity type for the summary cards - This useMemo is now unused but kept in case it's needed elsewhere or for future features.
  const entityTotals = useMemo(() => {
    const totals = {};
    events.forEach(event => {
      const entityType = event.entity_type;
      if (!totals[entityType]) {
        totals[entityType] = 0;
      }
      totals[entityType]++;
    });
    
    return Object.entries(totals)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
        <CardContent className="p-8 text-center">
          <ConfiguredIcon
            iconName="BarChart3"
            iconConfig={iconConfigs['BarChart3']}
            size="w-12 h-12"
            className="mx-auto mb-4"
            fallbackColor="text-slate-500"
          />
          <p className="text-slate-400">No entity data to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ConfiguredIcon
            iconName="BarChart3"
            iconConfig={iconConfigs['BarChart3']}
            size="w-5 h-5"
            fallbackColor="text-orange-400"
          />
          Entity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="displayDate" 
              stroke="#94a3b8"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#94a3b8"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#fff'
              }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
            
            {/* Stacked bars for each entity type */}
            {chartData.entityTypes.map(entityType => (
              <Bar
                key={entityType}
                dataKey={entityType}
                name={entityDisplayNames[entityType] || entityType}
                stackId="entities"
                fill={entityColors[entityType] || '#64748b'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
