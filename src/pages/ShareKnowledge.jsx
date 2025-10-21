
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Resource, User } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import ResourceFormBasics from '@/components/resources/ResourceFormBasics';
import ResourceFormReview from '@/components/resources/ResourceFormReview';
import ResourcePreview from '@/components/resources/ResourcePreview';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

const STEPS = [
  { id: 1, title: 'Content', iconName: 'FileText' },
  { id: 2, title: 'Review & Publish', iconName: 'Send' }
];

export default function ShareKnowledge() {
  const [currentStep, setCurrentStep] = useState(1);
  const [resourceData, setResourceData] = useState({
    title: '',
    description: '',
    content: '',
    category: '',
    icon_name: '',
    attachments: [],
    related_links: [],
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedId, setPublishedId] = useState(null);
  const { iconConfigs } = useAllIconConfigs();
  
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const resourceId = urlParams.get('id');
  const isEditMode = !!resourceId;

  // Progressive Loading States - START AS FALSE
  const [sectionsReady, setSectionsReady] = useState({
    stepIndicator: false,
    formContent: false,
    previewPanel: false
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);

        if (isEditMode) {
          const [data] = await Resource.filter({ id: resourceId });
          if (data && (data.creator_id === user.id || user.role === 'admin')) {
            setResourceData({
              ...data,
              attachments: data.attachments || [],
              related_links: data.related_links || []
            });
          } else {
            navigate(createPageUrl('Learning'));
            return;
          }
        } else {
          setResourceData(prev => ({ ...prev, creator_id: user.id }));
        }

        // Mark sections as ready after data is loaded
        setSectionsReady({
          stepIndicator: true,
          formContent: true,
          previewPanel: true
        });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, [resourceId, isEditMode, navigate]);

  const updateResourceData = (updates) => {
    setResourceData(prev => ({ ...prev, ...updates }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return resourceData.title.length > 3 && resourceData.description.length > 10 && resourceData.category && resourceData.icon_name;
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
    setIsPublishing(true);
    try {
      let result;
      if (isEditMode) {
        result = await Resource.update(resourceId, resourceData);
        setPublishedId(resourceId);
      } else {
        result = await Resource.create(resourceData);
        setPublishedId(result.id);
        
        try {
          let magnitude = 2.0;
          
          if (resourceData.content && resourceData.content.trim().length > 0) {
            magnitude += 0.5;
          }
          
          if (resourceData.attachments && resourceData.attachments.length > 0) {
            magnitude += 0.5;
          }

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'knowledge',
            entity_id: result.id,
            action_type: 'KNOWLEDGE_PUBLISHED',
            magnitude: magnitude,
            alignment_score: 0.7,
            metadata: {
              category: resourceData.category,
              has_content: !!resourceData.content,
              has_attachments: resourceData.attachments?.length || 0,
              title: resourceData.title
            }
          });
          console.log('✓ Knowledge publishing resonance event recorded');
        } catch (error) {
          console.error('Failed to record resonance event:', error);
        }
      }
      setIsPublished(true);
    } catch (error) {
      console.error("Failed to publish resource:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <ResourceFormBasics
            resourceData={resourceData}
            onUpdate={updateResourceData}
          />
        );
      case 2:
        return (
          <ResourceFormReview
            resourceData={resourceData}
            onUpdate={updateResourceData}
          />
        );
      default:
        return null;
    }
  };

  // Skeleton Components
  const StepIndicatorSkeleton = () => (
    <div className="flex justify-center mt-6">
      <div className="flex items-center space-x-4 bg-slate-800/30 backdrop-blur-sm rounded-full px-6 py-3">
        {STEPS.map((_, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
              <div className="ml-2 h-4 w-24 bg-slate-700 animate-pulse rounded" />
            </div>
            {index < STEPS.length - 1 && (
              <div className="w-12 h-px bg-slate-600 mx-4" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const FormContentSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            <div className="h-4 w-24 bg-slate-700 animate-pulse rounded mb-2" />
            <div className="h-10 bg-slate-700 animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const PreviewPanelSkeleton = () => (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-lg" />
          <div className="flex-1">
            <div className="h-6 bg-slate-700 animate-pulse rounded w-3/4 mb-2" />
            <div className="h-4 bg-slate-700 animate-pulse rounded w-full mb-2" />
            <div className="h-4 bg-slate-700 animate-pulse rounded w-2/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  if (isPublished) {
     return (
      <div className="p-4 lg:p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-center">
            <CardContent className="p-10">
              <ConfiguredIcon 
                iconName="CheckCircle" 
                iconConfig={iconConfigs['CheckCircle']}
                size="w-16 h-16"
                className="mx-auto mb-4"
                fallbackColor="text-green-400"
              />
              <h2 className="text-2xl font-bold text-white mb-2">{isEditMode ? 'Resource Updated' : 'Resource Published'}</h2>
              <p className="text-slate-300 mb-6">Your contribution is now part of the Library of Resilience.</p>
              <div className="flex gap-4">
                <Link to={createPageUrl('Learning')} className="flex-1">
                  <Button variant="outline" className="w-full btn-secondary-coherosphere">Back to Library</Button>
                </Link>
                <Link to={createPageUrl(`ResourceDetail?id=${publishedId}`)} className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600">View Resource</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep - 1];

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="FileText" 
            iconConfig={iconConfigs['FileText']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              {isEditMode ? 'Edit Resource' : 'Share Knowledge'}
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          {isEditMode ? 'Update your resource content and settings.' : 'Contribute valuable insights and resources to the community.'}
        </p>
        
        {/* Step Indicator - Desktop - Progressive Loading */}
        <div className="hidden lg:block">
          {sectionsReady.stepIndicator ? (
            <motion.div 
              className="flex justify-center mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0 }}
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
                            fallbackColor="text-white"
                          />
                        ) : (
                          <ConfiguredIcon 
                            iconName={step.iconName} 
                            iconConfig={iconConfigs[step.iconName]}
                            size="w-5 h-5"
                            fallbackColor="text-current"
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
          ) : (
            <div className="mt-6">
              <StepIndicatorSkeleton />
            </div>
          )}
        </div>
        
        {/* Step Indicator - Mobile - Progressive Loading */}
        <div className="lg:hidden">
          {sectionsReady.stepIndicator ? (
            <motion.div 
              className="flex flex-col gap-3 mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0 }}
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
                            fallbackColor="text-white"
                          />
                        ) : (
                          <ConfiguredIcon 
                            iconName={step.iconName} 
                            iconConfig={iconConfigs[step.iconName]}
                            size="w-4 h-4"
                            fallbackColor="text-current"
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
                {[1, 2].map((i) => (
                  <React.Fragment key={i}>
                    <div className="w-8 h-8 bg-slate-700 animate-pulse rounded-full" />
                    {i < 2 && <div className="w-6 h-0.5 bg-slate-600" />}
                  </React.Fragment>
                ))}
              </div>
              <div className="h-5 bg-slate-700 animate-pulse rounded w-48 mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left Panel - Form - Progressive Loading */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ConfiguredIcon 
              iconName={currentStepData.iconName} 
              iconConfig={iconConfigs[currentStepData.iconName]}
              size="w-5 h-5"
              fallbackColor="text-slate-400"
            />
            {currentStepData.title}
          </h3>
          
          {sectionsReady.formContent ? (
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
                      {currentStep < 2 ? (
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
                          disabled={!isStepValid(1) || isPublishing}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                        >
                          <ConfiguredIcon 
                            iconName="Send" 
                            iconConfig={iconConfigs['Send']}
                            size="w-4 h-4"
                            className="mr-2"
                            fallbackColor="text-white"
                          />
                          {isPublishing 
                            ? 'Processing...' 
                            : (isEditMode ? 'Update Resource' : 'Publish Resource')}
                        </Button>
                      )}
                    </div>
                  </div>
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
            
            {sectionsReady.previewPanel ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.1 }}
              >
                <ResourcePreview 
                  resourceData={resourceData}
                  creator={currentUser}
                />
              </motion.div>
            ) : (
              <PreviewPanelSkeleton />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
