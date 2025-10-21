
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { faq as Faq } from '@/api/entities';
import { useLocation, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { motion } from 'framer-motion';

import FAQItem from '@/components/faq/FAQItem';
import FAQSearch from '@/components/faq/FAQSearch';
import StatCard from '@/components/StatCard';
import { useCachedData } from '@/components/caching/useCachedData';
import { useLoading } from '@/components/loading/LoadingContext';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { Card, CardContent } from '@/components/ui/card';

const categoryIcons = {
  'Introduction': 'HelpCircle',
  'Key Concepts': 'Search',
  'Participation & Governance': 'Handshake',
};

export default function FAQPage() {
  const [activeSlug, setActiveSlug] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const itemRefs = useRef({});
  const { setLoading } = useLoading();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States - sections load in parallel
  const [sectionsReady, setSectionsReady] = useState({
    stats: false,
    search: false,
    faqAccordion: false
  });

  // Use cached data for FAQs
  const { data: faqs = [], isLoading } = useCachedData(
    ['faq', 'published', 'en'],
    async () => {
      const publishedFaqs = await Faq.filter({ status: 'published', locale: 'en' });
      return publishedFaqs.sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return a.position - b.position;
      });
    },
    'faq'
  );

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Handle deep-linking on initial load
  useEffect(() => {
    if (faqs.length === 0) return;
    
    const hash = location.hash.replace('#', '');
    if (hash && faqs.some(f => f.slug === hash)) {
      setActiveSlug(hash);
      setTimeout(() => {
        itemRefs.current[hash]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [location.hash, faqs]);

  const handleToggle = async (slug) => {
    const newSlug = activeSlug === slug ? null : slug;
    setActiveSlug(newSlug);

    // Track view when opening (not when closing)
    if (newSlug && newSlug !== activeSlug) {
      try {
        const faq = faqs.find(f => f.slug === slug);
        if (faq) {
          const currentViews = faq.views || 0;
          // Update view count in database
          await Faq.update(faq.id, {
            views: currentViews + 1
          });
          
          // Note: We don't update local state here as React Query will handle
          // refetching on the next interval based on caching policy
        }
      } catch (error) {
        console.error('Error tracking FAQ view:', error);
        // Don't block UI if tracking fails
      }
    }
  };

  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchTerm(value), 200),
    []
  );

  const allTags = useMemo(() => {
    const tags = new Set();
    faqs.forEach(faq => faq.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    let result = faqs;
    if (activeTag) {
      result = result.filter(faq => faq.tags?.includes(activeTag));
    }
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(faq =>
        faq.question.toLowerCase().includes(lowercasedTerm) ||
        faq.answer.toLowerCase().includes(lowercasedTerm) ||
        faq.tags?.some(tag => tag.toLowerCase().includes(lowercasedTerm))
      );
    }
    return result;
  }, [faqs, searchTerm, activeTag]);

  const groupedFaqs = useMemo(() => {
    return filteredFaqs.reduce((acc, faq) => {
      (acc[faq.category] = acc[faq.category] || []).push(faq);
      return acc;
    }, {});
  }, [filteredFaqs]);

  const handleTagClick = (tag) => {
    setActiveTag(prev => (prev === tag ? null : tag));
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentlyUpdated = faqs.filter(faq => {
      if (!faq.updated_date) return false;
      const updatedDate = new Date(faq.updated_date);
      return !isNaN(updatedDate.getTime()) && updatedDate >= thirtyDaysAgo;
    }).length;

    // Calculate total views across all FAQs
    const totalViews = faqs.reduce((sum, faq) => sum + (faq.views || 0), 0);

    return {
      totalQuestions: faqs.length,
      recentlyUpdated,
      mostViewed: totalViews
    };
  }, [faqs]);

  // Track when each section's data is ready (parallel loading)
  useEffect(() => {
    // Stats ready when FAQs loaded
    if (!isLoading) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [isLoading]);

  useEffect(() => {
    // Search ready when FAQs loaded
    if (!isLoading) {
      setSectionsReady(prev => ({ ...prev, search: true }));
    }
  }, [isLoading]);

  useEffect(() => {
    // FAQ accordion ready when FAQs loaded
    if (!isLoading) {
      setSectionsReady(prev => ({ ...prev, faqAccordion: true }));
    }
  }, [isLoading]);

  // Skeleton Components
  const StatCardSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        <div className="flex items-center justify-center mb-1.5">
          <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
        </div>
        <div className="h-6 w-12 mx-auto bg-slate-700/30 animate-pulse rounded mb-0.5" />
        <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" />
      </CardContent>
    </Card>
  );

  const SearchSkeleton = () => (
    <div className="space-y-4">
      <div className="h-11 bg-slate-700/30 animate-pulse rounded-lg" />
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-slate-700/30 animate-pulse rounded-full" />
        ))}
      </div>
    </div>
  );

  const FAQAccordionSkeleton = () => (
    <div className="space-y-6">
      {[...Array(3)].map((_, catIndex) => (
        <div key={catIndex} className="space-y-2">
          <div className="h-6 w-48 bg-slate-700 animate-pulse rounded mb-4" />
          {[...Array(3)].map((_, itemIndex) => (
            <div key={itemIndex} className="border-b border-slate-700">
              <div className="px-6 py-4">
                <div className="h-5 w-3/4 bg-slate-700/30 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header - ALWAYS VISIBLE immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon 
            iconName="HelpCircle" 
            iconConfig={iconConfigs['HelpCircle']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Frequently Asked Questions
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Everything you need to know about coherosphere.
        </p>
      </div>

      {/* Stats Bar - Progressive Loading */}
      {sectionsReady.stats ? (
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 }}
        >
          <StatCard
            iconName="HelpCircle"
            iconConfig={iconConfigs['HelpCircle']}
            value={stats.totalQuestions}
            label="Total Questions"
            isLoading={false}
          />
          <StatCard
            iconName="RefreshCw"
            iconConfig={iconConfigs['RefreshCw']}
            value={stats.recentlyUpdated}
            label="Recently Updated"
            isLoading={false}
          />
          <StatCard
            iconName="Eye"
            iconConfig={iconConfigs['Eye']}
            value={stats.mostViewed}
            label="Total Views"
            isLoading={false}
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      )}

      {/* Two-column layout: Search left (1/3), FAQ right (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search and Filters (1/3) - Progressive Loading */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {sectionsReady.search ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                <FAQSearch 
                  searchTerm={searchTerm} 
                  onSearchChange={debouncedSearch} 
                  tags={allTags}
                  activeTag={activeTag}
                  onTagChange={handleTagClick}
                  iconConfigs={iconConfigs}
                />
              </motion.div>
            ) : (
              <SearchSkeleton />
            )}
          </div>
        </div>

        {/* Right Column: FAQ Accordion (2/3) - Progressive Loading */}
        <div className="lg:col-span-2">
          {sectionsReady.faqAccordion ? (
            <>
              {Object.keys(groupedFaqs).length === 0 ? (
                <motion.div
                  className="text-center py-16"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <p className="text-slate-400">No questions found matching your criteria.</p>
                </motion.div>
              ) : (
                Object.entries(groupedFaqs).map(([category, items], categoryIndex) => {
                  const iconName = categoryIcons[category] || 'HelpCircle';
                  return (
                    <motion.section
                      key={category}
                      className="mb-10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 + categoryIndex * 0.05 }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <ConfiguredIcon 
                          iconName={iconName}
                          iconConfig={iconConfigs[iconName]}
                          size="w-6 h-6"
                        />
                        <h2 className="text-xl font-bold text-slate-300">{category}</h2>
                      </div>
                      <div>
                        {items.map(faq => (
                          <div ref={el => itemRefs.current[faq.slug] = el} key={faq.id}>
                            <FAQItem
                              faq={faq}
                              isActive={activeSlug === faq.slug}
                              onToggle={() => handleToggle(faq.slug)}
                              onLinkClick={() => setActiveSlug(null)}
                              iconConfigs={iconConfigs}
                            />
                          </div>
                        ))}
                      </div>
                    </motion.section>
                  );
                })
              )}
            </>
          ) : (
            <FAQAccordionSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
