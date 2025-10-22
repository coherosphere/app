
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
}
from "@/components/ui/dialog";
import StatCard from '@/components/StatCard';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// Removed: import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function StatsAdmin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingStat, setEditingStat] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [selectedPage, setSelectedPage] = useState('Dashboard'); // New: Page selector state

  const { iconConfigs } = useAllIconConfigs();

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // Load stat configurations
  const { data: allStats = [], isLoading: statsLoading, refetch } = useCachedData(
    ['stats', 'configurations'],
    () => base44.entities.StatConfiguration.list('-sort_order', 500),
    'perfStats'
  );

  // Load stat values
  const { data: allValues = [], isLoading: valuesLoading } = useCachedData(
    ['stats', 'values'],
    () => base44.entities.StatValue.list('-timestamp', 500),
    'perfStats'
  );

  // Load all pages from PageInfo
  const { data: allPages = [], isLoading: pagesLoading } = useCachedData(
    ['stats', 'pages'],
    () => base44.entities.PageInfo.list('-created_date', 500),
    'perfStats'
  );

  // Load AppConfig for display order
  const { data: appConfigList = [], isLoading: configLoading, refetch: refetchConfig } = useCachedData(
    ['stats', 'appConfig'],
    () => base44.entities.AppConfig.list(),
    'perfStats'
  );

  const appConfig = appConfigList.find(c => c.config_key === 'global_settings') || null;
  const displayOrderByPage = appConfig?.stat_display_order_by_page || {}; // Object to store page-specific orders
  const displayOrder = displayOrderByPage[selectedPage] || []; // Get the order for the currently selected page

  // Sort pages alphabetically by page_name
  const sortedPages = React.useMemo(() => {
    return [...allPages].sort((a, b) => a.page_name.localeCompare(b.page_name));
  }, [allPages]);

  // Create value lookup map
  const valueMap = React.useMemo(() => {
    const map = {};
    allValues.forEach(v => {
      map[v.stat_key] = v;
    });
    return map;
  }, [allValues]);

  // Get active stats for SELECTED page
  const activeStatsForSelectedPage = React.useMemo(() => {
    return allStats.filter(stat =>
      stat.is_active === true &&
      stat.display_on_pages &&
      Array.isArray(stat.display_on_pages) &&
      stat.display_on_pages.includes(selectedPage)
    );
  }, [allStats, selectedPage]);

  // Sort active stats by display order for SELECTED page
  const orderedActiveStats = React.useMemo(() => {
    // Create a map for quick lookup
    const statsMap = new Map(activeStatsForSelectedPage.map(stat => [stat.stat_key, stat]));

    const ordered = [];
    const unordered = [];

    // First, add stats that are in the displayOrder
    displayOrder.forEach(key => {
      if (statsMap.has(key)) {
        ordered.push(statsMap.get(key));
        statsMap.delete(key); // Remove from map once added to ordered
      }
    });

    // Then, add any remaining active stats that were not in the displayOrder
    unordered.push(...Array.from(statsMap.values()));

    // Sort unordered by sort_order as a fallback
    unordered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return [...ordered, ...unordered];
  }, [activeStatsForSelectedPage, displayOrder]);

  // Filter stats for the configuration table
  const filteredStats = allStats.filter(stat => {
    const matchesSearch = !searchQuery ||
      stat.stat_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stat.display_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || stat.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Form state for editing/creating
  const [formData, setFormData] = useState({
    stat_key: '',
    display_name: '',
    description: '',
    icon_name: 'Activity',
    category: 'Dashboard',
    unit: '',
    format_hint: 'number',
    link_page: '',
    color_hint: 'text-slate-400',
    is_active: true,
    sort_order: 0,
    update_source: '',
    display_on_pages: []
  });

  const handleEdit = (stat) => {
    setEditingStat(stat);
    setFormData({
      ...stat,
      display_on_pages: stat.display_on_pages || []
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStat(null);
    setFormData({
      stat_key: '',
      display_name: '',
      description: '',
      icon_name: 'Activity',
      category: 'Dashboard',
      unit: '',
      format_hint: 'number',
      link_page: '',
      color_hint: 'text-slate-400',
      is_active: true,
      sort_order: 0,
      update_source: '',
      display_on_pages: []
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingStat) {
        await base44.entities.StatConfiguration.update(editingStat.id, formData);
        setMessage({ type: 'success', text: '✓ Stat configuration updated' });
      } else {
        await base44.entities.StatConfiguration.create(formData);
        setMessage({ type: 'success', text: '✓ Stat configuration created' });
      }

      await refetch();
      setIsDialogOpen(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving stat:', error);
      setMessage({ type: 'error', text: `✗ Error: ${error.message}` });
    }
  };

  const handleDelete = async (stat) => {
    if (!confirm(`Delete stat "${stat.display_name}"?`)) return;

    try {
      await base44.entities.StatConfiguration.delete(stat.id);
      setMessage({ type: 'success', text: '✓ Stat deleted' });
      await refetch();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting stat:', error);
      setMessage({ type: 'error', text: `✗ Error: ${error.message}` });
    }
  };

  // Removed handleUpdateValues as the button is removed.
  // const handleUpdateValues = async () => {
  //   try {
  //     setMessage({ type: 'info', text: '⏳ Updating all stat values...' });
  //     const response = await base44.functions.invoke('updateAllStatValues');

  //     if (response.data.success) {
  //       setMessage({ type: 'success', text: `✓ Updated ${response.data.updated_count} stat values` });
  //     } else {
  //       setMessage({ type: 'error', text: '✗ Failed to update values' });
  //     }

  //     setTimeout(() => setMessage(null), 5000);
  //   } catch (error) {
  //     console.error('Error updating values:', error);
  //     setMessage({ type: 'error', text: `✗ Error: ${error.message}` });
  //   }
  // };

  // Toggle page selection
  const togglePageSelection = (pageName) => {
    setFormData(prev => {
      const currentPages = prev.display_on_pages || [];
      if (currentPages.includes(pageName)) {
        return { ...prev, display_on_pages: currentPages.filter(p => p !== pageName) };
      } else {
        return { ...prev, display_on_pages: [...currentPages, pageName] };
      }
    });
  };

  // Updated moveItem function for page-specific order
  const moveItem = async (currentIndex, direction) => {
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= orderedActiveStats.length) return;

    const items = Array.from(orderedActiveStats);
    const [movedItem] = items.splice(currentIndex, 1);
    items.splice(newIndex, 0, movedItem);

    const newOrder = items.map(stat => stat.stat_key);

    try {
      setIsSavingOrder(true);

      // Update the order for the SELECTED page
      const updatedOrderByPage = {
        ...displayOrderByPage, // Preserve orders for other pages
        [selectedPage]: newOrder // Update only the selected page's order
      };

      if (appConfig) {
        await base44.entities.AppConfig.update(appConfig.id, {
          ...appConfig,
          stat_display_order_by_page: updatedOrderByPage
        });
      } else {
        await base44.entities.AppConfig.create({
          config_key: 'global_settings',
          stat_display_order_by_page: updatedOrderByPage
        });
      }

      await refetchConfig();
      // Success message removed - spinner is enough feedback
    } catch (error) {
      console.error('Error saving display order:', error);
      setMessage({ type: 'error', text: `✗ Error: ${error.message}` });
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Get unique pages that have stats configured
  const pagesWithStats = React.useMemo(() => {
    const pageSet = new Set();
    allStats.forEach(stat => {
      if (stat.is_active && stat.display_on_pages && Array.isArray(stat.display_on_pages)) {
        stat.display_on_pages.forEach(page => pageSet.add(page));
      }
    });
    // Ensure Dashboard is always an option if it's the default selected page,
    // even if no stats are explicitly configured for it yet.
    if (!pageSet.has('Dashboard')) {
      pageSet.add('Dashboard');
    }
    return Array.from(pageSet).sort();
  }, [allStats]);


  // Access Denied
  if (!isLoading && currentUser?.role !== 'admin') {
    return (
      <div className="p-8 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
    <div className="p-4 lg:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon
            iconName="Gauge"
            iconConfig={iconConfigs['Gauge']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-orange-500"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Stats Configuration
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Centrally manage stat configurations, icons, and display settings
        </p>
      </motion.div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Alert className={`${
            message.type === 'success' ? 'border-green-500/50 bg-green-500/10' :
            message.type === 'error' ? 'border-red-500/50 bg-red-500/10' :
            'border-blue-500/50 bg-blue-500/10'
          }`}>
            <AlertDescription className={`${
              message.type === 'success' ? 'text-green-400' :
              message.type === 'error' ? 'text-red-400' :
              'text-blue-400'
            }`}>
              {message.text}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Display Order Section */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-3">
                  <ConfiguredIcon
                    iconName="GripVertical" // Using GripVertical for visual consistency with a "reorder" concept
                    iconConfig={iconConfigs['GripVertical']}
                    size="w-6 h-6"
                    fallbackColor="text-orange-400"
                  />
                  Stat Display Order
                </CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  Use the arrow buttons to reorder stats. Click left arrow to move left, right arrow to move right.
                </p>
              </div>
              
              {/* Page Selector */}
              <div className="flex items-center gap-3">
                <label className="text-slate-300 text-sm font-medium whitespace-nowrap">
                  Configure for Page:
                </label>
                <Select value={selectedPage} onValueChange={setSelectedPage}>
                  <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pagesWithStats.length === 0 ? (
                      <SelectItem value="none" disabled>No pages with stats</SelectItem>
                    ) : (
                      pagesWithStats.map(page => (
                        <SelectItem key={page} value={page}>
                          {page}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-[180px]"> {/* Added min-h-[180px] */}
            {activeStatsForSelectedPage.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No active stats configured for {selectedPage} yet.</p>
              </div>
            ) : (
              <div 
                className="flex gap-3 overflow-x-auto pb-4"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#475569 #1e293b'
                }}
              >
                {orderedActiveStats.map((stat, index) => {
                  const value = valueMap[stat.stat_key];
                  const formattedValue = value
                    ? (value.value_number !== null ? value.value_number.toLocaleString() : value.value_string)
                    : '—';

                  const canMoveLeft = index > 0;
                  const canMoveRight = index < orderedActiveStats.length - 1;

                  return (
                    <div key={stat.id} className="flex-shrink-0 flex items-center gap-2">
                      {/* Left Arrow */}
                      <Button
                        onClick={() => moveItem(index, 'left')}
                        disabled={!canMoveLeft || isSavingOrder}
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 text-slate-400 ${!canMoveLeft ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>

                      {/* Stat Card */}
                      <Card className="bg-slate-800/60 border-slate-700 hover:bg-slate-800/80 transition-all w-[128px] h-[98px]">
                        <CardContent className="p-3 h-full flex flex-col justify-center text-center">
                          {/* Icon */}
                          <div className="flex justify-center mb-1.5">
                            <ConfiguredIcon
                              iconName={stat.icon_name}
                              iconConfig={iconConfigs[stat.icon_name]}
                              size="w-5 h-5"
                              fallbackColor={stat.color_hint || 'text-slate-400'}
                            />
                          </div>

                          {/* Value */}
                          <div className="text-lg font-bold text-white mb-0.5">{formattedValue}</div>

                          {/* Label */}
                          <div className="text-slate-400 text-xs leading-tight">{stat.display_name}</div>
                        </CardContent>
                      </Card>

                      {/* Right Arrow */}
                      <Button
                        onClick={() => moveItem(index, 'right')}
                        disabled={!canMoveRight || isSavingOrder}
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 text-slate-400 ${!canMoveRight ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saving Spinner - always has space due to min-h-[180px] */}
            {isSavingOrder && (
              <div className="mt-4 text-center text-slate-400 text-sm">
                <ConfiguredIcon
                  iconName="Loader2"
                  iconConfig={iconConfigs['Loader2']}
                  size="w-4 h-4"
                  className="inline-block mr-2 animate-spin"
                />
                Saving order for {selectedPage}...
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        className="mb-6 flex flex-wrap gap-4 items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex gap-2">
          <Button
            onClick={handleCreate}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            <ConfiguredIcon
              iconName="Plus"
              iconConfig={iconConfigs['Plus']}
              size="w-4 h-4"
              className="mr-2"
            />
            New Stat
          </Button>
          {/* ENTFERNT: Update All Values Button */}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Search stats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Dashboard">Dashboard</SelectItem>
              <SelectItem value="Treasury">Treasury</SelectItem>
              <SelectItem value="Projects">Projects</SelectItem>
              <SelectItem value="Activity">Activity</SelectItem>
              <SelectItem value="Governance">Governance</SelectItem>
              <SelectItem value="Learning">Learning</SelectItem>
              <SelectItem value="Hubs">Hubs</SelectItem>
              <SelectItem value="System">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Stats List as Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {filteredStats.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No stats found matching your filters
          </div>
        ) : (
          <>
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 py-3 px-6 bg-slate-700/30 backdrop-blur-sm border-slate-700 rounded-t-xl mb-0 text-slate-300 text-sm font-medium">
              <div className="col-span-2">Stat Name</div>
              <div className="col-span-1">Category</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-3">Displayed On</div>
              <div className="col-span-3">Current Value</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Desktop Table Rows + Mobile Cards */}
            <div className="md:bg-slate-800/50 md:backdrop-blur-sm md:border-x md:border-b md:border-slate-700 md:rounded-b-xl md:rounded-t-none">
              {filteredStats.map((stat, index) => {
                const value = valueMap[stat.stat_key];

                return (
                  <div key={stat.id}>
                    {/* Desktop Row */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center py-4 px-6 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                      {/* Stat Name with Icon */}
                      <div className="col-span-2 flex items-center gap-3">
                        <ConfiguredIcon
                          iconName={stat.icon_name}
                          iconConfig={iconConfigs[stat.icon_name]}
                          size="w-5 h-5"
                          fallbackColor={stat.color_hint || 'text-slate-400'}
                        />
                        <div>
                          <div className="text-white font-medium">{stat.display_name}</div>
                          <div className="text-slate-400 text-xs">{stat.stat_key}</div>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="col-span-1">
                        <Badge variant="outline" className="text-slate-300 border-slate-600">
                          {stat.category}
                        </Badge>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <Badge className={stat.is_active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}>
                          {stat.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {/* Display on Pages */}
                      <div className="col-span-3">
                        {stat.display_on_pages && stat.display_on_pages.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {stat.display_on_pages.slice(0, 3).map(pageName => (
                              <Badge key={pageName} variant="outline" className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30">
                                {pageName}
                              </Badge>
                            ))}
                            {stat.display_on_pages.length > 3 && (
                              <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                                +{stat.display_on_pages.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">No pages</span>
                        )}
                      </div>

                      {/* Current Value */}
                      <div className="col-span-3">
                        {value ? (
                          <div className="text-white font-mono font-semibold">
                            {value.value_number !== null ? value.value_number.toLocaleString() : value.value_string}
                            {stat.unit && <span className="text-slate-400 ml-1">{stat.unit}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">No value yet</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex justify-end gap-2">
                        <Button
                          onClick={() => handleEdit(stat)}
                          variant="outline"
                          size="sm"
                          className="btn-secondary-coherosphere"
                        >
                          <ConfiguredIcon
                            iconName="Edit"
                            iconConfig={iconConfigs['Edit']}
                            size="w-4 h-4"
                          />
                        </Button>

                        <Button
                          onClick={() => handleDelete(stat)}
                          variant="outline"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-slate-700"
                        >
                          <ConfiguredIcon
                            iconName="Trash2"
                            iconConfig={iconConfigs['Trash2']}
                            size="w-4 h-4"
                          />
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Card */}
                    <div className="md:hidden mb-4">
                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <ConfiguredIcon
                                iconName={stat.icon_name}
                                iconConfig={iconConfigs[stat.icon_name]}
                                size="w-8 h-8"
                                fallbackColor={stat.color_hint || 'text-slate-400'}
                              />

                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-lg font-bold text-white">{stat.display_name}</h3>
                                  <Badge className={stat.is_active ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-300'}>
                                    {stat.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                <div className="flex gap-2 mb-2">
                                  <Badge variant="outline" className="text-slate-400">{stat.category}</Badge>
                                </div>
                                <p className="text-slate-400 text-sm mb-2">{stat.description}</p>
                                <div className="text-xs text-slate-500">
                                  <strong>Key:</strong> {stat.stat_key}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Display Pages */}
                          {stat.display_on_pages && stat.display_on_pages.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-xs text-slate-500 font-semibold">Displayed on:</span>
                              {stat.display_on_pages.map(pageName => (
                                <Badge key={pageName} variant="outline" className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30">
                                  {pageName}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Current Value */}
                          {value && (
                            <div className="bg-slate-700/50 p-3 rounded-lg mb-3 flex justify-between items-center">
                              <span className="text-slate-300 font-medium">Current Value:</span>
                              <span className="text-white font-bold font-mono">
                                {value.value_number !== null ? value.value_number.toLocaleString() : value.value_string}
                                {stat.unit && <span className="text-slate-400 ml-1">{stat.unit}</span>}
                              </span>
                            </div>
                          )}

                          {value && (
                            <div className="text-xs text-slate-500 mb-3">
                              Last updated: {new Date(value.timestamp).toLocaleString('de-DE')}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-3 border-t border-slate-700">
                            <Button
                              onClick={() => handleEdit(stat)}
                              variant="outline"
                              className="btn-secondary-coherosphere flex-1"
                            >
                              <ConfiguredIcon
                                iconName="Edit"
                                iconConfig={iconConfigs['Edit']}
                                size="w-4 h-4"
                                className="mr-2"
                              />
                              Edit
                            </Button>

                            <Button
                              onClick={() => handleDelete(stat)}
                              variant="outline"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-slate-700"
                            >
                              <ConfiguredIcon
                                iconName="Trash2"
                                iconConfig={iconConfigs['Trash2']}
                                size="w-4 h-4"
                              />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingStat ? 'Edit Stat Configuration' : 'Create New Stat Configuration'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure how this stat should be displayed across the platform
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Left Column: Form */}
            <div className="space-y-4">
              <div>
                <Label className="text-white">Stat Key (Unique Identifier)</Label>
                <Input
                  value={formData.stat_key}
                  onChange={(e) => setFormData({ ...formData, stat_key: e.target.value })}
                  placeholder="e.g., dashboard_total_members"
                  disabled={!!editingStat}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Display Name</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Total Members"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description of what this stat represents"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dashboard">Dashboard</SelectItem>
                      <SelectItem value="Treasury">Treasury</SelectItem>
                      <SelectItem value="Projects">Projects</SelectItem>
                      <SelectItem value="Activity">Activity</SelectItem>
                      <SelectItem value="Governance">Governance</SelectItem>
                      <SelectItem value="Learning">Learning</SelectItem>
                      <SelectItem value="Hubs">Hubs</SelectItem>
                      <SelectItem value="System">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Icon Name</Label>
                  <Input
                    value={formData.icon_name}
                    onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                    placeholder="e.g., Users, Wallet"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Unit</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., sats, %, members"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">Format Hint</Label>
                  <Select value={formData.format_hint} onValueChange={(value) => setFormData({ ...formData, format_hint: value })}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Color Hint</Label>
                  <Input
                    value={formData.color_hint}
                    onChange={(e) => setFormData({ ...formData, color_hint: e.target.value })}
                    placeholder="e.g., text-orange-400"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">Sort Order</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white">Link Page (Optional)</Label>
                <Input
                  value={formData.link_page}
                  onChange={(e) => setFormData({ ...formData, link_page: e.target.value })}
                  placeholder="e.g., Profile, Treasury"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Update Source</Label>
                <Input
                  value={formData.update_source}
                  onChange={(e) => setFormData({ ...formData, update_source: e.target.value })}
                  placeholder="e.g., updateSystemStats, checkApiStatus"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              {/* Display on Pages - Multiselect */}
              <div>
                <Label className="text-white mb-2 block">Display on Pages</Label>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                  {pagesLoading ? (
                    <p className="text-slate-400 text-sm">Loading pages...</p>
                  ) : sortedPages.length === 0 ? (
                    <p className="text-slate-400 text-sm">No pages found</p>
                  ) : (
                    sortedPages.map(page => (
                      <div key={page.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`page-${page.id}`}
                          checked={(formData.display_on_pages || []).includes(page.page_name)}
                          onCheckedChange={() => togglePageSelection(page.page_name)}
                        />
                        <label
                          htmlFor={`page-${page.id}`}
                          className="text-sm text-slate-300 cursor-pointer flex-1"
                        >
                          {page.page_name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Select which pages should display this stat
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label className="text-white">Active</Label>
              </div>
            </div>

            {/* Right Column: Live Preview */}
            <div className="space-y-4">
              <div className="sticky top-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ConfiguredIcon
                    iconName="Eye"
                    iconConfig={iconConfigs['Eye']}
                    size="w-5 h-5"
                    className="text-orange-400"
                  />
                  Live Preview
                </h3>

                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                  <p className="text-slate-400 text-sm mb-4">
                    This is how your stat will appear on the Dashboard:
                  </p>

                  <StatCard
                    iconName={formData.icon_name || 'Activity'}
                    iconConfig={iconConfigs[formData.icon_name]}
                    value={formData.format_hint === 'percentage' ? '75%' : '1,234'}
                    label={formData.display_name || 'Stat Name'}
                    isLoading={false}
                  />

                  <div className="mt-6 p-4 bg-slate-800/50 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Icon:</span>
                      <span className="text-white font-mono">{formData.icon_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Color:</span>
                      <span className="text-white font-mono">{formData.color_hint || 'Default'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Unit:</span>
                      <span className="text-white font-mono">{formData.unit || 'None'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Category:</span>
                      <span className="text-white font-mono">{formData.category}</span>
                    </div>
                  </div>

                  {/* Display selected pages */}
                  {formData.display_on_pages && formData.display_on_pages.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-blue-300 font-semibold mb-2">
                        Will be displayed on:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {formData.display_on_pages.map(pageName => (
                          <Badge key={pageName} variant="outline" className="text-xs text-blue-300 border-blue-500/30">
                            {pageName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.description && (
                    <div className="mt-4 p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                      <p className="text-xs text-slate-300">
                        <strong>Description:</strong> {formData.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
              {editingStat ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
