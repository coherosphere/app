import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { format } from 'date-fns';

export default function JoinedCircles({ circles, user }) {
  const { iconConfigs } = useAllIconConfigs();

  // Filter circles where user is a participant
  const userCircles = circles.filter(circle => 
    circle.participants && circle.participants.includes(user.id)
  );

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-3">
            <ConfiguredIcon
              iconName="Users"
              iconConfig={iconConfigs['Users']}
              size="w-5 h-5"
              fallbackColor="text-white"
            />
            Learning Circles
            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
              {userCircles.length}
            </Badge>
          </CardTitle>
          <Link to={createPageUrl('Learning')}>
            <ConfiguredIcon
              iconName="ArrowRight"
              iconConfig={iconConfigs['ArrowRight']}
              size="w-5 h-5"
              fallbackColor="text-orange-400"
              className="hover:text-orange-300 transition-colors cursor-pointer"
            />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {userCircles.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <ConfiguredIcon
              iconName="Users"
              iconConfig={iconConfigs['Users']}
              size="w-12 h-12"
              fallbackColor="text-slate-600"
              className="mx-auto mb-4"
            />
            <p>You haven't joined any learning circles yet.</p>
            <p className="text-sm mt-1">Find circles that match your interests!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userCircles.map((circle) => {
              const nextSessionDate = circle.next_session ? new Date(circle.next_session) : null;
              const formattedDate = nextSessionDate 
                ? format(nextSessionDate, 'MMM d, yyyy')
                : 'TBD';

              return (
                <div
                  key={circle.id}
                  className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-orange-500/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-white text-base">{circle.topic}</h4>
                    <Badge className="bg-green-500/20 text-green-400 text-xs">
                      <ConfiguredIcon 
                        iconName="Check"
                        iconConfig={iconConfigs['Check']}
                        size="w-3 h-3"
                        className="mr-1"
                      />
                      Joined
                    </Badge>
                  </div>
                  
                  <p className="text-slate-400 text-sm line-clamp-2 mb-3">
                    {circle.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-slate-400">
                      <ConfiguredIcon
                        iconName="Calendar"
                        iconConfig={iconConfigs['Calendar']}
                        size="w-3 h-3"
                      />
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <ConfiguredIcon
                        iconName="Users"
                        iconConfig={iconConfigs['Users']}
                        size="w-3 h-3"
                      />
                      <span>{circle.participants?.length || 0} members</span>
                    </div>
                    {circle.location_type && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <ConfiguredIcon
                          iconName={circle.location_type === 'physical' ? 'MapPin' : 'Globe'}
                          iconConfig={iconConfigs[circle.location_type === 'physical' ? 'MapPin' : 'Globe']}
                          size="w-3 h-3"
                        />
                        <span className="text-xs">{circle.location_type === 'physical' ? 'In-Person' : 'Online'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}