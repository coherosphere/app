
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { iconMap } from '@/components/config/iconMap';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 18;

export default function IconAdmin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [icons, setIcons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [editingIcon, setEditingIcon] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkColorModalOpen, setIsBulkColorModalOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [isSyncingIconMap, setIsSyncingIconMap] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkColorValue, setBulkColorValue] = useState('text-white');
  const [isApplyingBulkColor, setIsApplyingBulkColor] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, chunk: 0, totalChunks: 0 });

  const queryClient = useQueryClient();
  const { iconConfigs } = useAllIconConfigs();

  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    controls: false,
    filters: false,
    iconGrid: false,
    pagination: false
  });

  const [formData, setFormData] = useState({
    icon_name: '',
    display_name: '',
    description: '',
    context_keywords: [],
    associated_themes: [],
    usage_examples: [],
    color_hint: 'text-slate-400',
    is_active: true
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

      const iconsData = await base44.entities.IconConfiguration.list('-updated_date');
      setIcons(iconsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load icons' });
    } finally {
      setIsLoading(false);
    }
  };

  // Track when sections are ready (parallel loading)
  useEffect(() => {
    // Controls ready when data loaded and sync result available (or null)
    if (!isLoading && icons.length >= 0) {
      setSectionsReady(prev => ({ ...prev, controls: true }));
    }
  }, [isLoading, icons]);

  useEffect(() => {
    // Filters ready when icons loaded
    if (!isLoading && icons.length >= 0) {
      setSectionsReady(prev => ({ ...prev, filters: true }));
    }
  }, [isLoading, icons]);

  useEffect(() => {
    // Icon grid ready when icons loaded
    if (!isLoading && icons.length >= 0) {
      setSectionsReady(prev => ({ ...prev, iconGrid: true }));
    }
  }, [isLoading, icons]);

  useEffect(() => {
    // Pagination ready when icons loaded
    if (!isLoading && icons.length >= 0) {
      setSectionsReady(prev => ({ ...prev, pagination: true }));
    }
  }, [isLoading, icons]);

  const handleSyncIconMap = async () => {
    setIsSyncingIconMap(true);
    setSyncResult(null);
    setMessage(null);
    try {
      const response = await base44.functions.invoke('syncIconMap');
      setSyncResult(response.data);
      setMessage({ type: 'success', text: response.data.message });
      await loadData();
    } catch (error) {
      console.error('Error syncing iconMap:', error);
      setSyncResult(null);
      setMessage({ type: 'error', text: 'Failed to sync iconMap.js' + (error.response?.data?.message ? `: ${error.response.data.message}` : '') });
    } finally {
      setIsSyncingIconMap(false);
    }
  };

  const handleBulkColorChange = () => {
    setIsBulkColorModalOpen(true);
  };

  const handleApplyBulkColor = async () => {
    setIsApplyingBulkColor(true);
    setMessage(null);
    setUpdateProgress({ current: 0, total: 0, chunk: 0, totalChunks: 0 });
    
    try {
      console.log('[IconAdmin] Starting chunked bulk color update...');
      
      const allIcons = await base44.entities.IconConfiguration.list('-created_date', 5000);
      console.log(`[IconAdmin] Loaded ${allIcons.length} icons`);
      
      if (allIcons.length === 0) {
        setMessage({ type: 'error', text: 'No icons found to update' });
        setIsApplyingBulkColor(false);
        return;
      }

      const CHUNK_SIZE = 20;
      const chunks = [];
      for (let i = 0; i < allIcons.length; i += CHUNK_SIZE) {
        chunks.push(allIcons.slice(i, i + CHUNK_SIZE));
      }
      
      console.log(`[IconAdmin] Split into ${chunks.length} chunks of ${CHUNK_SIZE} icons each`);
      setUpdateProgress({ current: 0, total: allIcons.length, chunk: 0, totalChunks: chunks.length });
      
      let totalUpdated = 0;
      let totalErrors = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNumber = i + 1;
        
        console.log(`[IconAdmin] Processing chunk ${chunkNumber}/${chunks.length} (${chunk.length} icons)...`);
        setUpdateProgress(prev => ({ ...prev, current: totalUpdated, chunk: chunkNumber }));
        
        try {
          const response = await base44.functions.invoke('bulkUpdateIconColorsChunk', {
            color_hint: bulkColorValue,
            icons: chunk.map(icon => ({
              id: icon.id,
              icon_name: icon.icon_name,
              display_name: icon.display_name,
              description: icon.description || '',
              context_keywords: icon.context_keywords || [],
              associated_themes: icon.associated_themes || [],
              usage_examples: icon.usage_examples || [],
              is_active: icon.is_active !== false
            }))
          });
          
          if (response.data.success) {
            totalUpdated += response.data.updated;
            totalErrors += response.data.errors;
            console.log(`[IconAdmin] Chunk ${chunkNumber} complete: ${response.data.updated} updated, ${response.data.errors} errors`);
          } else {
            console.error(`[IconAdmin] Chunk ${chunkNumber} failed:`, response.data.message);
            totalErrors += chunk.length;
          }
          
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          console.error(`[IconAdmin] Error in chunk ${chunkNumber}:`, error);
          totalErrors += chunk.length;
        }
      }
      
      if (totalErrors === 0) {
        setMessage({
          type: 'success',
          text: `✅ Successfully updated all ${totalUpdated} icons to ${bulkColorValue}`
        });
        
        setIsBulkColorModalOpen(false);
        
        console.log('[IconAdmin] Clearing all icon caches...');
        queryClient.removeQueries({ queryKey: ['icons'] });
        
        Object.keys(localStorage).forEach(key => {
          if (key.includes('icon') || key.includes('coherosphere')) {
            localStorage.removeItem(key);
          }
        });
        
        setTimeout(() => {
          console.log('[IconAdmin] Reloading page...');
          window.location.reload(true);
        }, 1000);
      } else {
        setMessage({
          type: 'error',
          text: `⚠️ Partially complete: ${totalUpdated} updated, ${totalErrors} failed. Try again for remaining icons.`
        });
      }
      
    } catch (error) {
      console.error('[IconAdmin] Error applying bulk color:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed: ${error.message}` 
      });
    } finally {
      setIsApplyingBulkColor(false);
      setUpdateProgress({ current: 0, total: 0, chunk: 0, totalChunks: 0 });
    }
  };

  const handleEdit = (icon) => {
    setEditingIcon(icon);
    setFormData({
      icon_name: icon.icon_name,
      display_name: icon.display_name,
      description: icon.description || '',
      context_keywords: icon.context_keywords || [],
      associated_themes: icon.associated_themes || [],
      usage_examples: icon.usage_examples || [],
      color_hint: icon.color_hint || 'text-slate-400',
      is_active: icon.is_active !== false
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setEditingIcon(null);
    setFormData({
      icon_name: '',
      display_name: '',
      description: '',
      context_keywords: [],
      associated_themes: [],
      usage_examples: [],
      color_hint: 'text-slate-400',
      is_active: true
    });
    setIsCreateModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.icon_name || !formData.display_name) {
      setMessage({ type: 'error', text: 'Icon name and display name are required' });
      return;
    }

    if (!iconMap[formData.icon_name]) {
      setMessage({ type: 'error', text: `Icon "${formData.icon_name}" not found in the app's icon map. Please ask a developer to add it.` });
      return;
    }

    try {
      if (editingIcon) {
        await base44.entities.IconConfiguration.update(editingIcon.id, formData);
        setMessage({ type: 'success', text: 'Icon updated successfully' });
      } else {
        await base44.entities.IconConfiguration.create(formData);
        setMessage({ type: 'success', text: 'Icon created successfully' });
      }
      setIsEditModalOpen(false);
      setIsCreateModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error saving icon:', error);
      setMessage({ type: 'error', text: 'Failed to save icon' });
    }
  };

  const handleToggleActive = async (icon) => {
    try {
      await base44.entities.IconConfiguration.update(icon.id, {
        ...icon,
        is_active: !icon.is_active
      });
      await loadData();
      setMessage({ type: 'success', text: `Icon ${icon.is_active ? 'deactivated' : 'activated'}` });
    } catch (error) {
      console.error('Error toggling icon:', error);
      setMessage({ type: 'error', text: 'Failed to update icon' });
    }
  };

  const filteredIcons = icons.filter(icon => {
    const matchesSearch =
      icon.icon_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      icon.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (icon.description && icon.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (icon.context_keywords || []).some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && icon.is_active !== false) ||
      (filterActive === 'inactive' && icon.is_active === false);

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredIcons.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedIcons = filteredIcons.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterActive]);

  const renderIcon = (iconName, className = '') => {
    const IconComponent = iconMap[iconName];
    if (!IconComponent) {
      return <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-400">?</div>;
    }
    return <IconComponent className={className} />;
  };

  const handleArrayInput = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    setFormData(prev => ({ ...prev, [field]: array }));
  };

  // Skeleton Components
  const ControlsSkeleton = () => (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        <div className="h-10 w-32 bg-slate-700/30 animate-pulse rounded" />
        <div className="h-10 w-40 bg-slate-700/30 animate-pulse rounded" />
        <div className="h-10 w-44 bg-slate-700/30 animate-pulse rounded" />
      </div>
    </div>
  );

  const FiltersSkeleton = () => (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
      <div className="flex flex-wrap gap-2">
        <div className="h-10 w-24 bg-slate-700/30 animate-pulse rounded-full" />
        <div className="h-10 w-28 bg-slate-700/30 animate-pulse rounded-full" />
        <div className="h-10 w-32 bg-slate-700/30 animate-pulse rounded-full" />
      </div>
      <div className="relative w-full md:w-64">
        <div className="h-10 w-full bg-slate-700/30 animate-pulse rounded" />
      </div>
    </div>
  );

  const IconGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="w-16 h-16 bg-slate-700/30 animate-pulse rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-slate-700/30 animate-pulse rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-700/30 animate-pulse rounded" />
                </div>
              </div>
              <div className="h-12 bg-slate-700/30 animate-pulse rounded" />
              <div className="flex flex-wrap gap-1">
                <div className="h-6 w-16 bg-slate-700/30 animate-pulse rounded" />
                <div className="h-6 w-20 bg-slate-700/30 animate-pulse rounded" />
                <div className="h-6 w-14 bg-slate-700/30 animate-pulse rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-20 bg-slate-700/30 animate-pulse rounded" />
                <div className="h-9 w-20 bg-slate-700/30 animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const PaginationSkeleton = () => (
    <div className="flex justify-center items-center gap-2 mt-8">
      <div className="h-10 w-10 bg-slate-700/30 animate-pulse rounded" />
      <div className="h-10 w-10 bg-slate-700/30 animate-pulse rounded" />
      <div className="h-10 w-10 bg-slate-700/30 animate-pulse rounded" />
      <div className="h-10 w-10 bg-slate-700/30 animate-pulse rounded" />
      <div className="h-5 w-48 bg-slate-700/30 animate-pulse rounded ml-4" />
    </div>
  );

  // Access denied check - show immediately without loading spinner
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
      {/* Header - ALWAYS VISIBLE immediately */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon
            iconName="Palette"
            iconConfig={iconConfigs['Palette']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-orange-500"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Icon Configuration
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Manage icon mappings, themes, and metadata for consistent design across the platform.
        </p>
      </motion.div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Controls - Progressive Loading */}
      {sectionsReady.controls ? (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0 }}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              <ConfiguredIcon
                iconName="Plus"
                iconConfig={iconConfigs['Plus']}
                size="w-4 h-4"
                className="mr-2"
                fallbackColor="currentColor"
              />
              Add Icon
            </Button>

            <Button
              onClick={handleSyncIconMap}
              disabled={isSyncingIconMap}
              variant="outline"
              className="btn-secondary-coherosphere"
            >
              {isSyncingIconMap ? (
                <>
                  <ConfiguredIcon
                    iconName="RefreshCw"
                    iconConfig={iconConfigs['RefreshCw']}
                    size="w-4 h-4"
                    className="mr-2 animate-spin"
                    fallbackColor="currentColor"
                  />
                  Syncing iconMap.js...
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
                  Sync iconMap.js
                </>
              )}
            </Button>

            <Button
              onClick={handleBulkColorChange}
              variant="outline"
              className="btn-secondary-coherosphere"
            >
              <ConfiguredIcon
                iconName="Palette"
                iconConfig={iconConfigs['Palette']}
                size="w-4 h-4"
                className="mr-2"
                fallbackColor="currentColor"
              />
              Bulk Color Change
            </Button>
          </div>

          {/* Sync Result Display */}
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <ConfiguredIcon
                  iconName="CheckCircle"
                  iconConfig={iconConfigs['CheckCircle']}
                  size="w-5 h-5"
                  className="mt-0.5 flex-shrink-0"
                  fallbackColor="text-green-400"
                />
                <div className="flex-1">
                  <p className="text-green-400 font-semibold mb-2">{syncResult.message}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-green-500/10 rounded px-3 py-2">
                      <div className="text-green-300 font-semibold">{syncResult.added}</div>
                      <div className="text-green-400/70">Added</div>
                    </div>
                    <div className="bg-slate-700/30 rounded px-3 py-2">
                      <div className="text-slate-300 font-semibold">{syncResult.skipped}</div>
                      <div className="text-slate-400">Skipped</div>
                    </div>
                    <div className="bg-slate-700/30 rounded px-3 py-2">
                      <div className="text-slate-300 font-semibold">{syncResult.total}</div>
                      <div className="text-slate-400">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <ControlsSkeleton />
      )}

      {/* Filters - Progressive Loading */}
      {sectionsReady.filters ? (
        <motion.div
          className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setFilterActive('all')}
              variant="ghost"
              className={`filter-chip h-auto ${filterActive === 'all' ? 'active' : ''}`}
            >
              All
              <Badge className={`ml-2 ${filterActive === 'all' ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {icons.length}
              </Badge>
            </Button>
            <Button
              onClick={() => setFilterActive('active')}
              variant="ghost"
              className={`filter-chip h-auto ${filterActive === 'active' ? 'active' : ''}`}
            >
              Active
              <Badge className={`ml-2 ${filterActive === 'active' ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {icons.filter(i => i.is_active !== false).length}
              </Badge>
            </Button>
            <Button
              onClick={() => setFilterActive('inactive')}
              variant="ghost"
              className={`filter-chip h-auto ${filterActive === 'inactive' ? 'active' : ''}`}
            >
              Inactive
              <Badge className={`ml-2 ${filterActive === 'inactive' ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {icons.filter(i => i.is_active === false).length}
              </Badge>
            </Button>
          </div>

          <div className="relative w-full md:w-64">
            <ConfiguredIcon
              iconName="Search"
              iconConfig={iconConfigs['Search']}
              size="w-4 h-4"
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              fallbackColor="text-slate-400"
            />
            <Input
              type="text"
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </motion.div>
      ) : (
        <FiltersSkeleton />
      )}

      {/* Icon Grid - Progressive Loading */}
      {sectionsReady.iconGrid ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          {paginatedIcons.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-400">No icons found matching your criteria.</p>
            </div>
          ) : (
            paginatedIcons.map((icon) => (
              <Card key={icon.id} className={`bg-slate-800/40 backdrop-blur-sm border-slate-700 ${icon.is_active === false ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-900/50 border border-slate-700`}>
                        {renderIcon(icon.icon_name, `w-8 h-8 ${icon.color_hint || 'text-slate-400'}`)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-white font-semibold">{icon.display_name}</h3>
                            <code className="text-xs text-slate-400 font-mono">{icon.icon_name}</code>
                          </div>
                          {icon.is_active === false && (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {icon.description && (
                      <p className="text-slate-400 text-sm mb-0 line-clamp-2">
                        {icon.description}
                      </p>
                    )}

                    {icon.context_keywords && icon.context_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-0">
                        {icon.context_keywords.slice(0, 3).map((kw, i) => (
                          <Badge key={i} className="bg-slate-700/50 text-slate-300 text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {icon.context_keywords.length > 3 && (
                          <Badge className="bg-slate-700/50 text-slate-300 text-xs">
                            +{icon.context_keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-auto pt-2">
                      <Button
                        onClick={() => handleEdit(icon)}
                        variant="outline"
                        size="sm"
                        className="btn-secondary-coherosphere"
                      >
                        <ConfiguredIcon
                          iconName="Edit2"
                          iconConfig={iconConfigs['Edit2']}
                          size="w-3 h-3"
                          className="mr-1"
                          fallbackColor="currentColor"
                        />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleToggleActive(icon)}
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white"
                      >
                        {icon.is_active !== false ? (
                          <>
                            <ConfiguredIcon
                              iconName="EyeOff"
                              iconConfig={iconConfigs['EyeOff']}
                              size="w-3 h-3"
                              className="mr-1"
                              fallbackColor="currentColor"
                            />
                            Hide
                          </>
                        ) : (
                          <>
                            <ConfiguredIcon
                              iconName="Eye"
                              iconConfig={iconConfigs['Eye']}
                              size="w-3 h-3"
                              className="mr-1"
                              fallbackColor="currentColor"
                            />
                            Show
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      ) : (
        <IconGridSkeleton />
      )}

      {/* Pagination - Progressive Loading */}
      {sectionsReady.pagination && totalPages > 1 ? (
        <motion.div
          className="flex justify-center items-center gap-2 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.15 }}
        >
          <Button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            variant="outline"
            className="btn-secondary-coherosphere"
          >
            <ConfiguredIcon
              iconName="ChevronLeft"
              iconConfig={iconConfigs['ChevronLeft']}
              size="w-4 h-4"
              fallbackColor="currentColor"
            />
          </Button>

          {[...Array(totalPages)].map((_, index) => {
            const pageNumber = index + 1;
            if (
              pageNumber === 1 ||
              pageNumber === totalPages ||
              (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
            ) {
              return (
                <Button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  variant={currentPage === pageNumber ? 'default' : 'outline'}
                  className={currentPage === pageNumber ?
                    'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700' :
                    'btn-secondary-coherosphere'
                  }
                >
                  {pageNumber}
                </Button>
              );
            } else if (
              pageNumber === currentPage - 2 ||
              pageNumber === currentPage + 2
            ) {
              return <span key={pageNumber} className="text-slate-400">...</span>;
            }
            return null;
          })}

          <Button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
            className="btn-secondary-coherosphere"
          >
            <ConfiguredIcon
              iconName="ChevronRight"
              iconConfig={iconConfigs['ChevronRight']}
              size="w-4 h-4"
              fallbackColor="currentColor"
            />
          </Button>

          <span className="text-slate-400 ml-4">
            Page {currentPage} of {totalPages} ({filteredIcons.length} icons)
          </span>
        </motion.div>
      ) : !sectionsReady.pagination ? (
        <PaginationSkeleton />
      ) : null}

      {/* Bulk Color Change Modal */}
      <Dialog open={isBulkColorModalOpen} onOpenChange={setIsBulkColorModalOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Bulk Color Change</DialogTitle>
            <DialogDescription className="text-slate-400">
              Change the color_hint for all {icons.length} icons at once
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="text-white">New Color Hint (Tailwind class)</Label>
            <Input
              value={bulkColorValue}
              onChange={(e) => setBulkColorValue(e.target.value)}
              placeholder="e.g., text-orange-500, text-blue-400, text-white"
              className="bg-slate-900 border-slate-700 text-white mt-2"
              disabled={isApplyingBulkColor}
            />
            <p className="text-xs text-slate-500 mt-2">
              This will update the color_hint for all {icons.length} icons
            </p>

            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <Label className="text-white mb-2 block">Preview</Label>
              <div className="flex items-center gap-4">
                <ConfiguredIcon
                  iconName="Palette"
                  iconConfig={{...iconConfigs['Palette'], color_hint: bulkColorValue}}
                  size="w-8 h-8"
                  fallbackColor={bulkColorValue}
                />
                <ConfiguredIcon
                  iconName="Users"
                  iconConfig={{...iconConfigs['Users'], color_hint: bulkColorValue}}
                  size="w-8 h-8"
                  fallbackColor={bulkColorValue}
                />
                <ConfiguredIcon
                  iconName="Lightbulb"
                  iconConfig={{...iconConfigs['Lightbulb'], color_hint: bulkColorValue}}
                  size="w-8 h-8"
                  fallbackColor={bulkColorValue}
                />
              </div>
            </div>

            {isApplyingBulkColor && updateProgress.total > 0 && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <ConfiguredIcon
                    iconName="Loader2"
                    iconConfig={iconConfigs['Loader2']}
                    size="w-5 h-5"
                    className="animate-spin"
                    fallbackColor="text-blue-400"
                  />
                  <div className="text-blue-300 font-semibold">
                    Processing... ({Math.round((updateProgress.current / updateProgress.total) * 100)}%)
                  </div>
                </div>
                <div className="text-sm text-blue-200 space-y-1">
                  <div>Batch {updateProgress.chunk} of {updateProgress.totalChunks}</div>
                  <div>{updateProgress.current} / {updateProgress.total} icons updated</div>
                </div>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsBulkColorModalOpen(false)}
              variant="outline"
              className="btn-secondary-coherosphere"
              disabled={isApplyingBulkColor}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyBulkColor}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              disabled={isApplyingBulkColor}
            >
              {isApplyingBulkColor ? (
                <>
                  <ConfiguredIcon
                    iconName="Loader2"
                    iconConfig={iconConfigs['Loader2']}
                    size="w-4 h-4"
                    className="mr-2 animate-spin"
                    fallbackColor="currentColor"
                  />
                  Applying...
                </>
              ) : (
                <>
                  <ConfiguredIcon
                    iconName="CheckCircle"
                    iconConfig={iconConfigs['CheckCircle']}
                    size="w-4 h-4"
                    className="mr-2"
                    fallbackColor="currentColor"
                  />
                  Apply to All Icons
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={isEditModalOpen || isCreateModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditModalOpen(false);
          setIsCreateModalOpen(false);
          setMessage(null);
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingIcon ? 'Edit Icon' : 'Create New Icon'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingIcon ? 'Update the icon configuration' : 'Add a new icon to the configuration library'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Icon Name */}
            <div>
              <Label className="text-white">Icon Name (from iconMap.js)</Label>
              <Input
                value={formData.icon_name}
                onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                placeholder="e.g., Users, Shield, BrainCircuit"
                className="bg-slate-900 border-slate-700 text-white mt-1"
                disabled={!!editingIcon}
              />
              <p className="text-xs text-slate-500 mt-1">
                Must match an icon name available in the app's pre-configured `iconMap.js`.
              </p>
            </div>

            {/* Display Name */}
            <div>
              <Label className="text-white">Display Name</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Community Members"
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-white">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Short description of usage and meaning"
                className="bg-slate-900 border-slate-700 text-white mt-1"
                rows={3}
              />
            </div>

            {/* Context Keywords */}
            <div>
              <Label className="text-white">Context Keywords (comma-separated)</Label>
              <Input
                value={(formData.context_keywords || []).join(', ')}
                onChange={(e) => handleArrayInput('context_keywords', e.target.value)}
                placeholder="e.g., community, members, people"
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>

            {/* Associated Themes */}
            <div>
              <Label className="text-white">Associated Themes (comma-separated)</Label>
              <Input
                value={(formData.associated_themes || []).join(', ')}
                onChange={(e) => handleArrayInput('associated_themes', e.target.value)}
                placeholder="e.g., Community Building, Engagement"
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>

            {/* Usage Examples */}
            <div>
              <Label className="text-white">Usage Examples (comma-separated)</Label>
              <Input
                value={(formData.usage_examples || []).join(', ')}
                onChange={(e) => handleArrayInput('usage_examples', e.target.value)}
                placeholder="e.g., /pages/Learning, /components/MemberCard"
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>

            {/* Color Hint */}
            <div>
              <Label className="text-white">Color Hint (Tailwind class)</Label>
              <Input
                value={formData.color_hint}
                onChange={(e) => setFormData({ ...formData, color_hint: e.target.value })}
                placeholder="e.g., text-orange-500, text-blue-400"
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-white">Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Preview */}
            {formData.icon_name && (
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <Label className="text-white mb-2 block">Preview</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-slate-800 border border-slate-700">
                    {renderIcon(formData.icon_name, `w-8 h-8 ${formData.color_hint}`)}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{formData.display_name || 'Display Name'}</p>
                    <code className="text-xs text-slate-400 font-mono">{formData.icon_name}</code>
                  </div>
                </div>
              </div>
            )}
          </div>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg border ${
                message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {message.text}
            </motion.div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setIsEditModalOpen(false);
                setIsCreateModalOpen(false);
                setMessage(null);
              }}
              variant="outline"
              className="btn-secondary-coherosphere"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              <ConfiguredIcon
                iconName="CheckCircle"
                iconConfig={iconConfigs['CheckCircle']}
                size="w-4 h-4"
                className="mr-2"
                fallbackColor="currentColor"
              />
              {editingIcon ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
