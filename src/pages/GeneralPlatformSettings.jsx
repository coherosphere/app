
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';

export default function GeneralPlatformSettings() {
  const { iconConfigs } = useAllIconConfigs();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [config, setConfig] = useState(null);
  const [screensaverIdleSeconds, setScreensaverIdleSeconds] = useState(30);
  const [nostrRelays, setNostrRelays] = useState([]);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [relayError, setRelayError] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // Progressive Loading States - START AS FALSE
  const [sectionsReady, setSectionsReady] = useState({
    screensaverConfig: false,
    nostrRelays: false
  });

  // Load data when component mounts AND when user returns to the page
  useEffect(() => {
    loadData();
    
    // Add event listener for page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[GeneralPlatformSettings] Page became visible, reloading config...');
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    // Reset section ready states
    setSectionsReady({
      screensaverConfig: false,
      nostrRelays: false
    });
    
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.role !== 'admin') {
        setMessage({ type: 'error', text: 'Access denied. Admin role required.' });
        setIsLoading(false);
        return;
      }

      // Load config
      console.log('[GeneralPlatformSettings] Loading config from backend...');
      const response = await base44.functions.invoke('getAppConfig');
      console.log('[GeneralPlatformSettings] Config loaded:', response.data);
      
      if (response.data.success) {
        setConfig(response.data.config);
        setScreensaverIdleSeconds(response.data.config.screensaver_idle_seconds || 30);
        
        // Handle both old (string array) and new (object array) formats
        const relays = response.data.config.nostr_relays || [];
        if (relays.length > 0 && typeof relays[0] === 'string') {
          // Old format: convert to new format
          setNostrRelays(relays.map(url => ({ url, enabled: true })));
        } else {
          // New format: use as-is
          console.log('[GeneralPlatformSettings] Loaded relays:', relays);
          
          // DEBUG: Check what's in each relay object
          relays.forEach((relay, i) => {
            console.log(`[GeneralPlatformSettings] Relay ${i}:`, {
              url: relay.url,
              enabled: relay.enabled,
              last_checked: relay.last_checked,
              last_response_time_ms: relay.last_response_time_ms,
              last_events_collected: relay.last_events_collected,
              status: relay.status,
              allKeys: Object.keys(relay)
            });
          });
          
          setNostrRelays(relays);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  // Track when sections are ready (parallel loading)
  useEffect(() => {
    // Screensaver Config ready when config loaded
    if (!isLoading && config) {
      setSectionsReady(prev => ({ ...prev, screensaverConfig: true }));
    }
  }, [isLoading, config]);

  useEffect(() => {
    // Nostr Relays ready when config loaded
    if (!isLoading && config) {
      setSectionsReady(prev => ({ ...prev, nostrRelays: true }));
    }
  }, [isLoading, config]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await base44.functions.invoke('updateAppConfig', {
        updates: {
          screensaver_idle_seconds: parseInt(screensaverIdleSeconds),
          nostr_relays: nostrRelays
        }
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully! Users will need to reload the page for changes to take effect.' });
        await loadData();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (config) {
      setScreensaverIdleSeconds(config.screensaver_idle_seconds || 30);
      const relays = config.nostr_relays || [];
      if (relays.length > 0 && typeof relays[0] === 'string') {
        setNostrRelays(relays.map(url => ({ url, enabled: true })));
      } else {
        setNostrRelays(relays);
      }
      setMessage({ type: 'info', text: 'Changes discarded' });
      setRelayError(null);
      setNewRelayUrl('');
    }
  };

  const handleAddRelay = () => {
    setRelayError(null);
    
    // Validate URL
    if (!newRelayUrl.trim()) {
      setRelayError('Please enter a relay URL');
      return;
    }

    if (!newRelayUrl.startsWith('wss://')) {
      setRelayError('Relay URL must start with wss://');
      return;
    }

    try {
      new URL(newRelayUrl); // Basic URL validation
    } catch (e) {
      setRelayError('Invalid URL format');
      return;
    }

    // Check for duplicates
    if (nostrRelays.some(r => r.url === newRelayUrl)) {
      setRelayError('This relay is already in the list');
      return;
    }

    setNostrRelays([...nostrRelays, { url: newRelayUrl, enabled: true }]);
    setNewRelayUrl('');
  };

  const handleRemoveRelay = (index) => {
    setNostrRelays(nostrRelays.filter((_, i) => i !== index));
  };

  const handleToggleRelay = (index) => {
    const updated = [...nostrRelays];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setNostrRelays(updated);
  };

  const handleTestAllRelays = async () => {
    setIsTesting(true);
    setMessage(null);
    setTestResults(null);

    try {
      console.log('[GeneralPlatformSettings] Testing all relays...');
      const response = await base44.functions.invoke('testAllRelays');

      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: `Test complete! Tested ${response.data.total_tested} relays, collected ${response.data.total_events} total events in ${Math.round(response.data.duration_ms / 1000)}s` 
        });
        setTestResults(response.data.results);
        
        // CRITICAL: Reload config to show updated metrics
        console.log('[GeneralPlatformSettings] Test complete, reloading config...');
        await loadData();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to test relays' });
      }
    } catch (error) {
      console.error('Error testing relays:', error);
      setMessage({ type: 'error', text: 'Failed to test relays' });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'slow': return 'text-yellow-400';
      case 'timeout': return 'text-orange-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status) => {
    const iconName = (() => {
      switch (status) {
        case 'healthy': return 'CheckCircle';
        case 'slow': return 'Clock';
        case 'timeout': return 'AlertCircle';
        case 'error': return 'AlertCircle';
        default: return 'Wifi';
      }
    })();

    return (
      <ConfiguredIcon 
        iconName={iconName}
        iconConfig={iconConfigs[iconName]}
        size="w-4 h-4"
        fallbackColor="currentColor"
      />
    );
  };

  const formatLatency = (ms) => {
    if (!ms && ms !== 0) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatLastChecked = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Skeleton Components
  const ScreensaverConfigSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-8">
      <CardHeader>
        <div className="h-6 w-64 bg-slate-700 animate-pulse rounded mb-2" />
        <div className="h-4 w-96 bg-slate-700/50 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 bg-slate-700 animate-pulse rounded mt-1" />
            <div className="flex-1 space-y-4">
              <div className="h-5 w-48 bg-slate-700 animate-pulse rounded" />
              <div className="h-4 w-full bg-slate-700/50 animate-pulse rounded" />
              <div className="h-12 w-32 bg-slate-700 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const NostrRelaysSkeleton = () => (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-56 bg-slate-700 animate-pulse rounded mb-2" />
            <div className="h-4 w-96 bg-slate-700/50 animate-pulse rounded" />
          </div>
          <div className="h-16 w-32 bg-slate-700 animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-900/50 animate-pulse rounded-lg" />
            ))}
          </div>

          {/* Test Button */}
          <div className="h-32 bg-blue-500/10 animate-pulse rounded-lg" />

          {/* Relays List */}
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <div className="h-5 w-48 bg-slate-700 animate-pulse rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-slate-800/50 animate-pulse rounded-lg" />
              ))}
            </div>
          </div>

          {/* Add Relay */}
          <div className="h-48 bg-slate-900/50 animate-pulse rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );

  // Access Denied - show ONLY when user is loaded and not admin
  if (!isLoading && currentUser?.role !== 'admin') {
    return (
      <div className="p-8">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="p-8 text-center">
            <ConfiguredIcon 
              iconName="AlertCircle"
              iconConfig={iconConfigs['AlertCircle']}
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

  const enabledCount = nostrRelays.filter(r => r.enabled).length;
  const avgLatency = nostrRelays.filter(r => r.last_response_time_ms).length > 0
    ? Math.round(nostrRelays.filter(r => r.last_response_time_ms).reduce((sum, r) => sum + (r.last_response_time_ms || 0), 0) / nostrRelays.filter(r => r.last_response_time_ms).length)
    : null;

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
            iconName="Settings2"
            iconConfig={iconConfigs['Settings2']}
            size="w-12 h-12"
            className="flex-shrink-0"
            fallbackColor="text-orange-500"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
              General Platform Settings
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mt-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Configure global platform settings that affect all users.
        </p>
      </motion.div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Alert className={`border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
            message.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <ConfiguredIcon 
              iconName={message.type === 'success' ? 'CheckCircle' : 'AlertCircle'}
              iconConfig={iconConfigs[message.type === 'success' ? 'CheckCircle' : 'AlertCircle']}
              size="h-4 w-4"
              fallbackColor={message.type === 'success' ? 'text-green-400' : message.type === 'error' ? 'text-red-400' : 'text-blue-400'}
            />
            <AlertDescription className={message.type === 'success' ? 'text-green-400' : message.type === 'error' ? 'text-red-400' : 'text-blue-400'}>
              {message.text}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Admin Badge - show only when user confirmed */}
      {!isLoading && currentUser?.role === 'admin' && (
        <div className="flex items-center gap-3 mb-8">
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
            Admin Settings
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
            Global Configuration
          </Badge>
        </div>
      )}

      {/* Screensaver Settings - Progressive Loading OR Skeleton */}
      {sectionsReady.screensaverConfig ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                <ConfiguredIcon 
                  iconName="Monitor"
                  iconConfig={iconConfigs['Monitor']}
                  size="w-5 h-5"
                  fallbackColor="text-orange-500"
                />
                Idle Screensaver Configuration
              </CardTitle>
              <p className="text-slate-400 text-sm mt-2">
                Configure how long users must be idle before the screensaver activates. This setting applies to all users who have the screensaver enabled.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <ConfiguredIcon 
                        iconName="Clock"
                        iconConfig={iconConfigs['Clock']}
                        size="w-6 h-6"
                        fallbackColor="text-cyan-400"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="idle-timeout" className="text-white font-semibold text-lg mb-2 block">
                        Idle Timeout (seconds)
                      </Label>
                      <p className="text-slate-400 text-sm mb-4">
                        How many seconds of inactivity before the screensaver appears. Default is 30 seconds.
                      </p>
                      <div className="flex items-center gap-4">
                        <Input
                          id="idle-timeout"
                          type="number"
                          min="5"
                          max="300"
                          value={screensaverIdleSeconds}
                          onChange={(e) => setScreensaverIdleSeconds(e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white max-w-xs text-lg font-semibold"
                        />
                        <span className="text-slate-400">seconds</span>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <ConfiguredIcon 
                          iconName="AlertCircle"
                          iconConfig={iconConfigs['AlertCircle']}
                          size="w-4 h-4"
                          fallbackColor="currentColor"
                        />
                        <span>Recommended range: 15-120 seconds</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Info */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ConfiguredIcon 
                      iconName="AlertCircle"
                      iconConfig={iconConfigs['AlertCircle']}
                      size="w-5 h-5"
                      className="flex-shrink-0 mt-0.5"
                      fallbackColor="text-blue-400"
                    />
                    <div className="text-sm text-blue-300">
                      <p className="font-semibold mb-1">Important Notes:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-200">
                        <li>This setting affects all users globally</li>
                        <li>Users can still disable the screensaver entirely in their profile</li>
                        <li>Changes require users to reload the page to take effect</li>
                        <li>Very short timeouts (&lt;10s) may be disruptive</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <ScreensaverConfigSkeleton />
      )}

      {/* Nostr Relays Configuration - Progressive Loading OR Skeleton */}
      {sectionsReady.nostrRelays ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-3">
                    <ConfiguredIcon 
                      iconName="Wifi"
                      iconConfig={iconConfigs['Wifi']}
                      size="w-5 h-5"
                      fallbackColor="text-orange-500"
                    />
                    Nostr Relay Configuration
                  </CardTitle>
                  <p className="text-slate-400 text-sm mt-2">
                    Configure which Nostr relays are used for fetching activity data. Toggle relays on/off and monitor their performance.
                  </p>
                </div>
                {avgLatency && (
                  <div className="text-right">
                    <div className="text-slate-400 text-xs mb-1">Avg Response Time</div>
                    <div className="text-2xl font-bold text-cyan-400">{formatLatency(avgLatency)}</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Performance Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <ConfiguredIcon 
                        iconName="Wifi"
                        iconConfig={iconConfigs['Wifi']}
                        size="w-5 h-5"
                        fallbackColor="text-green-400"
                      />
                      <div>
                        <div className="text-slate-400 text-xs">Active Relays</div>
                        <div className="text-2xl font-bold text-white">{enabledCount}/{nostrRelays.length}</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <ConfiguredIcon 
                        iconName="CheckCircle"
                        iconConfig={iconConfigs['CheckCircle']}
                        size="w-5 h-5"
                        fallbackColor="text-cyan-400"
                      />
                      <div>
                        <div className="text-slate-400 text-xs">Healthy Relays</div>
                        <div className="text-2xl font-bold text-white">
                          {nostrRelays.filter(r => r.status === 'healthy').length}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <ConfiguredIcon 
                        iconName="Zap"
                        iconConfig={iconConfigs['Zap']}
                        size="w-5 h-5"
                        fallbackColor="text-yellow-400"
                      />
                      <div>
                        <div className="text-slate-400 text-xs">Fastest Relay</div>
                        <div className="text-lg font-bold text-white">
                          {nostrRelays.filter(r => r.last_response_time_ms).length > 0
                            ? formatLatency(Math.min(...nostrRelays.filter(r => r.last_response_time_ms).map(r => r.last_response_time_ms)))
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test All Relays Button */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ConfiguredIcon 
                      iconName="Zap"
                      iconConfig={iconConfigs['Zap']}
                      size="w-5 h-5"
                      className="flex-shrink-0 mt-0.5"
                      fallbackColor="text-blue-400"
                    />
                    <div className="flex-1">
                      <h4 className="text-blue-300 font-semibold mb-2">Test All Relays</h4>
                      <p className="text-sm text-blue-200 mb-3">
                        Test all configured relays (including disabled ones) to check their performance and event availability. 
                        This helps you decide if disabled relays should be reactivated.
                      </p>
                      <Button
                        onClick={handleTestAllRelays}
                        disabled={isTesting}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold"
                      >
                        <ConfiguredIcon 
                          iconName="Zap"
                          iconConfig={iconConfigs['Zap']}
                          size="w-4 h-4"
                          className={`mr-2 ${isTesting ? 'animate-pulse' : ''}`}
                          fallbackColor="currentColor"
                        />
                        {isTesting ? 'Testing All Relays...' : 'Test All Relays'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Current Relays List */}
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-white font-semibold text-lg mb-4">Configured Relays ({nostrRelays.length})</h3>
                  
                  {nostrRelays.length === 0 ? (
                    <p className="text-slate-400 text-sm">No relays configured. Add at least one relay to fetch activity data.</p>
                  ) : (
                    <div className="space-y-3">
                      {nostrRelays.map((relay, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between bg-slate-800/50 rounded-lg p-4 border transition-all ${
                            relay.enabled ? 'border-slate-600' : 'border-slate-700 opacity-60'
                          }`}
                        >
                          {/* Left: Toggle & URL */}
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Switch
                                checked={relay.enabled}
                                onCheckedChange={() => handleToggleRelay(index)}
                                className="data-[state=checked]:bg-green-500"
                              />
                              <ConfiguredIcon 
                                iconName="Power"
                                iconConfig={iconConfigs['Power']}
                                size="w-4 h-4"
                                fallbackColor={relay.enabled ? 'text-green-400' : 'text-slate-500'}
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm truncate ${relay.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                                  {relay.url}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                {relay.last_checked && (
                                  <span>Last checked: {formatLastChecked(relay.last_checked)}</span>
                                )}
                                {(relay.last_events_collected !== undefined && relay.last_events_collected !== null) && (
                                  <>
                                    <span className="text-slate-500">•</span>
                                    <div className="flex items-center gap-1">
                                      <ConfiguredIcon 
                                        iconName="List"
                                        iconConfig={iconConfigs['List']}
                                        size="w-3 h-3"
                                        fallbackColor="currentColor"
                                      />
                                      <span className={relay.last_events_collected > 0 ? 'text-green-400 font-semibold' : ''}>
                                        {relay.last_events_collected} Event{relay.last_events_collected !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Performance & Actions */}
                          <div className="flex items-center gap-4 flex-shrink-0">
                            {/* Performance Indicator */}
                            {relay.last_response_time_ms !== undefined && (
                              <div className="flex items-center gap-2">
                                <div className={`flex items-center gap-1 ${getStatusColor(relay.status)}`}>
                                  {getStatusIcon(relay.status)}
                                  <span className="text-sm font-semibold">
                                    {formatLatency(relay.last_response_time_ms)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Delete Button */}
                            <Button
                              onClick={() => handleRemoveRelay(index)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <ConfiguredIcon 
                                iconName="Trash2"
                                iconConfig={iconConfigs['Trash2']}
                                size="w-4 h-4"
                                fallbackColor="currentColor"
                              />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Relay */}
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-white font-semibold text-lg mb-4">Add New Relay</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-relay-url" className="text-white font-medium mb-2 block">
                        Relay URL
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="new-relay-url"
                          type="text"
                          placeholder="wss://relay.example.com"
                          value={newRelayUrl}
                          onChange={(e) => {
                            setNewRelayUrl(e.target.value);
                            setRelayError(null);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddRelay();
                            }
                          }}
                          className="bg-slate-800 border-slate-600 text-white flex-1"
                        />
                        <Button
                          onClick={handleAddRelay}
                          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-semibold px-6"
                        >
                          <ConfiguredIcon 
                            iconName="Plus"
                            iconConfig={iconConfigs['Plus']}
                            size="w-4 h-4"
                            className="mr-2"
                            fallbackColor="currentColor"
                          />
                          Add
                        </Button>
                      </div>
                      {relayError && (
                        <p className="text-red-400 text-sm mt-2">{relayError}</p>
                      )}
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <ConfiguredIcon 
                          iconName="AlertCircle"
                          iconConfig={iconConfigs['AlertCircle']}
                          size="w-5 h-5"
                          className="flex-shrink-0 mt-0.5"
                          fallbackColor="text-blue-400"
                        />
                        <div className="text-sm text-blue-300">
                          <p className="font-semibold mb-1">Relay Guidelines:</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-200">
                            <li>Must start with <code className="bg-blue-900/30 px-1 rounded">wss://</code> (secure WebSocket)</li>
                            <li>More relays = more data coverage but slower loading</li>
                            <li>Fewer relays = faster loading but potentially missing events</li>
                            <li>Recommended: 3-6 reliable relays for optimal balance</li>
                            <li>Use the toggle to quickly enable/disable relays without removing them</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <NostrRelaysSkeleton />
      )}

      {/* Save Button - show only when data loaded */}
      {!isLoading && currentUser?.role === 'admin' && (
        <motion.div
          className="flex justify-end gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
        >
          <Button
            onClick={handleDiscard}
            variant="outline"
            className="btn-secondary-coherosphere"
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold px-8 py-3"
          >
            <ConfiguredIcon 
              iconName="Save"
              iconConfig={iconConfigs['Save']}
              size="w-5 h-5"
              className="mr-2"
              fallbackColor="currentColor"
            />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
