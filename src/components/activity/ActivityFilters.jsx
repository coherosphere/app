
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export default function ActivityFilters({
  selectedFilter,
  onFilterChange, // This prop will now expect an object: { type: string, source: string }
  activityCounts,
  iconConfigs,
  selectedSource, // New prop for the selected source filter
}) {
  const filters = [
    { key: 'all', label: 'All', icon: null },
    { key: 'post', label: 'Posts', icon: 'MessageCircle' },
    { key: 'mention', label: 'Mentions', icon: 'AtSign' },
    { key: 'reply', label: 'Replies', icon: 'Reply' },
    { key: 'reaction', label: 'Reactions', icon: 'Heart' },
    { key: 'zap-in', label: 'Zaps In', icon: 'Zap' },
    { key: 'zap-out', label: 'Zaps Out', icon: 'Zap' },
  ];

  // Unified handler for all filter changes
  const handleFilterChange = (filterType, value) => {
    let newFilterState = {
      type: selectedFilter,
      source: selectedSource,
    };

    if (filterType === 'type') {
      newFilterState.type = value;
    } else if (filterType === 'source') {
      newFilterState.source = value;
    }

    onFilterChange(newFilterState);
  };

  return (
    <div className="flex flex-wrap gap-3 mb-6"> {/* Changed gap-2 to gap-3 */}
      {/* Type filters (Posts, Mentions, etc.) */}
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant="ghost"
          size="sm"
          onClick={() => handleFilterChange("type", filter.key)} // Updated to use handleFilterChange
          className={`filter-chip h-auto ${selectedFilter === filter.key ? 'active' : ''}`}
        >
          {filter.icon && (
            <ConfiguredIcon
              iconName={filter.icon}
              iconConfig={iconConfigs[filter.icon]}
              size="w-4 h-4"
              fallbackColor="text-current"
              className="mr-2"
            />
          )}
          {filter.label}
          <Badge
            variant="secondary"
            className={`ml-[3px] transition-colors duration-200 ${
              selectedFilter === filter.key
              ? 'bg-black/20 text-white'
              : 'bg-slate-700 text-slate-300'
            }`}
          >
            {activityCounts[filter.key] || 0}
          </Badge>
        </Button>
      ))}

      {/* Source Filter */}
      <Select value={selectedSource} onValueChange={(value) => handleFilterChange("source", value)}>
        <SelectTrigger className="input-base w-auto min-w-[140px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="cron">🤖 Cron Job</SelectItem>
          <SelectItem value="status_page">📊 Status Page</SelectItem>
          <SelectItem value="system_health_page">⚙️ System Health</SelectItem>
          <SelectItem value="activity_page">🌍 Activity Page</SelectItem>
          <SelectItem value="treasury_page">💰 Treasury Page</SelectItem>
          <SelectItem value="donate_page">❤️ Donate Page</SelectItem>
          <SelectItem value="engage_page">🤝 Engage Page</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
