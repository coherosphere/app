
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Event, User } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

import EventFormBasics from '@/components/events/EventFormBasics';
import EventFormTimePlace from '@/components/events/EventFormTimePlace';
import EventFormResonance from '@/components/events/EventFormResonance';
import EventFormReview from '@/components/events/EventFormReview';
import EventPreview from '@/components/events/EventPreview';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

const STEPS = [
  { id: 1, title: 'Basics', icon: 'Calendar' },
  { id: 2, title: 'Time & Place', icon: 'MapPin' },
  { id: 3, title: 'Resonance', icon: 'Users' },
  { id: 4, title: 'Review & Publish', icon: 'Send' }
];

export default function HostEvent() {
  const navigate = useNavigate();
  const { iconConfigs } = useAllIconConfigs();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'workshop',
    date: '',
    start_time: '',
    end_time: '',
    location_type: 'physical',
    location: '',
    max_participants: '',
    requirements: '',
    goals: [],
    values: [],
    requested_skills: [],
    contribution_types: ['time'],
    publish_to_nostr: false,
    hub_id: '',
    created_by: ''
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editEventId, setEditEventId] = useState(null);

  // Progressive Loading States - START AS FALSE
  const [sectionsReady, setSectionsReady] = useState({
    stepIndicator: false,
    formContent: false,
    preview: false
  });

  useEffect(() => {
    const loadUserAndData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        const urlParams = new URLSearchParams(window.location.search);
        const hubId = urlParams.get('hubId');
        const eventId = urlParams.get('eventId');
        
        if (hubId) {
          setFormData(prev => ({ ...prev, hub_id: hubId }));
        }
        
        if (eventId) {
          setIsEditMode(true);
          setEditEventId(eventId);
          
          const existingEvent = await Event.get(eventId);
          if (existingEvent) {
            setFormData({
              title: existingEvent.title || '',
              description: existingEvent.description || '',
              category: existingEvent.category || 'workshop',
              date: existingEvent.date || '',
              start_time: existingEvent.start_time || '',
              end_time: existingEvent.end_time || '',
              location_type: existingEvent.location_type || 'physical',
              location: existingEvent.location || '',
              max_participants: existingEvent.max_participants || '',
              requirements: existingEvent.requirements || '',
              goals: existingEvent.goals || [],
              values: existingEvent.values || [],
              requested_skills: existingEvent.requested_skills || [],
              contribution_types: existingEvent.contribution_types || ['time'],
              publish_to_nostr: existingEvent.publish_to_nostr || false,
              hub_id: existingEvent.hub_id || hubId || '',
              created_by: existingEvent.created_by || ''
            });
          }
        }

        // Mark all sections as ready after data is loaded
        setSectionsReady({
          stepIndicator: true,
          formContent: true,
          preview: true
        });
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadUserAndData();
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFormDataChange = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const eventData = {
        ...formData,
        created_by: currentUser?.email || '',
        status: 'published'
      };

      let result;
      if (isEditMode && editEventId) {
        result = await Event.update(editEventId, eventData);
      } else {
        result = await Event.create(eventData);
        
        try {
          const attendeeCount = formData.attendees?.length || 0;
          
          let magnitude = 1.0;
          
          if (attendeeCount >= 3) {
            magnitude += 2.0;
          }
          if (attendeeCount >= 10) {
            magnitude += 1.0;
          }
          if (attendeeCount >= 25) {
            magnitude += 2.0;
          }

          let alignmentScore = 1.0;
          
          const manifestoValues = ['resilience', 'transparency', 'collective', 'decentralization', 'trustless'];
          const eventGoals = (formData.goals || []).map(g => g.toLowerCase());
          const eventValues = (formData.values || []).map(v => v.toLowerCase());
          
          const hasManifestoAlignment = [...eventGoals, ...eventValues].some(item =>
            manifestoValues.some(value => item.includes(value))
          );
          
          if (hasManifestoAlignment) {
            alignmentScore = 1.2;
          }

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'user',
            entity_id: currentUser.id,
            action_type: 'EVENT_HOSTED',
            magnitude: magnitude,
            alignment_score: alignmentScore,
            hub_id: formData.hub_id,
            metadata: {
              event_id: result.id,
              event_title: result.title,
              attendee_count: attendeeCount,
              category: result.category,
              location_type: result.location_type,
              has_manifesto_alignment: hasManifestoAlignment,
              has_participation_bonus: attendeeCount >= 3
            }
          });

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'event',
            entity_id: result.id,
            action_type: 'EVENT_HOSTED',
            magnitude: magnitude,
            alignment_score: alignmentScore,
            hub_id: formData.hub_id,
            metadata: {
              organizer_id: currentUser.id,
              attendee_count: attendeeCount,
              category: result.category
            }
          });

          if (formData.hub_id) {
            await base44.functions.invoke('recordResonanceEvent', {
              entity_type: 'hub',
              entity_id: formData.hub_id,
              action_type: 'EVENT_HOSTED',
              magnitude: 0.5,
              alignment_score: alignmentScore,
              metadata: {
                event_id: result.id,
                event_title: result.title,
                organizer_id: currentUser.id,
                attendee_count: attendeeCount
              }
            });
          }

          console.log(`✓ Event hosting resonance recorded (${magnitude} points, ${attendeeCount} attendees)`);
        } catch (error) {
          console.error('Failed to record resonance event:', error);
        }
      }

      setIsSuccess(true);
      
      setTimeout(() => {
        if (formData.hub_id) {
          navigate(createPageUrl('Hub') + `?hubId=${formData.hub_id}`);
        } else {
          navigate(createPageUrl('Hub'));
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error publishing event:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <EventFormBasics
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            organizer={currentUser}
          />
        );
      case 2:
        return (
          <EventFormTimePlace
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <EventFormResonance
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <EventFormReview
            formData={formData}
            onPublish={handlePublish}
            onBack={handleBack}
            isPublishing={isPublishing}
            isEditMode={isEditMode}
          />
        );
      default:
        return null;
    }
  };

  // Skeleton Components
  const StepIndicatorSkeleton = () => (
    <div className="flex justify-center">
      <div className="flex items-center space-x-4 bg-slate-800/30 backdrop-blur-sm rounded-full px-6 py-3">
        {STEPS.map((_, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
              <div className="ml-2 h-4 w-24 bg-slate-700 animate-pulse rounded hidden lg:block" />
            </div>
            {index < STEPS.length - 1 && (
              <div className="w-12 h-px bg-slate-600 mx-4 hidden lg:block" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const FormContentSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <div className="h-4 w-32 bg-slate-700 animate-pulse rounded mb-2" />
            <div className="h-10 bg-slate-700 animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const PreviewSkeleton = () => (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 hover:bg-slate-800/60 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="w-20 h-24 bg-slate-700 animate-pulse rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
              <div className="h-6 bg-slate-700 animate-pulse rounded w-3/4" />
              <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
              <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isSuccess) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="bg-slate-800/80 backdrop-blur-sm border-slate-700 p-8 text-center max-w-md">
          <CardContent>
            <ConfiguredIcon 
              iconName="CheckCircle"
              iconConfig={iconConfigs['CheckCircle']}
              size="w-16 h-16"
              className="mx-auto mb-4"
              fallbackColor="text-green-400"
            />
            <h2 className="text-2xl font-bold text-white mb-2">
              {isEditMode ? 'Event Updated!' : 'Event Published!'}
            </h2>
            <p className="text-slate-400 mb-4">
              {isEditMode ? 'Your event has been successfully updated.' : 'Your event is now live and visible to the community.'}
            </p>
            <div className="animate-pulse text-orange-400">Redirecting to hub...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="CalendarPlus" 
            iconConfig={iconConfigs['CalendarPlus']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              {isEditMode ? 'Edit Event' : 'Host an Event'}
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          {isEditMode ? 'Update your event details.' : 'Bring the community together through meaningful events.'}
        </p>
      </div>

      {/* Step Indicator - Desktop - Progressive Loading */}
      <div className="hidden lg:flex justify-center mt-6">
        {sectionsReady.stepIndicator ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0 }}
            className="flex items-center space-x-4 bg-slate-800/30 backdrop-blur-sm rounded-full px-6 py-3"
          >
            {STEPS.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                    isActive ? 'bg-orange-500 text-white' : 
                    isCompleted ? 'bg-green-500 text-white' : 
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <ConfiguredIcon 
                        iconName="CheckCircle"
                        iconConfig={iconConfigs['CheckCircle']}
                        size="w-5 h-5"
                        fallbackColor="currentColor"
                      />
                    ) : (
                      <ConfiguredIcon 
                        iconName={step.icon}
                        iconConfig={iconConfigs[step.icon]}
                        size="w-5 h-5"
                        fallbackColor="currentColor"
                      />
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-orange-400' : 
                    isCompleted ? 'text-green-400' : 
                    'text-slate-500'
                  }`}>
                    {step.title}
                  </span>
                  {index < STEPS.length - 1 && (
                    <div className={`w-12 h-px mx-4 transition-colors ${
                      isCompleted ? 'bg-green-400' : 'bg-slate-600'
                    }`} />
                  )}
                </div>
              );
            })}
          </motion.div>
        ) : (
          <StepIndicatorSkeleton />
        )}
      </div>
      
      {/* Step Indicator - Mobile - Progressive Loading */}
      <div className="lg:hidden">
        {sectionsReady.stepIndicator ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0 }}
            className="flex flex-col gap-3 mt-6"
          >
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
              {STEPS.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <React.Fragment key={step.id}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors flex-shrink-0 ${
                      isActive ? 'bg-orange-500 text-white' :
                      isCompleted ? 'bg-green-500' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <ConfiguredIcon 
                          iconName="CheckCircle"
                          iconConfig={iconConfigs['CheckCircle']}
                          size="w-4 h-4"
                          fallbackColor="currentColor"
                        />
                      ) : (
                        <ConfiguredIcon 
                          iconName={step.icon}
                          iconConfig={iconConfigs[step.icon]}
                          size="w-4 h-4"
                          fallbackColor="currentColor"
                        />
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`w-6 h-0.5 transition-colors flex-shrink-0 ${
                        isCompleted ? 'bg-green-500' : 'bg-slate-600'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="text-center">
              <span className="text-sm text-slate-400">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.title}
              </span>
            </div>
          </motion.div>
        ) : (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              {[1, 2, 3, 4].map((i) => (
                <React.Fragment key={i}>
                  <div className="w-8 h-8 bg-slate-700 animate-pulse rounded-full" />
                  {i < 4 && <div className="w-6 h-0.5 bg-slate-600" />}
                </React.Fragment>
              ))}
            </div>
            <div className="h-5 bg-slate-700 animate-pulse rounded w-48 mx-auto" />
          </div>
        )}
      </div>
      
      {/* Form Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left Panel - Form - Progressive Loading */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ConfiguredIcon 
              iconName={STEPS[currentStep - 1]?.icon}
              iconConfig={iconConfigs[STEPS[currentStep - 1]?.icon]}
              size="w-5 h-5"
              fallbackColor="text-slate-400"
            />
            {STEPS[currentStep - 1]?.title}
          </h3>
          
          {sectionsReady.formContent ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardContent className="p-6">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {renderStepContent()}
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <FormContentSkeleton />
          )}
        </div>

        {/* Right Panel - Live Preview - Progressive Loading */}
        <div className="hidden xl:block">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ConfiguredIcon 
                iconName="Eye"
                iconConfig={iconConfigs['Eye']}
                size="w-5 h-5"
                fallbackColor="text-slate-400"
              />
              Live Preview
            </h3>
            
            {sectionsReady.preview ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.1 }}
              >
                <EventPreview 
                  formData={formData}
                  organizer={currentUser}
                />
              </motion.div>
            ) : (
              <PreviewSkeleton />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
