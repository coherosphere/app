
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { base44 } from '@/api/base44Client';
import { Copy, CheckCircle, LogOut } from 'lucide-react';

export default function NostrProfilePage() {
  const { iconConfigs } = useAllIconConfigs();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [nostrApiUrl, setNostrApiUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedPubkey, setCopiedPubkey] = useState(false);
  const [npub, setNpub] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [displayName, setDisplayName] = useState('Nostr User'); // NEW: Actual display name from DB
  const [saveMessage, setSaveMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load API URL and session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        console.log('[NostrProfile] === LOADING SESSION START ===');
        
        // Get API URL
        const response = await base44.functions.invoke('getNostrApiConfig');
        const apiUrl = response.data?.nostrApiUrl || 'http://localhost:3000/api/auth/session';
        setNostrApiUrl(apiUrl);
        console.log('[NostrProfile] API URL:', apiUrl);

        // Check session
        const resp = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (resp.status === 200) {
          const data = await resp.json();
          console.log('[NostrProfile] Session data:', data);
          setSessionData(data);
          
          // Convert hex pubkey to npub using backend
          if (data.pubkey) {
            console.log('[NostrProfile] Converting hex pubkey:', data.pubkey);
            
            const npubResponse = await base44.functions.invoke('hexToNpub', {
              pubkey_hex: data.pubkey
            });
            
            console.log('[NostrProfile] hexToNpub response:', npubResponse.data);
            
            if (npubResponse.data?.npub) {
              const convertedNpub = npubResponse.data.npub;
              setNpub(convertedNpub);
              console.log('[NostrProfile] Converted npub:', convertedNpub);
              
              // Load NostrUser from database
              console.log('[NostrProfile] Querying NostrUser with npub:', convertedNpub);
              
              try {
                const nostrUsers = await base44.entities.NostrUser.filter({
                  nostr_pubkey: convertedNpub
                });
                
                console.log('[NostrProfile] Query result - found', nostrUsers.length, 'users');
                console.log('[NostrProfile] Users:', JSON.stringify(nostrUsers, null, 2));
                
                if (nostrUsers.length > 0) {
                  const nostrUser = nostrUsers[0];
                  const dbName = nostrUser.full_name || 'Nostr User';
                  
                  console.log('[NostrProfile] ✅ Found user in database!');
                  console.log('[NostrProfile] User ID:', nostrUser.id);
                  console.log('[NostrProfile] Full Name from DB:', dbName);
                  console.log('[NostrProfile] All user data:', nostrUser);
                  
                  setDisplayName(dbName);
                  setEditedName(dbName);
                } else {
                  // Fallback to session name if no database entry
                  const fallbackName = data.name || 'Nostr User';
                  console.log('[NostrProfile] ⚠️ No database entry found');
                  console.log('[NostrProfile] Using session name as fallback:', fallbackName);
                  setDisplayName(fallbackName);
                  setEditedName(fallbackName);
                }
              } catch (dbError) {
                console.error('[NostrProfile] ❌ Database query failed:', dbError);
                console.error('[NostrProfile] Error details:', dbError.message);
                console.error('[NostrProfile] Error stack:', dbError.stack);
                
                // Fallback to session name
                const fallbackName = data.name || 'Nostr User';
                console.log('[NostrProfile] Using session name after error:', fallbackName);
                setDisplayName(fallbackName);
                setEditedName(fallbackName);
              }
            } else {
              console.error('[NostrProfile] ❌ No npub in response');
            }
          } else {
            console.error('[NostrProfile] ❌ No pubkey in session data');
          }
        } else {
          console.error('[NostrProfile] ❌ Session check failed with status:', resp.status);
        }
        
        console.log('[NostrProfile] === LOADING SESSION END ===');
      } catch (error) {
        console.error('[NostrProfile] ❌ Failed to load session:', error);
        console.error('[NostrProfile] Error message:', error.message);
        console.error('[NostrProfile] Error stack:', error.stack);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPubkey(true);
      setTimeout(() => setCopiedPubkey(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleLogout = async () => {
    if (!nostrApiUrl) return;

    try {
      await fetch(nostrApiUrl, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      // Dispatch event for layout
      window.dispatchEvent(new CustomEvent('nostrSessionChanged', { detail: { hasSession: false } }));
      
      // Use SPA navigation instead of page reload
      navigate('/Nostr');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSaveName = async () => {
    if (!npub || !editedName.trim()) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      console.log('[NostrProfile] Updating name to:', editedName.trim());
      
      await base44.functions.invoke('updateNostrUserProfile', {
        nostr_pubkey: npub,
        updates: {
          full_name: editedName.trim()
        }
      });

      // Update the display name
      setDisplayName(editedName.trim());
      setSaveMessage('Name updated successfully!');
      setIsEditingName(false);

      setTimeout(() => setSaveMessage(null), 3000);

    } catch (error) {
      console.error('Failed to update name:', error);
      setSaveMessage('Failed to update name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(displayName);
    setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-slate-700/50 rounded-full animate-pulse" />
              <div>
                <div className="h-10 w-56 bg-slate-700/50 rounded animate-pulse mb-2" />
                <div className="w-16 h-1 bg-slate-700/50 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-96 bg-slate-700/50 rounded animate-pulse" />
          </div>

          {/* Session Info Skeleton */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
                <div className="h-6 w-20 bg-slate-700/50 rounded-full animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name Skeleton */}
              <div className="space-y-2">
                <div className="h-5 w-24 bg-slate-700/50 rounded animate-pulse" />
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>

              {/* Public Key Skeleton */}
              <div className="space-y-2">
                <div className="h-5 w-32 bg-slate-700/50 rounded animate-pulse" />
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>

              {/* Hex Key Skeleton */}
              <div className="space-y-2">
                <div className="h-5 w-24 bg-slate-700/50 rounded animate-pulse" />
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>

              {/* Actions Skeleton */}
              <div className="pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />
                  <div className="h-10 w-24 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card Skeleton */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-slate-700/50 rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-slate-700/50 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!sessionData || !sessionData.pubkey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8 flex items-center justify-center">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 max-w-md">
          <CardContent className="p-8 text-center">
            <ConfiguredIcon
              iconName="AlertCircle"
              iconConfig={iconConfigs['AlertCircle']}
              size="w-12 h-12"
              fallbackColor="text-orange-500"
              className="mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-white mb-2">No Active Session</h2>
            <p className="text-slate-400 mb-4">
              You need to sign in with Nostr to view your profile.
            </p>
            <Button
              onClick={() => navigate('/Nostr')}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              Sign In with Nostr
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
              <ConfiguredIcon
                iconName="Key"
                iconConfig={iconConfigs['Key']}
                size="w-6 h-6"
                fallbackColor="text-white"
              />
            </div>
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                My coherosphere Profile
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
          <p className="text-lg text-slate-400 leading-relaxed">
            Your decentralized identity on the coherosphere
          </p>
        </motion.div>

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className={saveMessage.includes('success') ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}>
              <AlertDescription className={saveMessage.includes('success') ? 'text-green-400' : 'text-orange-400'}>
                {saveMessage}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Session Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ConfiguredIcon
                  iconName="Key"
                  iconConfig={iconConfigs['Key']}
                  size="w-5 h-5"
                  fallbackColor="text-purple-500"
                />
                Session Information
                <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/50">
                  <ConfiguredIcon
                    iconName="CheckCircle"
                    iconConfig={iconConfigs['CheckCircle']}
                    size="w-3 h-3"
                    fallbackColor="text-green-400"
                  />
                  Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Editable Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    Display Name
                  </Badge>
                  <span className="text-xs text-slate-400">← Your name in the coherosphere</span>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  {isEditingName ? (
                    <div className="flex items-center gap-3">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="flex-1 text-sm bg-slate-800 border-slate-600 text-white"
                        placeholder="Your name"
                        autoFocus
                        disabled={isSaving}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveName}
                        disabled={isSaving || !editedName.trim()}
                        className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                      >
                        {isSaving ? (
                          <ConfiguredIcon 
                            iconName="Loader2"
                            iconConfig={iconConfigs['Loader2']}
                            size="w-4 h-4"
                            className="animate-spin"
                          />
                        ) : (
                          <ConfiguredIcon 
                            iconName="Check"
                            iconConfig={iconConfigs['Check']}
                            size="w-4 h-4"
                          />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="text-slate-400 hover:text-white flex-shrink-0"
                      >
                        <ConfiguredIcon 
                          iconName="X"
                          iconConfig={iconConfigs['X']}
                          size="w-4 h-4"
                        />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="flex-1 text-sm text-white break-all font-medium">
                        {displayName}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingName(true)}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        <ConfiguredIcon 
                          iconName="Edit2"
                          iconConfig={iconConfigs['Edit2']}
                          size="w-4 h-4"
                        />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Public Key (npub) */}
              {npub && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      Public Key (npub)
                    </Badge>
                    <span className="text-xs text-slate-400">← Your public identity</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-start gap-3">
                      <code className="flex-1 text-sm text-purple-300 break-all font-mono">
                        {npub}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(npub)}
                        className="flex-shrink-0 text-purple-400 hover:text-purple-300"
                      >
                        {copiedPubkey ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Hex Pubkey */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    Hex Format
                  </Badge>
                  <span className="text-xs text-slate-400">← Raw public key</span>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <code className="text-sm text-blue-300 break-all font-mono">
                    {sessionData.pubkey}
                  </code>
                </div>
              </div>

              {/* Session Status */}
              <div className="pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <ConfiguredIcon
                      iconName="Clock"
                      iconConfig={iconConfigs['Clock']}
                      size="w-4 h-4"
                      fallbackColor="text-slate-500"
                    />
                    Session established
                  </div>
                  <Button
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <ConfiguredIcon
                  iconName="Info"
                  iconConfig={iconConfigs['Info']}
                  size="w-5 h-5"
                  fallbackColor="text-blue-400"
                  className="flex-shrink-0 mt-0.5"
                />
                <div className="text-sm text-slate-300 space-y-2">
                  <p><strong className="text-blue-400">About Your coherosphere Identity:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Your npub is your public identifier - share it freely</li>
                    <li>This session is secured with your private key</li>
                    <li>You're in control of your identity - no central server</li>
                    <li>Use this identity across the entire coherosphere</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
