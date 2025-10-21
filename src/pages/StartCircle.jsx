import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LearningCircle, User } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';

import CircleFormBasics from '@/components/circles/CircleFormBasics';
import CircleFormReview from '@/components/circles/CircleFormReview';
import CirclePreview from '@/components/circles/CirclePreview';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

const STEPS = [
  { id: 1, title: 'Circle Details', iconName: 'FileText' },
  { id: 2, title: 'Review & Create', iconName: 'Send' }
];

export default function StartCircle() {
  const [currentStep, setCurrentStep] = useState(1);
  const [circleData, setCircleData] = useState({
    topic: '',
    description: '',
    frequency: 'Weekly',
    next_session: '',
    participants: [],
    location_type: 'online',
    physical_address: '',
    online_url: '',
    learning_goals: '',
    prerequisites: '',
    max_participants: null
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedId, setPublishedId] = useState(null);
  const { iconConfigs } = useAllIconConfigs();
  
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const circleId = urlParams.get('id');
  const isEditMode = !!circleId;

  // Progressive Loading States - START AS FALSE
  const [sectionsReady, setSectionsReady] = useState({
    stepIndicator: false,
    formContent: false,
    preview: false
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);

        if (isEditMode) {
          const [data] = await LearningCircle.filter({ id: circleId });
          if (data && (data.created_by === user.id || user.role === 'admin')) {
            setCircleData({
              ...data,
              participants: data.participants || [],
              location_type: data.location_type || 'online',
              physical_address: data.physical_address || '',
              online_url: data.online_url || '',
              learning_goals: data.learning_goals || '',
              prerequisites: data.prerequisites || '',
              max_participants: data.max_participants || null
            });
          } else {
            navigate(createPageUrl('Learning'));
            return;
          }
        } else {
          setCircleData(prev => ({ 
            ...prev, 
            participants: [user.id],
            created_by: user.id 
          }));
        }

        // Mark sections as ready after data is loaded
        setSectionsReady({
          stepIndicator: true,
          formContent: true,
          preview: true
        });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, [circleId, isEditMode, navigate]);

  const updateCircleData = (updates) => {
    setCircleData(prev => ({ ...prev, ...updates }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        const isLocationValid = 
          (circleData.location_type === 'physical' && circleData.physical_address.trim().length > 0) ||
          (circleData.location_type === 'online' && circleData.online_url.trim().length > 0);

        return circleData.topic.trim().length > 3 && 
               circleData.description.trim().length > 10 && 
               !!circleData.frequency && 
               !!circleData.next_session &&
               isLocationValid;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 2 && isStepValid(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handlePublish = async () => {
    if (!isStepValid(1)) return;
    setIsProcessing(true);
    try {
      let result;
      if (isEditMode) {
        result = await LearningCircle.update(circleId, circleData);
        setPublishedId(circleId);
      } else {
        result = await LearningCircle.create(circleData);
        setPublishedId(result.id);
        
        try {
          const participantCount = circleData.participants?.length || 0;
          let magnitude = 3.0;
          
          if (participantCount >= 3) {
            magnitude += 1.0;
            console.log('✓ Participation bonus applied (+1.0)');
          }

          let alignmentScore = 1.0;
          const manifestoValues = ['resilience', 'decentralization', 'dezentral', 'transparency', 'transparent', 'collective', 'kollektiv', 'trustless', 'solid', 'progressive'];
          const topic = (circleData.topic || '').toLowerCase();
          const description = (circleData.description || '').toLowerCase();
          const goals = (circleData.learning_goals || '').toLowerCase();
          
          const hasManifestoAlignment = manifestoValues.some(value => 
            topic.includes(value) || description.includes(value) || goals.includes(value)
          );
          
          if (hasManifestoAlignment) {
            alignmentScore = 1.2;
            console.log('✓ Manifesto alignment bonus applied (1.2 alignment)');
          }

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'user',
            entity_id: currentUser.id,
            action_type: 'LEARNING_CIRCLE_HOSTED',
            magnitude: magnitude,
            alignment_score: alignmentScore,
            metadata: {
              circle_id: result.id,
              circle_topic: result.topic,
              participant_count: participantCount,
              frequency: result.frequency,
              has_manifesto_alignment: hasManifestoAlignment,
              has_participation_bonus: participantCount >= 3
            }
          });

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'circle',
            entity_id: result.id,
            action_type: 'LEARNING_CIRCLE_HOSTED',
            magnitude: magnitude,
            alignment_score: alignmentScore,
            metadata: {
              host_id: currentUser.id,
              participant_count: participantCount,
              topic: result.topic
            }
          });

          console.log(`✓ Learning circle resonance recorded (${magnitude} points, ${participantCount} participants)`);
        } catch (error) {
          console.error('Failed to record resonance event:', error);
        }
      }
      setIsPublished(true);
    } catch (error) {
      console.error("Failed to create circle:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <CircleFormBasics
            circleData={circleData}
            onUpdate={updateCircleData}
          />
        );
      case 2:
        return (
          <CircleFormReview
            circleData={circleData}
            onUpdate={updateCircleData}
          />
        );
      default:
        return null;
    }
  };

  if (isPublished) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-center">
            <CardContent className="p-10">
              <ConfiguredIcon 
                iconName="CheckCircle" 
                iconConfig={iconConfigs['CheckCircle']}
                size="w-16 h-16"
                className="mx-auto mb-4"
              />
              <h2 className="text-2xl font-bold text-white mb-2">{isEditMode ? 'Circle Updated' : 'Circle Created'}</h2>
              <p className="text-slate-300 mb-6">Your learning circle is now active and ready for participants to join.</p>
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  className="btn-secondary-coherosphere" 
                  onClick={() => navigate(createPageUrl('Learning'))}
                >
                  Back to Learning
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
                  onClick={() => navigate(createPageUrl('Learning'))}
                >
                  View Circle
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep - 1];

  // Skeleton Components
  const StepIndicatorSkeleton = () => (
    <div className="flex justify-center mt-6">
      <div className="flex items-center space-x-4 bg-slate-800/30 backdrop-blur-sm rounded-full px-6 py-3">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
            <div className="ml-2 h-4 w-24 bg-slate-700 animate-pulse rounded" />
            {index < STEPS.length - 1 && (
              <div className="w-12 h-px mx-4 bg-slate-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const FormContentSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6">
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-32 bg-slate-700 animate-pulse rounded mb-2" />
              <div className="h-10 bg-slate-700 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const PreviewSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6">
        <div className="h-8 w-32 bg-slate-700 animate-pulse rounded mb-4" />
        <div className="space-y-4">
          <div className="h-6 bg-slate-700 animate-pulse rounded" />
          <div className="h-20 bg-slate-700 animate-pulse rounded" />
          <div className="h-6 bg-slate-700 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <ConfiguredIcon 
            iconName="Users" 
            iconConfig={iconConfigs['Users']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              {isEditMode ? 'Edit Learning Circle' : 'Start a Learning Circle'}
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Create a space for collective learning and growth
        </p>
        
        {/* Step Indicator - Desktop */}
        <div className="hidden lg:block mt-6">
          {!sectionsReady.stepIndicator ? (
            <StepIndicatorSkeleton />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0 }}
              className="flex justify-center"
            >
              <div className="flex items-center space-x-4 bg-slate-800/30 backdrop-blur-sm rounded-full px-6 py-3">
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
                          />
                        ) : (
                          <ConfiguredIcon 
                            iconName={step.iconName} 
                            iconConfig={iconConfigs[step.iconName]}
                            size="w-5 h-5"
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
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Step Indicator - Mobile */}
        <div className="lg:hidden mt-6">
          {!sectionsReady.stepIndicator ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2">
                {STEPS.map((_, index) => (
                  <React.Fragment key={index}>
                    <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
                    {index < STEPS.length - 1 && <div className="w-6 h-0.5 bg-slate-700" />}
                  </React.Fragment>
                ))}
              </div>
              <div className="h-4 w-48 bg-slate-700 animate-pulse rounded mx-auto" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0 }}
              className="flex flex-col gap-3"
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
                          />
                        ) : (
                          <ConfiguredIcon 
                            iconName={step.iconName} 
                            iconConfig={iconConfigs[step.iconName]}
                            size="w-4 h-4"
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
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left Panel - Form */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ConfiguredIcon 
              iconName={currentStepData.iconName} 
              iconConfig={iconConfigs[currentStepData.iconName]}
              size="w-5 h-5"
            />
            {currentStepData.title}
          </h3>
          
          {!sectionsReady.formContent ? (
            <FormContentSkeleton />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardContent className="p-6 text-slate-100">
                  {renderStepContent()}
                  
                  {/* Navigation */}
                  <div className="flex justify-between items-center pt-6 border-t border-slate-700 mt-8">
                    <div>
                      {currentStep > 1 && (
                        <Button
                          variant="outline"
                          onClick={handlePrevious}
                          className="btn-secondary-coherosphere"
                        >
                          Previous
                        </Button>
                      )}
                    </div>

                    <div>
                      {currentStep < STEPS.length ? (
                        <Button
                          onClick={handleNext}
                          disabled={!isStepValid(currentStep)}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                        >
                          Next: {STEPS[currentStep].title}
                        </Button>
                      ) : (
                        <Button
                          onClick={handlePublish}
                          disabled={!isStepValid(1) || isProcessing}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                        >
                          <ConfiguredIcon 
                            iconName="Send" 
                            iconConfig={iconConfigs['Send']}
                            size="w-4 h-4"
                            className="mr-2"
                          />
                          {isProcessing 
                            ? 'Processing...' 
                            : (isEditMode ? 'Update Circle' : 'Create Circle')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Panel - Live Preview */}
        <div className="hidden xl:block">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ConfiguredIcon 
                iconName="Eye" 
                iconConfig={iconConfigs['Eye']}
                size="w-5 h-5"
              />
              Live Preview
            </h3>
            
            {!sectionsReady.preview ? (
              <PreviewSkeleton />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.1 }}
              >
                <CirclePreview 
                  circleData={circleData}
                  creator={currentUser}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}