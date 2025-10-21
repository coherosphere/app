import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

export default function CirclePreview({ circleData, creator }) {
  const { iconConfigs } = useAllIconConfigs();
  const hasContent = circleData.topic || circleData.description || circleData.frequency;

  if (!hasContent) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="p-8 text-center">
          <ConfiguredIcon 
            iconName="Users"
            iconConfig={iconConfigs['Users']}
            size="w-12 h-12"
            className="mx-auto mb-4"
            fallbackColor="text-slate-500"
          />
          <p className="text-slate-400">Circle preview will appear here as you fill in the details...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 hover:bg-slate-800/60 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          {/* Header with icon and badges */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <ConfiguredIcon 
                iconName="Users"
                iconConfig={iconConfigs['Users']}
                size="w-6 h-6"
                fallbackColor="text-purple-400"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              {circleData.frequency && (
                <Badge 
                  variant="outline" 
                  className="mb-2 border text-xs bg-purple-500/20 text-purple-400 border-purple-500/30"
                >
                  {circleData.frequency} meetings
                </Badge>
              )}
            </div>
          </div>

          {/* Topic and description */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">
              {circleData.topic || 'Circle Topic'}
            </h3>
            <p className="text-slate-300 leading-relaxed mb-4 line-clamp-3">
              {circleData.description || 'Circle description will appear here...'}
            </p>
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-3">
            {/* Next session */}
            {circleData.next_session && (
              <div className="flex items-center gap-2 text-slate-300">
                <ConfiguredIcon 
                  iconName="Calendar"
                  iconConfig={iconConfigs['Calendar']}
                  size="w-4 h-4"
                  className="flex-shrink-0"
                  fallbackColor="text-orange-400"
                />
                <p className="text-orange-400 font-semibold text-sm">
                  {format(new Date(circleData.next_session), 'EEE, MMM do \'at\' h:mm a')}
                </p>
              </div>
            )}
            
            {/* Location */}
            {(circleData.physical_address || circleData.online_url) && (
              <div className="flex items-center gap-2 text-slate-300">
                {circleData.location_type === 'physical' ? (
                  <ConfiguredIcon 
                    iconName="MapPin"
                    iconConfig={iconConfigs['MapPin']}
                    size="w-4 h-4"
                    className="flex-shrink-0"
                    fallbackColor="text-sky-400"
                  />
                ) : (
                  <ConfiguredIcon 
                    iconName="Globe"
                    iconConfig={iconConfigs['Globe']}
                    size="w-4 h-4"
                    className="flex-shrink-0"
                    fallbackColor="text-sky-400"
                  />
                )}
                <p className="text-sky-400 font-semibold text-sm truncate">
                  {circleData.location_type === 'physical' ? circleData.physical_address : circleData.online_url}
                </p>
              </div>
            )}
          </div>


          {/* Learning goals preview */}
          {circleData.learning_goals && (
            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center gap-2 text-slate-300 mb-2">
                <ConfiguredIcon 
                  iconName="Target"
                  iconConfig={iconConfigs['Target']}
                  size="w-4 h-4"
                  fallbackColor="text-slate-400"
                />
                <span className="text-sm font-medium">Goals:</span>
              </div>
              <p className="text-slate-400 text-sm line-clamp-2">
                {circleData.learning_goals}
              </p>
            </div>
          )}

          {/* Capacity indicator */}
          <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-700 pt-4">
            <div className="flex items-center gap-1">
              <ConfiguredIcon 
                iconName="Users"
                iconConfig={iconConfigs['Users']}
                size="w-3 h-3"
                fallbackColor="currentColor"
              />
              <span>
                {circleData.participants?.length || 0}
                {circleData.max_participants && ` / ${circleData.max_participants}`} participants
              </span>
            </div>
            {circleData.max_participants && (
              <div className="flex items-center gap-1">
                <ConfiguredIcon 
                  iconName="Clock"
                  iconConfig={iconConfigs['Clock']}
                  size="w-3 h-3"
                  fallbackColor="currentColor"
                />
                <span>Limited spots</span>
              </div>
            )}
          </div>

          {/* Creator preview */}
          {creator && (
            <div className="flex items-center gap-3 pt-3 border-t border-slate-700">
              <img
                src={creator.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${creator.email}&backgroundColor=FF6A00,FF8C42&size=32`}
                alt="Creator"
                className="w-6 h-6 rounded-full border border-slate-600"
              />
              <div>
                <span className="text-sm text-slate-300">
                  Facilitated by {creator.display_name || creator.full_name}
                </span>
              </div>
            </div>
          )}

          {/* Engagement placeholder */}
          <div className="flex items-center gap-4 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-1 text-slate-500">
              <ConfiguredIcon 
                iconName="Users"
                iconConfig={iconConfigs['Users']}
                size="w-3 h-3"
                fallbackColor="currentColor"
              />
              <span className="text-xs">New circle</span>
            </div>
            <span className="text-xs text-slate-500">Just created</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}