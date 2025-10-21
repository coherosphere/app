
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Resource, User } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { CreateFileSignedUrl, base44 } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { iconMap } from '@/components/config/iconMap';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

const getCategoryStyles = (key) => {
  switch (key) {
    case 'CommunityBuilding':
      return {
        bgColor: 'rgba(114, 106, 145, 0.15)',
        borderColor: 'rgba(114, 106, 145, 0.3)',
      };
    case 'HolisticHealth':
      return {
        bgColor: 'rgba(123, 158, 135, 0.15)',
        borderColor: 'rgba(123, 158, 135, 0.3)',
      };
    case 'DecentralizedTech':
      return {
        bgColor: 'rgba(42, 62, 92, 0.2)',
        borderColor: 'rgba(42, 62, 92, 0.4)',
      };
    case 'NatureSustainability':
    case 'Nature&Sustainability':
      return {
        bgColor: 'rgba(85, 107, 47, 0.15)',
        borderColor: 'rgba(85, 107, 47, 0.3)',
      };
    default:
      return {
        bgColor: 'rgba(100, 116, 139, 0.15)',
        borderColor: 'rgba(100, 116, 139, 0.3)',
      };
  }
};

const AttachmentItem = ({ attachment, iconConfigs }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const result = await CreateFileSignedUrl({ file_uri: attachment.uri });
      if (result.signed_url) {
        window.open(result.signed_url, '_blank');
      }
    } catch (error) {
      console.error("Failed to get signed URL", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isLoading}
      className="btn-secondary-coherosphere justify-start gap-3">

      {isLoading ? (
        <ConfiguredIcon
          iconName="Download"
          iconConfig={iconConfigs['Download']}
          size="w-4 h-4"
          className="animate-pulse"
        />
      ) : (
        <ConfiguredIcon
          iconName="Paperclip"
          iconConfig={iconConfigs['Paperclip']}
          size="w-4 h-4"
        />
      )}
      <span className="truncate">{attachment.name}</span>
    </Button>
  );
};

const isValidUserId = (id) => {
  if (!id) return false;
  const objectIdRegex = /^[a-f\d]{24}$/i;
  const uuidRegex = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  return objectIdRegex.test(id) || uuidRegex.test(id);
};

export default function ResourceDetail() {
  const [creator, setCreator] = useState(null);
  const [vote, setVote] = useState(null);
  const navigate = useNavigate();
  const { iconConfigs } = useAllIconConfigs();

  const urlParams = new URLSearchParams(window.location.search);
  const resourceId = urlParams.get('id');

  // Progressive Loading States - START AS FALSE
  const [sectionsReady, setSectionsReady] = useState({
    content: false,
    attachmentsLinks: false,
    author: false,
    actions: false,
    relatedResources: false
  });

  // Use cached data for current user
  const { data: currentUser, isLoading: userLoading } = useCachedData(
    ['resourceDetail', 'currentUser'],
    () => User.me().catch(() => null),
    'resourceDetail'
  );

  // Use cached data for current resource
  const { data: resourceData, isLoading: resourceLoading, invalidate: invalidateResourceCache } = useCachedData(
    ['resourceDetail', 'resource', resourceId],
    () => Resource.filter({ id: resourceId }),
    'resourceDetail',
    { enabled: !!resourceId }
  );

  // Use cached data for all resources (for related resources)
  const { data: allResources = [], isLoading: allResourcesLoading } = useCachedData(
    ['resourceDetail', 'allResources'],
    () => Resource.list(),
    'resourceDetail',
    { enabled: !!resourceId }
  );

  const resource = resourceData && resourceData.length > 0 ? resourceData[0] : null;

  // Redirect if no resourceId
  useEffect(() => {
    if (!resourceId) {
      navigate(createPageUrl('Learning'));
    }
  }, [resourceId, navigate]);

  // Redirect if resource not found after loading
  useEffect(() => {
    if (!resourceLoading && !resource && resourceId) {
      navigate(createPageUrl('Learning'));
    }
  }, [resourceLoading, resource, navigate, resourceId]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    if (!resourceLoading && resource) {
      setSectionsReady(prev => ({ ...prev, content: true }));
    }
  }, [resourceLoading, resource]);

  useEffect(() => {
    if (!resourceLoading && resource) {
      setSectionsReady(prev => ({ ...prev, attachmentsLinks: true }));
    }
  }, [resourceLoading, resource]);

  useEffect(() => {
    if (!resourceLoading && resource && creator !== undefined) {
      setSectionsReady(prev => ({ ...prev, author: true }));
    }
  }, [resourceLoading, resource, creator]);

  useEffect(() => {
    if (!resourceLoading && !userLoading && resource) {
      setSectionsReady(prev => ({ ...prev, actions: true }));
    }
  }, [resourceLoading, userLoading, resource]);

  useEffect(() => {
    if (!allResourcesLoading && !resourceLoading && resource) {
      setSectionsReady(prev => ({ ...prev, relatedResources: true }));
    }
  }, [allResourcesLoading, resourceLoading, resource]);

  // Compute related resources
  const relatedResources = React.useMemo(() => {
    if (!resource || allResources.length === 0) return [];
    return allResources
      .filter(r =>
        r.id !== resource.id &&
        r.category === resource.category
      )
      .slice(0, 5);
  }, [resource, allResources]);

  // Fetch creator profile
  useEffect(() => {
    const fetchCreator = async () => {
      if (!resource) return;

      const creatorIdToFetch = resource.creator_id || resource.created_by_id;

      if (creatorIdToFetch && isValidUserId(creatorIdToFetch)) {
        try {
          const response = await base44.functions.invoke('getPublicUserProfile', {
            userId: creatorIdToFetch
          });
          if (response.data && response.data.user) {
            setCreator(response.data.user);
          }
        } catch (e) {
          console.warn(`Failed to fetch creator profile for user: ${creatorIdToFetch}`, e);
          setCreator(null);
        }
      } else {
        setCreator(null);
      }
    };

    fetchCreator();
  }, [resource]);

  const handleVote = async (voteType) => {
    if (!resource || vote === voteType) return;

    let newUpvotes = resource.upvotes || 0;
    let newDownvotes = resource.downvotes || 0;

    if (voteType === 'up') {
      newUpvotes = (vote === 'down') ? newUpvotes + 1 : newUpvotes + 1;
      newDownvotes = (vote === 'down') ? newDownvotes - 1 : newDownvotes;
    } else {
      newDownvotes = (vote === 'up') ? newDownvotes + 1 : newDownvotes + 1;
      newUpvotes = (vote === 'up') ? newUpvotes - 1 : newUpvotes;
    }

    const previousVote = vote;

    setVote(voteType);
    invalidateResourceCache();

    try {
      await Resource.update(resource.id, {
        upvotes: newUpvotes,
        downvotes: newDownvotes
      });
      invalidateResourceCache();
    } catch (error) {
      console.error("Failed to save vote:", error);
      setVote(previousVote);
      invalidateResourceCache();
    }
  };

  // Don't return early - show skeletons instead
  const categoryKey = resource?.category?.replace(/ & /g, '').replace(/ /g, '');
  const categoryStyles = getCategoryStyles(categoryKey);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mx-auto"
      >

        {/* Header - ALWAYS VISIBLE with final content immediately */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-shrink-0">
              <div className={`w-12 h-12 flex items-center justify-center rounded-lg bg-orange-500/10`}>
                <ConfiguredIcon
                  iconName="BookOpen"
                  iconConfig={iconConfigs['BookOpen']}
                  size="w-8 h-8"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {/* This h1 element already uses text-2xl for mobile (default) */}
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                {resource?.title || 'Resource Detail'}
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>

          {/* Category Badge & Description */}
          {resource ? (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: categoryStyles.bgColor,
                    borderColor: categoryStyles.borderColor
                  }}
                >
                  <ConfiguredIcon
                    iconName={resource.icon_name}
                    iconConfig={iconConfigs[resource.icon_name]}
                    size="w-6 h-6"
                  />
                </div>
                <span
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-full border text-white"
                  style={{
                    backgroundColor: categoryStyles.bgColor,
                    borderColor: categoryStyles.borderColor
                  }}
                >
                  {resource.category}
                </span>
              </div>
              <p className="text-lg text-slate-400 leading-relaxed max-w-4xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {resource.description}
              </p>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-slate-700 animate-pulse rounded-lg" />
                <div className="h-6 w-32 bg-slate-700 animate-pulse rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-5 bg-slate-700 animate-pulse rounded w-full max-w-4xl" />
                <div className="h-5 bg-slate-700 animate-pulse rounded w-3/4 max-w-4xl" />
              </div>
            </div>
          )}
        </div>

        {/* Main Grid Layout: 3 Columns (Content spans 2, Sidebar spans 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Content (spans 2 columns on desktop) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Main Content Card */}
            {!sectionsReady.content ? (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                  <CardContent className="p-6">
                    <div className="prose prose-slate max-w-none">
                      <div className="space-y-8 text-slate-300 leading-relaxed text-lg">
                        {resource && resource.content ? (
                          <ReactQuill
                            value={resource.content}
                            readOnly={true}
                            theme="bubble"
                            className="text-white text-lg resource-content"
                          />
                        ) : (
                          <p className="text-slate-400">No content available.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Attachments & Links - Full Width Below Content */}
            {!sectionsReady.attachmentsLinks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <Card key={i} className="bg-slate-800/30 border-slate-700">
                    <CardHeader>
                      <div className="h-5 bg-slate-700 animate-pulse rounded w-32" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-10 bg-slate-700 animate-pulse rounded" />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              resource && (resource.attachments?.length > 0 || resource.related_links?.length > 0) && (
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.05 }}
                >
                  {/* Attachments */}
                  {resource.attachments?.length > 0 && (
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-white">Attachments</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.attachments.map((att, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.05 }}
                          >
                            <AttachmentItem attachment={att} iconConfigs={iconConfigs} />
                          </motion.div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Related Links */}
                  {resource.related_links?.length > 0 && (
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-white">Related Links</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.related_links.map((link, i) => (
                          <motion.a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={i}
                            className="flex items-center gap-3 text-slate-300 hover:text-orange-400 transition-colors group p-2 rounded-lg hover:bg-slate-700/50"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.05 }}
                          >
                            <ConfiguredIcon
                              iconName="Link"
                              iconConfig={iconConfigs['Link']}
                              size="w-4 h-4"
                              className="group-hover:text-orange-400"
                            />
                            <span className="truncate">{link.title}</span>
                          </motion.a>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )
            )}

            {/* Author Section */}
            {!sectionsReady.author ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-full" />
                    <div className="flex-1">
                      <div className="h-3 bg-slate-700 animate-pulse rounded w-24 mb-2" />
                      <div className="h-5 bg-slate-700 animate-pulse rounded w-40 mb-2" />
                      <div className="h-3 bg-slate-700 animate-pulse rounded w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              creator && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                >
                  <Card className="bg-slate-800/30 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={creator.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${creator.nostr_pubkey || creator.email || 'fallback'}&backgroundColor=FF6A00,FF8C42&size=48`}
                          alt={creator.display_name || creator.full_name}
                          className="w-12 h-12 rounded-full border-2 border-slate-600"
                          onError={(e) => {
                            e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${creator.nostr_pubkey || creator.email || 'fallback'}&backgroundColor=FF6A00,FF8C42&size=48`;
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">Created by</p>
                          <p className="text-white font-semibold text-base mb-1">
                            {creator.display_name || creator.full_name}
                          </p>
                          {creator.nostr_pubkey && (
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                                {creator.nostr_pubkey.substring(0, 12)}...{creator.nostr_pubkey.substring(creator.nostr_pubkey.length - 8)}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(creator.nostr_pubkey);
                                }}
                                className="text-slate-400 hover:text-orange-400 transition-colors"
                                title="Copy Nostr pubkey"
                              >
                                <ConfiguredIcon
                                  iconName="Copy"
                                  iconConfig={iconConfigs['Copy']}
                                  size="w-3 h-3"
                                />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            )}

            {/* Bottom Actions - Edit Left, Voting Right */}
            {!sectionsReady.actions ? (
              <div className="flex justify-between items-center">
                <div className="h-10 w-24 bg-slate-700 animate-pulse rounded" />
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-slate-700 animate-pulse rounded w-32" />
                  <div className="flex gap-2">
                    <div className="h-9 w-16 bg-slate-700 animate-pulse rounded" />
                    <div className="h-9 w-16 bg-slate-700 animate-pulse rounded" />
                  </div>
                </div>
              </div>
            ) : (
              resource && (
                <motion.div
                  className="flex justify-between items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.15 }}
                >
                  {/* Edit Button - Left */}
                  <div>
                    {currentUser && (currentUser.id === resource.creator_id || currentUser.id === resource.created_by_id) && (
                      <Link to={createPageUrl(`ShareKnowledge?id=${resource.id}`)}>
                        <Button variant="outline" className="btn-secondary-coherosphere">
                          <ConfiguredIcon
                            iconName="Edit"
                            iconConfig={iconConfigs['Edit']}
                            size="w-4 h-4"
                            className="mr-2"
                          />
                          Edit
                        </Button>
                      </Link>
                    )}
                  </div>

                  {/* Voting - Right */}
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">Was this helpful?</span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleVote('up')}
                        variant="outline"
                        size="sm"
                        className={`gap-2 ${vote === 'up' ? 'bg-green-500/20 border-green-500/40 text-white' : 'btn-secondary-coherosphere'}`}
                      >
                        <ConfiguredIcon
                          iconName="ThumbsUp"
                          iconConfig={iconConfigs['ThumbsUp']}
                          size="w-4 h-4"
                        />
                        {resource.upvotes || 0}
                      </Button>
                      <Button
                        onClick={() => handleVote('down')}
                        variant="outline"
                        size="sm"
                        className={`gap-2 ${vote === 'down' ? 'bg-red-500/20 border-red-500/40 text-white' : 'btn-secondary-coherosphere'}`}
                      >
                        <ConfiguredIcon
                          iconName="ThumbsDown"
                          iconConfig={iconConfigs['ThumbsDown']}
                          size="w-4 h-4"
                        />
                        {resource.downvotes || 0}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )
            )}
          </div>

          {/* Right Column: Related Resources Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8">
              {!sectionsReady.relatedResources ? (
                <Card className="bg-slate-800/30 border-slate-700">
                  <CardHeader>
                    <div className="h-5 bg-slate-700 animate-pulse rounded w-40" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-700/30 border border-slate-700">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-slate-600 animate-pulse rounded-lg flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-4 bg-slate-600 animate-pulse rounded w-full mb-2" />
                            <div className="h-3 bg-slate-600 animate-pulse rounded w-3/4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                >
                  <Card className="bg-slate-800/30 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                        <ConfiguredIcon
                          iconName="BookOpen"
                          iconConfig={iconConfigs['BookOpen']}
                          size="w-5 h-5"
                        />
                        Related Resources
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {relatedResources.length > 0 ? (
                        relatedResources.map((related, index) => {
                          const relatedCategoryKey = related.category?.replace(/ & /g, '').replace(/ /g, '');
                          const relatedStyles = getCategoryStyles(relatedCategoryKey);

                          return (
                            <motion.div
                              key={related.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15, delay: index * 0.05 }}
                            >
                              <Link
                                to={createPageUrl(`ResourceDetail?id=${related.id}`)}
                                className="block group"
                              >
                                <div className="p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-200 border border-transparent hover:border-orange-500/30">
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center border"
                                      style={{
                                        backgroundColor: relatedStyles.bgColor,
                                        borderColor: relatedStyles.borderColor
                                      }}
                                    >
                                      <ConfiguredIcon
                                        iconName={related.icon_name}
                                        iconConfig={iconConfigs[related.icon_name]}
                                        size="w-4 h-4"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                                        {related.title}
                                      </h4>
                                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                        {related.description}
                                      </p>
                                    </div>
                                    <ConfiguredIcon
                                      iconName="ArrowUpRight"
                                      iconConfig={iconConfigs['ArrowUpRight']}
                                      size="w-4 h-4"
                                      className="transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 flex-shrink-0"
                                    />
                                  </div>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">
                          No related resources found in this category.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </aside>
        </div>
      </motion.div>

      {/* Add custom CSS for ReactQuill */}
      <style jsx>{`
        .ql-editor {
          color: white !important;
          background-color: transparent !important;
          padding: 0 !important;
          font-size: 1.125rem !important;
          line-height: 1.75 !important;
        }

        .ql-editor p {
          color: rgb(203, 213, 225) !important;
          margin-bottom: 1.25em !important;
          line-height: 1.75 !important;
        }

        .ql-editor p:last-child {
          margin-bottom: 0 !important;
        }

        .ql-editor h1,
        .ql-editor h2,
        .ql-editor h3,
        .ql-editor h4,
        .ql-editor h5,
        .ql-editor h6 {
          color: white !important;
          font-family: 'Poppins', system-ui, sans-serif !important;
          font-weight: 700 !important;
          margin-top: 2em !important;
          margin-bottom: 0.75em !important;
          line-height: 1.3 !important;
        }

        .ql-editor > h1:first-child,
        .ql-editor > h2:first-child,
        .ql-editor > h3:first-child,
        .ql-editor > h4:first-child,
        .ql-editor > h5:first-child,
        .ql-editor > h6:first-child {
          margin-top: 0 !important;
        }

        .ql-editor h1 {
          font-size: 2.25rem !important;
          line-height: 1.2 !important;
          margin-top: 2.5em !important;
        }

        .ql-editor h2 {
          font-size: 1.875rem !important;
          line-height: 1.25 !important;
          margin-top: 2.25em !important;
        }

        .ql-editor h3 {
          font-size: 1.5rem !important;
          line-height: 1.3 !important;
          margin-top: 2em !important;
        }

        .ql-editor h4 {
          font-size: 1.25rem !important;
          line-height: 1.4 !important;
          margin-top: 1.75em !important;
        }

        .ql-editor h5 {
          font-size: 1.125rem !important;
          line-height: 1.5 !important;
          margin-top: 1.5em !important;
        }

        .ql-editor h6 {
          font-size: 1rem !important;
          line-height: 1.5 !important;
          margin-top: 1.5em !important;
          color: rgb(203, 213, 225) !important;
        }

        .ql-editor strong,
        .ql-editor em,
        .ql-editor u {
          color: white !important;
        }

        .ql-editor strong {
          font-weight: 600 !important;
        }

        .ql-editor ol,
        .ql-editor ul {
          color: rgb(203, 213, 225) !important;
          margin-top: 1.25em !important;
          margin-bottom: 1.25em !important;
          padding-left: 1.5em !important;
        }

        .ql-editor li {
          color: rgb(203, 213, 225) !important;
          margin-bottom: 0.5em !important;
          line-height: 1.75 !important;
        }

        .ql-editor li:last-child {
          margin-bottom: 0 !important;
        }

        .ql-editor ol ol,
        .ql-editor ul ul,
        .ql-editor ol ul,
        .ql-editor ul ol {
          margin-top: 0.5em !important;
          margin-bottom: 0.5em !important;
        }

        .ql-editor a {
          color: #3DDAD7 !important;
          text-decoration: none !important;
          border-bottom: 1px solid rgba(61, 218, 215, 0.3) !important;
          transition: all 0.2s ease !important;
        }

        .ql-editor a:hover {
          color: #FF6A00 !important;
          border-bottom-color: rgba(255, 106, 0, 0.5) !important;
        }

        .ql-editor blockquote {
          border-left: 4px solid #FF6A00 !important;
          padding-left: 1.5em !important;
          margin: 1.5em 0 !important;
          color: rgb(203, 213, 225) !important;
          font-style: italic !important;
        }

        .ql-editor pre,
        .ql-editor code {
          background-color: rgba(0, 0, 0, 0.3) !important;
          border-radius: 0.375rem !important;
          padding: 0.125em 0.375em !important;
          color: #3DDAD7 !important;
          font-family: 'Monaco', 'Courier New', monospace !important;
        }

        .ql-editor pre {
          padding: 1em !important;
          margin: 1.5em 0 !important;
          overflow-x: auto !important;
        }

        .ql-editor hr {
          border: none !important;
          border-top: 2px solid rgb(71, 85, 105) !important;
          margin: 2em 0 !important;
        }
      `}</style>
    </div>
  );
}
