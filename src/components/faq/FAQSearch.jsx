import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function FAQSearch({ searchTerm, onSearchChange, tags, activeTag, onTagChange, iconConfigs }) {
  return (
    <div className="mb-8 space-y-4">
      <div className="relative">
        <ConfiguredIcon 
          iconName="Search"
          iconConfig={iconConfigs?.['Search']}
          size="w-5 h-5"
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          fallbackColor="text-slate-400"
        />
        <Input
          type="text"
          placeholder="Search questions..."
          defaultValue={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 bg-slate-800 border-slate-700 rounded-lg pl-12 pr-4 text-slate-300 placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500"
        />
      </div>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Button
              key={tag}
              onClick={() => onTagChange(tag)}
              variant="ghost"
              className={`filter-chip h-auto ${activeTag === tag ? 'active' : ''}`}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}