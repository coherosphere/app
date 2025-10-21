
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Project, User } from '@/api/entities';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

import ProjectFormBasics from '../components/projects/ProjectFormBasics';
import ProjectFormDetails from '../components/projects/ProjectFormDetails';
import ProjectFormReview from '../components/projects/ProjectFormReview';
import ProjectPreview from '../components/projects/ProjectPreview';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

const STEPS = [
  { id: 1, title: 'Basics', icon: 'FileText' },
  { id: 2, title: 'Details', icon: 'Bitcoin' },
  { id: 3, title: 'Review & Publish', icon: 'Send' }
];

export default function CreateProject() {
  const { iconConfigs } = useAllIconConfigs();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedProject, setPublishedProject] = useState(null);
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');
  const isEditMode = !!projectId;

  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    goal: '',
    manifesto_compliance: false,
    community_commitment: false,
    category: 'community',
    hub_id: null,
    funding_needed: 100000,
    status: 'proposed',
  });

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
          const projects = await Project.list();
          const existingProject = projects.find(p => p.id === projectId);
          if (existingProject && (existingProject.creator_id === user.id || user.role === 'admin')) {
            setProjectData({
              ...existingProject,
              funding_needed: existingProject.funding_needed || 0,
              goal: existingProject.goal || '',
              manifesto_compliance: existingProject.manifesto_compliance || false,
              community_commitment: existingProject.community_commitment || false,
            });
          } else {
            console.error('Project not found or user not authorized to edit.');
            navigate(createPageUrl('Projects'));
            return;
          }
        } else {
           setProjectData(prev => ({ ...prev, hub_id: user.hub_id, creator_id: user.id }));
        }

        // Mark sections as ready after data is loaded
        setSectionsReady({
          stepIndicator: true,
          formContent: true,
          preview: true
        });
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [projectId, isEditMode, navigate]);

  const updateProjectData = (updates) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return projectData.title.length > 3 && 
               projectData.description.length >= 50 &&
               projectData.goal.length >= 40 &&
               projectData.manifesto_compliance === true &&
               projectData.community_commitment === true;
      case 2:
        return projectData.hub_id && projectData.funding_needed >= 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3 && isStepValid(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handlePublish = async () => {
    if (!isStepValid(1) || !isStepValid(2)) return;

    setIsPublishing(true);
    try {
      let resultProject;
      const dataToSave = {
        ...projectData,
        creator_id: projectData.creator_id || currentUser.id,
      };

      if (isEditMode) {
        resultProject = await Project.update(projectId, dataToSave);
      } else {
        resultProject = await Project.create(dataToSave);
        
        // Record resonance event for NEW project creation
        try {
          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'user',
            entity_id: currentUser.id,
            action_type: 'PROJECT_CREATED',
            magnitude: 4.0,
            alignment_score: 1.0,
            hub_id: projectData.hub_id,
            metadata: {
              project_id: resultProject.id,
              project_title: resultProject.title,
              category: resultProject.category,
              funding_needed: resultProject.funding_needed
            }
          });

          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'project',
            entity_id: resultProject.id,
            action_type: 'PROJECT_CREATED',
            magnitude: 4.0,
            alignment_score: 1.0,
            hub_id: projectData.hub_id,
            metadata: {
              creator_id: currentUser.id,
              category: resultProject.category,
              title: resultProject.title
            }
          });

          if (projectData.hub_id) {
            await base44.functions.invoke('recordResonanceEvent', {
              entity_type: 'hub',
              entity_id: projectData.hub_id,
              action_type: 'PROJECT_CREATED',
              magnitude: 1.0,
              alignment_score: 1.0,
              metadata: {
                project_id: resultProject.id,
                project_title: resultProject.title,
                creator_id: currentUser.id
              }
            });
          }

          console.log('✓ Project creation resonance events recorded');
        } catch (error) {
          console.error('Failed to record resonance event:', error);
        }
      }

      setPublishedProject(resultProject);
      setIsPublished(true);
    } catch (error) {
      console.error('Error publishing project:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return <ProjectFormBasics eventData={projectData} onUpdate={updateProjectData} />;
      case 2: return <ProjectFormDetails eventData={projectData} onUpdate={updateProjectData} />;
      case 3: return <ProjectFormReview eventData={projectData} />;
      default: return null;
    }
  };
  
  if (isPublished) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl w-full"
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardContent className="p-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                <ConfiguredIcon 
                  iconName="CheckCircle"
                  iconConfig={iconConfigs['CheckCircle']}
                  size="w-10 h-10"
                />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                {isEditMode ? 'Project Updated!' : 'Project Published!'}
              </h1>
              <p className="text-slate-300 mb-8">
                Your project "{publishedProject?.title}" is now proposed and visible to the community.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to={createPageUrl('Projects')}>
                  <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold w-full">
                    <ConfiguredIcon 
                      iconName="ArrowLeft"
                      iconConfig={iconConfigs['ArrowLeft']}
                      size="w-4 h-4"
                      className="mr-2"
                    />
                    Back to All Projects
                  </Button>
                </Link>
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
          {[...Array(5)].map((_, i) => (
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
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-slate-700 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-6 bg-slate-700 animate-pulse rounded mb-2" />
            <div className="flex gap-2 flex-wrap">
              <div className="h-5 w-20 bg-slate-700 animate-pulse rounded-full" />
              <div className="h-5 w-24 bg-slate-700 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
          <div className="h-4 bg-slate-700 animate-pulse rounded w-5/6" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE with final content immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="Lightbulb" 
            iconConfig={iconConfigs['Lightbulb']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              {isEditMode ? 'Edit Your Project' : 'Create Your Project'}
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          {isEditMode ? 'Update your project details and settings.' : 'Share your project idea and bring it to life with the coherosphere community.'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div>
           <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ConfiguredIcon 
                iconName={currentStepData.icon}
                iconConfig={iconConfigs[currentStepData.icon]}
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
                <CardContent className="p-6">
                  {renderStepContent()}
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
                          <Button onClick={handleNext} disabled={!isStepValid(currentStep)} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold">
                            Next: {STEPS[currentStep].title}
                          </Button>
                        ) : (
                          <Button onClick={handlePublish} disabled={isPublishing || !isStepValid(1) || !isStepValid(2)} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold">
                            <ConfiguredIcon 
                              iconName="Send"
                              iconConfig={iconConfigs['Send']}
                              size="w-4 h-4"
                              className="mr-2"
                            />
                            {isPublishing ? 'Publishing...' : (isEditMode ? 'Update Project' : 'Publish Project')}
                          </Button>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

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
                <ProjectPreview projectData={projectData} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
