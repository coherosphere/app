
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function PageAdmin() {
  const { iconConfigs } = useAllIconConfigs();
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    controls: false,
    stats: false,
    search: false,
    pagesList: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.role !== 'admin') {
        setMessage({ type: 'error', text: 'Access denied. Admin role required.' });
        setIsLoading(false);
        return;
      }

      const pageRecords = await base44.entities.PageInfo.list('-created_date', 1000);
      setPages(pageRecords);

    } catch (error) {
      console.error('[PageAdmin] Error loading pages:', error);
      setMessage({ type: 'error', text: `Failed to load pages: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Track when sections are ready
  useEffect(() => {
    if (!isLoading && pages.length >= 0) {
      setSectionsReady(prev => ({ ...prev, controls: true }));
    }
  }, [isLoading, pages]);

  useEffect(() => {
    if (!isLoading && pages.length >= 0) {
      setSectionsReady(prev => ({ ...prev, stats: true }));
    }
  }, [isLoading, pages]);

  useEffect(() => {
    if (!isLoading && pages.length >= 0) {
      setSectionsReady(prev => ({ ...prev, search: true }));
    }
  }, [isLoading, pages]);

  useEffect(() => {
    if (!isLoading && pages.length >= 0) {
      setSectionsReady(prev => ({ ...prev, pagesList: true }));
    }
  }, [isLoading, pages]);

  const handleRescan = async () => {
    setIsScanning(true);
    setMessage({ type: 'info', text: 'Scanning performance logs...' });
    
    try {
      const response = await base44.functions.invoke('scanAndSyncPages', {});
      
      console.log('[PageAdmin] Rescan response:', response.data);
      
      if (response.data.success) {
        if (response.data.message) {
          setMessage({
            type: 'info', 
            text: response.data.message
          });
        } else {
          setMessage({
            type: 'success', 
            text: `✅ Scan complete: ${response.data.added} added, ${response.data.updated} updated` 
          });
        }
        
        await loadData();
      } else {
        const errorDetails = response.data.stack ? `\n\nDetails:\n${response.data.stack}` : '';
        setMessage({
          type: 'error', 
          text: `Scan failed: ${response.data.message || response.data.error || 'Unknown error'}${errorDetails}` 
        });
      }
    } catch (error) {
      console.error('[PageAdmin] Rescan error:', error);
      setMessage({
        type: 'error', 
        text: `Rescan failed: ${error.response?.data?.message || error.message}. Check console for details.` 
      });
    } finally {
      setIsScanning(false);
    }
  };

  const filteredPages = pages
    .filter(page =>
      page.page_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.page_name.localeCompare(b.page_name));

  const foundPages = filteredPages.filter(p => p.scan_status === 'found');
  const notFoundPages = filteredPages.filter(p => p.scan_status === 'not_found');

  // Skeleton Components
  const ControlsSkeleton = () => (
    <div className="mb-8 space-y-4">
      <div className="h-10 w-full bg-slate-700/30 animate-pulse rounded" />
      <div className="h-10 w-48 bg-slate-700/30 animate-pulse rounded" />
      <div className="h-24 w-full bg-slate-700/30 animate-pulse rounded" />
    </div>
  );

  const StatCardSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
      <CardContent className="p-3 h-full flex flex-col justify-center text-center">
        <div className="flex justify-center mb-1.5">
          <div className="w-5 h-5 bg-slate-700/30 animate-pulse rounded" />
        </div>
        <div className="h-6 w-12 mx-auto bg-slate-700/30 animate-pulse rounded mb-0.5" />
        <div className="h-3 w-20 mx-auto bg-slate-700/30 animate-pulse rounded" />
      </CardContent>
    </Card>
  );

  const SearchSkeleton = () => (
    <div className="mb-6">
      <div className="relative">
        <div className="h-10 w-full bg-slate-700/30 animate-pulse rounded" />
      </div>
    </div>
  );

  const PagesListSkeleton = () => (
    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <div className="h-6 w-48 bg-slate-700/30 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg border bg-slate-900/50 border-slate-700"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <div className="h-6 w-32 bg-slate-700/30 animate-pulse rounded" />
                    <div className="h-5 w-20 bg-slate-700/30 animate-pulse rounded" />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="h-4 w-48 bg-slate-700/30 animate-pulse rounded" />
                    <div className="h-4 w-32 bg-slate-700/30 animate-pulse rounded" />
                  </div>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="h-10 w-32 bg-slate-700/30 animate-pulse rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Access denied check
  if (!isLoading && currentUser?.role !== 'admin') {
    return (
      <div className="p-8">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="p-8 text-center">
            <ConfiguredIcon
              iconName="Shield"
              iconConfig={iconConfigs['Shield']}
              size="w-16 h-16"
              className="mx-auto mb-4"
              fallbackColor="text-slate-500"
            />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">This area is restricted to administrators only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon
            iconName="Layers"
            iconConfig={iconConfigs['Layers']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-orange-500"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              Page Overview
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Overview of all pages in the application. Automatically synced from performance tracking logs.
        </p>
      </div>

      {/* Stats - Progressive Loading */}
      {sectionsReady.stats ? (
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {[
            { icon: 'FileText', value: pages.length, label: 'Total Pages', delay: 0, fallbackColor: 'text-slate-400' },
            { icon: 'CheckCircle', value: foundPages.length, label: 'Recently Active', delay: 0.05, fallbackColor: 'text-green-400' },
            { icon: 'Database', value: `${(pages.reduce((sum, p) => sum + (p.size_bytes || 0), 0) / 1024).toFixed(0)} KB`, label: 'Total Size', delay: 0.1, fallbackColor: 'text-slate-400' }
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: stat.delay }}
            >
              <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700 h-[98px] overflow-hidden">
                <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                  <div className="flex justify-center mb-1.5">
                    <ConfiguredIcon 
                      iconName={stat.icon}
                      iconConfig={iconConfigs[stat.icon]}
                      size="w-5 h-5"
                      fallbackColor={stat.fallbackColor}
                    />
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5">
                    <motion.div
                      key={stat.value}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {stat.value}
                    </motion.div>
                  </div>
                  <div className="text-slate-400 text-xs">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Controls - Progressive Loading */}
      {sectionsReady.controls ? (
        <motion.div
          className="mb-8 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          {/* Status Message */}
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ConfiguredIcon
                  iconName="CheckCircle"
                  iconConfig={iconConfigs['CheckCircle']}
                  size="w-5 h-5"
                  className="flex-shrink-0"
                  fallbackColor="text-green-400"
                />
                <span className="text-green-200 font-medium">
                  {pages.length} pages registered ({foundPages.length} active in last 500 metrics)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Rescan Button */}
          <Button
            onClick={handleRescan}
            disabled={isScanning}
            variant="outline"
            className="btn-secondary-coherosphere"
          >
            {isScanning ? (
              <>
                <ConfiguredIcon
                  iconName="Loader2"
                  iconConfig={iconConfigs['Loader2']}
                  size="w-4 h-4"
                  className="mr-2 animate-spin"
                  fallbackColor="currentColor"
                />
                Scanning...
              </>
            ) : (
              <>
                <ConfiguredIcon
                  iconName="RefreshCw"
                  iconConfig={iconConfigs['RefreshCw']}
                  size="w-4 h-4"
                  className="mr-2"
                  fallbackColor="currentColor"
                />
                Scan for New Pages
              </>
            )}
          </Button>

          {/* Info Box */}
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ConfiguredIcon
                  iconName="Info"
                  iconConfig={iconConfigs['Info']}
                  size="w-5 h-5"
                  className="flex-shrink-0 mt-0.5"
                  fallbackColor="text-blue-400"
                />
                <div className="text-sm text-blue-200">
                  <strong>Pages are now permanent:</strong> Once a page is discovered from performance logs, it will remain in this list forever.
                  New pages are automatically added when they appear in the logs. Use "Scan for New Pages" to discover new pages.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <ControlsSkeleton />
      )}

      {/* Search - Progressive Loading */}
      {sectionsReady.search ? (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          <div className="relative">
            <ConfiguredIcon
              iconName="Search"
              iconConfig={iconConfigs['Search']}
              size="w-5 h-5"
              className="absolute left-4 top-1/2 transform -translate-y-1/2"
              fallbackColor="text-slate-400"
            />
            <Input
              type="text"
              placeholder="Search pages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 bg-slate-800/50 border-slate-700 text-white placeholder-slate-500"
            />
          </div>
        </motion.div>
      ) : (
        <SearchSkeleton />
      )}

      {/* Pages Table - Progressive Loading */}
      {sectionsReady.pagesList ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.15 }}
        >
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ConfiguredIcon
                  iconName="FileCode"
                  iconConfig={iconConfigs['FileCode']}
                  size="w-5 h-5"
                  fallbackColor="text-orange-400"
                />
                Application Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredPages.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No pages found matching "{searchTerm}"</p>
                ) : (
                  filteredPages.map((page, index) => (
                    <motion.div
                      key={page.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-lg border transition-all ${
                        page.scan_status === 'found'
                          ? 'bg-slate-900/50 border-slate-700 hover:border-orange-500/50'
                          : 'bg-slate-900/30 border-slate-700/50'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-white font-semibold text-lg">{page.page_name}</h3>
                            <Badge className={page.scan_status === 'found' ? 'bg-slate-700 text-slate-300' : 'bg-slate-700/50 text-slate-400'}>
                              {page.file_name}
                            </Badge>
                            {page.scan_status === 'found' && (
                              <Badge className="bg-green-700/30 text-green-200 text-xs">ACTIVE</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                            <span>Path: <span className="text-slate-300 font-mono">{page.file_path}</span></span>
                            <span>•</span>
                            <span>Size: <span className="text-slate-300">{((page.size_bytes || 0) / 1024).toFixed(1)} KB</span></span>
                            {page.last_scanned && (
                              <>
                                <span>•</span>
                                <span>Last Seen: <span className="text-slate-300">{new Date(page.last_scanned).toLocaleString()}</span></span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 items-center flex-wrap">
                          <Link to={createPageUrl(page.page_name)}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="btn-secondary-coherosphere"
                            >
                              <ConfiguredIcon
                                iconName="ExternalLink"
                                iconConfig={iconConfigs['ExternalLink']}
                                size="w-4 h-4"
                                className="mr-2"
                                fallbackColor="currentColor"
                              />
                              Open Page
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <PagesListSkeleton />
      )}
    </div>
  );
}
