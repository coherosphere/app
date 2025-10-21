
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

export default function EventsTimelineChart({ events, timeRange = 7 }) {
  const { iconConfigs } = useAllIconConfigs();

  // Group events by date and action type
  const chartData = useMemo(() => {
    if (!events || events.length === 0) return [];

    // Get date range
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

    // Count events by date and action type
    const actionTypes = new Set();
    events.forEach(event => {
      const eventDate = startOfDay(parseISO(event.timestamp));
      const dateKey = format(eventDate, 'yyyy-MM-dd');
      
      if (dateBuckets[dateKey]) {
        dateBuckets[dateKey].total++;
        
        // Track count per action type
        const actionKey = event.action_type;
        actionTypes.add(actionKey);
        
        if (!dateBuckets[dateKey][actionKey]) {
          dateBuckets[dateKey][actionKey] = 0;
        }
        dateBuckets[dateKey][actionKey]++;
      }
    });

    return {
      data: Object.values(dateBuckets),
      actionTypes: Array.from(actionTypes)
    };
  }, [events, timeRange]);

  // Color mapping for different action types
  const actionColors = {
    'PROJECT_SUPPORT': '#FF6A00',
    'PROJECT_CREATED': '#FF8C42',
    'GOVERNANCE_VOTE': '#3B82F6',
    'KNOWLEDGE_PUBLISHED': '#10B981',
    'EVENT_HOSTED': '#8B5CF6',
    'LEARNING_CIRCLE_HOSTED': '#F59E0B',
    'MESSAGE_SENT': '#EC4899',
    'MESSAGE_TRUSTED_THREAD': '#F97316',
    'DAILY_CHECKIN_COMPLETED': '#14B8A6',
    'NOSTR_SIGNAL': '#6366F1',
    'NOSTR_POST': '#A855F7',
    'TREASURY_CONTRIBUTION': '#22C55E'
  };

  if (!events || events.length === 0) {
    return (
      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
        <CardContent className="p-8 text-center">
          <ConfiguredIcon
            iconName="LineChart"
            iconConfig={iconConfigs['LineChart']}
            size="w-12 h-12"
            className="mx-auto mb-4"
            fallbackColor="text-slate-500"
          />
          <p className="text-slate-400">No events to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ConfiguredIcon
            iconName="TrendingUp"
            iconConfig={iconConfigs['TrendingUp']}
            size="w-5 h-5"
            fallbackColor="text-orange-400"
          />
          Type Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData.data}>
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
              iconType="line"
            />
            
            {/* Total line */}
            <Line
              type="monotone"
              dataKey="total"
              name="Total Events"
              stroke="#FF6A00"
              strokeWidth={3}
              dot={{ fill: '#FF6A00', r: 4 }}
              activeDot={{ r: 6 }}
            />

            {/* Individual action type lines (top 5 most frequent) */}
            {chartData.actionTypes
              .map(actionType => ({
                type: actionType,
                count: events.filter(e => e.action_type === actionType).length
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map(({ type }) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  name={type}
                  stroke={actionColors[type] || '#64748b'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  opacity={0.7}
                />
              ))
            }
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
