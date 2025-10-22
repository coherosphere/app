
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import { base44 } from '@/api/base44Client';
import NostrKeyGeneratorModal from '@/components/auth/NostrKeyGeneratorModal';
import LocalKeypairSignInModal from '@/components/auth/LocalKeypairSignInModal';
import ImportKeypairModal from '@/components/auth/ImportKeypairModal';

// Check if keypair exists in IndexedDB and return npub if found
async function checkLocalKeypair() {
  return new Promise((resolve) => {
    const request = indexedDB.open('CoherosphereNostrKeys', 2); // Version 2 from NostrKeyGeneratorModal

    request.onerror = () => {
      console.error('IndexedDB error for CoherosphereNostrKeys:', request.error);
      resolve({ hasKeypair: false, npub: null });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('keys')) {
        db.close();
        resolve({ hasKeypair: false, npub: null });
        return;
      }

      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const getRequest = store.get('current');

      getRequest.onsuccess = () => {
        const key = getRequest.result;
        db.close();
        // Check if key exists and has an npub property
        if (key && key.npub) {
          resolve({ hasKeypair: true, npub: key.npub });
        } else {
          resolve({ hasKeypair: false, npub: null });
        }
      };

      getRequest.onerror = () => {
        console.error('Failed to get key from IndexedDB:', getRequest.error);
        db.close();
        resolve({ hasKeypair: false, npub: null });
      };
    };

    request.onupgradeneeded = (event) => {
      // If an upgrade is needed, it means the store might not exist or schema changed.
      // For this check, we resolve false and let the main app handle creation.
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keys')) {
        // The object store doesn't exist yet, so no key is present.
        resolve({ hasKeypair: false, npub: null });
      } else {
        // If it exists but an upgrade is happening for other reasons,
        // we can still assume no key is directly retrievable for this check.
        resolve({ hasKeypair: false, npub: null });
      }
    };
  });
}

// Unicode-safe base64 encoding - WICHTIG für Mobile!
function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export default function NostrPage() {
  const { iconConfigs } = useAllIconConfigs();
  const navigate = useNavigate();
  const [output, setOutput] = useState('–');
  const [isLoading, setIsLoading] = useState(false);

  // Authentication Flow State
  const [authStep, setAuthStep] = useState('select'); // 'select', 'requesting_challenge', 'signing_event', 'verifying', 'success', 'error'
  const [authMethod, setAuthMethod] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [authResult, setAuthResult] = useState(null);

  // API Configuration
  const [nostrApiUrl, setNostrApiUrl] = useState(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Availability checks
  const [hasNIP07, setHasNIP07] = useState(false);
  const [hasLocalKeypair, setHasLocalKeypair] = useState(false);
  const [localKeypairNpub, setLocalKeypairNpub] = useState(null);

  // Session status
  const [hasSession, setHasSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showLocalSignInModal, setShowLocalSignInModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Load NOSTR_API from backend on mount
  useEffect(() => {
    const loadNostrApi = async () => {
      try {
        const response = await base44.functions.invoke('getNostrApiConfig');
        const apiFromBackend = response.data?.nostrApiUrl;

        if (apiFromBackend) {
          setNostrApiUrl(apiFromBackend);
          log({ config_loaded: true, api_url: apiFromBackend });
        } else {
          throw new Error("No API from backend");
        }
      } catch (error) {
        // Check if mobile device
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          // On mobile: show error, don't use localhost fallback
          setAuthStep('error');
          setErrorMessage('⚠️ No Nostr API configured for mobile. Localhost is not available on mobile devices. Please configure NOSTR_API in environment settings.');
          log({ config_error: 'No API configured for mobile', using_fallback: false });
        } else {
          // On desktop: use localhost fallback for development
          const fallbackUrl = 'http://localhost:3000/api/auth/session';
          setNostrApiUrl(fallbackUrl);
          log({ config_error: error.message, using_fallback: true, fallback_url: fallbackUrl });
        }
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadNostrApi();
  }, []);

  // Check session on mount after API URL is loaded
  useEffect(() => {
    const checkInitialSession = async () => {
      if (!nostrApiUrl) return; // Wait for nostrApiUrl to be set
      
      setIsCheckingSession(true);
      try {
        const resp = await fetch(nostrApiUrl, {
          method: "GET",
          credentials: "include"
        });
        const data = await resp.json().catch(() => ({}));
        
        // Check if session exists (status 200 and has ok/pubkey)
        if (resp.status === 200 && (data.ok || data.pubkey)) {
          setHasSession(true);
          log({ initial_session_check: 'active', data });
        } else {
          setHasSession(false);
          log({ initial_session_check: 'no_session', status: resp.status });
        }
      } catch (error) {
        // CORS errors are expected in development/editor - silently ignore
        setHasSession(false);
        // Don't log CORS errors in debug output, only real network/API errors
        if (!error.message.includes('fetch') && !error.message.includes('CORS')) {
          log({ initial_session_check_error: error.message });
        }
      } finally {
        setIsCheckingSession(false);
      }
    };

    if (nostrApiUrl) {
      checkInitialSession();
    }
  }, [nostrApiUrl]);

  // Check for NIP-07 extension and local keypair
  useEffect(() => {
    const checkAvailability = async () => {
      // Check NIP-07
      setHasNIP07(!!window.nostr?.signEvent);

      // Check local keypair
      const result = await checkLocalKeypair(); // Get the object
      setHasLocalKeypair(result.hasKeypair);
      setLocalKeypairNpub(result.npub); // Set npub
    };

    checkAvailability();

    // Listen for keypair changes
    const handleKeypairChange = async () => { // Made async to await checkLocalKeypair
      const result = await checkLocalKeypair(); // Get the object
      setHasLocalKeypair(result.hasKeypair);
      setLocalKeypairNpub(result.npub); // Set npub
    };

    // Assuming custom events 'localKeypairSaved' and 'localKeypairDeleted' are dispatched by modals
    window.addEventListener('localKeypairSaved', handleKeypairChange);
    window.addEventListener('localKeypairDeleted', handleKeypairChange);

    return () => {
      window.removeEventListener('localKeypairSaved', handleKeypairChange);
      window.removeEventListener('localKeypairDeleted', handleKeypairChange);
    };
  }, []);

  const log = (obj) => {
    setOutput(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
  };

  const resetFlow = () => {
    setAuthStep('select');
    setAuthMethod(null);
    setErrorMessage('');
    setAuthResult(null);
    setOutput('–');
  };

  // SHA-256 helper for payload hash
  const sha256Hex = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  // Sign in with NIP-07 (Browser Extension) using NIP-98 HTTP Auth
  const signWithNIP07 = async () => {
    setAuthMethod('nip07');

    if (!window.nostr || !window.nostr.signEvent) {
      setErrorMessage('❌ No NIP-07 signer found. Please install nos2x or Alby browser extension.');
      setAuthStep('error');
      return;
    }

    if (!nostrApiUrl) {
      setErrorMessage('❌ API URL not configured');
      setAuthStep('error');
      return;
    }

    // New step: preparing challenge/event
    setAuthStep('requesting_challenge');
    setIsLoading(true);

    try {
      const url = nostrApiUrl;
      const method = "POST";
      const body = JSON.stringify({ ts: Date.now() });

      // Create payload hash (NIP-98)
      const payload = await sha256Hex(body);

      // Create unsigned event (kind 27235 for HTTP Auth as per NIP-98)
      const unsignedEvent = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["u", url],
          ["method", method],
          ["payload", payload],
        ],
        content: "",
      };

      log({ step: 'preparing_event_for_nip07', event: unsignedEvent });

      // New step: Signing event
      setAuthStep('signing_event');

      // Sign with browser extension
      const signedEvent = await window.nostr.signEvent(unsignedEvent);

      log({ step: 'signed_event_from_nip07', event: signedEvent });

      // Send to API
      setAuthStep('verifying');

      // WICHTIG: base64Utf8() statt btoa() für Unicode-Sicherheit
      const authHeader = "Nostr " + base64Utf8(JSON.stringify(signedEvent));

      const resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body,
        credentials: "include",
      });

      const data = await resp.json().catch(() => ({}));

      log({ step: 'api_response', status: resp.status, data });

      if (resp.status === 200 || resp.status === 201) {
        // Ensure NostrUser exists in database
        try {
          const userResponse = await base44.functions.invoke('ensureNostrUser', {
            pubkey: data.pubkey,
            name: data.name,
            bio: data.bio,
            picture: data.picture
          });
          log({ step: 'user_ensured', action: userResponse.data.action });
        } catch (userError) {
          // Silently fail - don't break the login flow. Warn the developer.
          console.warn('[Nostr] Failed to ensure NostrUser (expected in editor if DB is not connected):', userError.message);
        }

        setAuthResult(data);
        setAuthStep('success');
        setHasSession(true);
        
        // Dispatch event for layout to update menu
        window.dispatchEvent(new CustomEvent('nostrSessionChanged', { detail: { hasSession: true } }));
      } else {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

    } catch (error) {
      // Better error messages for CORS issues in the editor
      if (error.message.includes('fetch') || error.message.includes('CORS')) {
        setErrorMessage('⚠️ CORS error - This is expected in the editor if you\'re not running it from the production domain. Deploy to production to test fully.');
      } else {
        setErrorMessage(`NIP-07 signing failed: ${error.message}`);
      }
      setAuthStep('error');
      log({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Local Keypair Sign-In
  const handleLocalKeypairSignIn = async (nsec) => {
    setAuthMethod('local');
    setShowLocalSignInModal(false);

    if (!nostrApiUrl) {
      setErrorMessage('❌ API URL not configured');
      setAuthStep('error');
      return;
    }

    // New step: preparing challenge/event
    setAuthStep('requesting_challenge');
    setIsLoading(true);

    try {
      const url = nostrApiUrl;
      const method = "POST";
      const body = JSON.stringify({ ts: Date.now() });

      // Create payload hash
      const payload = await sha256Hex(body);

      // Create unsigned event
      const unsignedEvent = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["u", url],
          ["method", method],
          ["payload", payload],
        ],
        content: "",
      };

      log({ step: 'preparing_event_for_local_signing', event: unsignedEvent });

      // New step: Signing event
      setAuthStep('signing_event');

      // Sign with backend function
      const signResponse = await base44.functions.invoke('signNostrEvent', {
        unsigned_event: unsignedEvent,
        private_key_hex: nsec
      });

      if (signResponse.data.error) {
        throw new Error(signResponse.data.error);
      }

      const signedEvent = signResponse.data.signed_event;
      log({ step: 'signed_event_from_local_keypair', event: signedEvent });

      // Send to API
      setAuthStep('verifying');

      // WICHTIG: base64Utf8() statt btoa() für Unicode-Sicherheit
      const authHeader = "Nostr " + base64Utf8(JSON.stringify(signedEvent));

      const resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body,
        credentials: "include",
      });

      const data = await resp.json().catch(() => ({}));

      log({ step: 'api_response', status: resp.status, data });

      if (resp.status === 200 || resp.status === 201) {
        // Ensure NostrUser exists in database
        try {
          const userResponse = await base44.functions.invoke('ensureNostrUser', {
            pubkey: data.pubkey,
            name: data.name,
            bio: data.bio,
            picture: data.picture
          });
          log({ step: 'user_ensured', action: userResponse.data.action });
        } catch (userError) {
          // Silently fail - don't break the login flow. Warn the developer.
          console.warn('[Nostr] Failed to ensure NostrUser (expected in editor if DB is not connected):', userError.message);
        }

        setAuthResult(data);
        setAuthStep('success');
        setHasSession(true);
        
        // Dispatch event for layout to update menu
        window.dispatchEvent(new CustomEvent('nostrSessionChanged', { detail: { hasSession: true } }));
      } else {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

    } catch (error) {
      setErrorMessage(`Local keypair signing failed: ${error.message}`);
      setAuthStep('error');
      log({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Open Local Keypair Modal
  const openLocalKeypairModal = () => {
    setShowLocalSignInModal(true);
  };

  // Handle Generate Keys
  const handleGenerateKeys = (keys) => {
    setAuthMethod('generate');
    setShowGenerateModal(false);
    // Automatically sign in with generated keys
    handleLocalKeypairSignIn(keys.nsec);
  };

  // Handle Import Keys
  const handleImportKeys = (nsec) => {
    setAuthMethod('import');
    setShowImportModal(false);
    // Automatically sign in with imported keys
    handleLocalKeypairSignIn(nsec);
  };

  // Check session status
  const checkSession = async () => {
    if (!nostrApiUrl) {
      log({ error: 'API URL not configured' });
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch(nostrApiUrl, {
        method: "GET",
        credentials: "include" // WICHTIG für Cookie!
      });
      const data = await resp.json().catch(() => ({}));
      log({ step: 'session_check', status: resp.status, data });
      
      // Update session status - check for ok or pubkey
      if (resp.status === 200 && (data.ok || data.pubkey)) {
        setHasSession(true);
      } else {
        setHasSession(false);
      }
    } catch (error) {
      log({ error: error.message });
      setHasSession(false); // Assume no session on error
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    if (!nostrApiUrl) {
      log({ error: 'API URL not configured' });
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch(nostrApiUrl, {
        method: "DELETE",
        credentials: "include"
      });
      const data = await resp.json().catch(() => ({}));
      log({ step: 'logout', status: resp.status, data });
      
      // Update session status
      setHasSession(false);
      
      // Dispatch event for layout to update menu
      window.dispatchEvent(new CustomEvent('nostrSessionChanged', { detail: { hasSession: false } }));
      
      // Reset authentication flow
      resetFlow();
    } catch (error) {
      log({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Progress indicator
  const getProgressPercentage = () => {
    switch (authStep) {
      case 'select': return 0; // Initial state, or after reset
      case 'requesting_challenge': return 25;
      case 'signing_event': return 50;
      case 'verifying': return 75;
      case 'success': return 100;
      case 'error': return 0; // Error resets progress
      default: return 0;
    }
  };

  // Show loading state while fetching config
  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-slate-700/50 rounded-full animate-pulse" />
              <div>
                <div className="h-10 w-64 bg-slate-700/50 rounded animate-pulse mb-2" />
                <div className="w-16 h-1 bg-slate-700/50 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-96 bg-slate-700/50 rounded animate-pulse" />
          </div>

          {/* Session Management Skeleton */}
          <div className="mb-6">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardHeader>
                <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="h-10 w-32 bg-slate-700/50 rounded animate-pulse" />
                  <div className="h-10 w-24 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Skeleton */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <div className="h-6 w-56 bg-slate-700/50 rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-32 bg-slate-700/50 rounded animate-pulse" />
              <div className="h-32 bg-slate-700/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
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
                iconName="Zap"
                iconConfig={iconConfigs['Zap']}
                size="w-6 h-6"
                fallbackColor="text-white"
              />
            </div>
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                Nostr Authentication
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
          <p className="text-lg text-slate-400 leading-relaxed">
            Secure authentication using Nostr protocol (NIP-07 & NIP-98)
          </p>
        </motion.div>

        {/* Session Management - ALWAYS VISIBLE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ConfiguredIcon
                  iconName="Settings"
                  iconConfig={iconConfigs['Settings']}
                  size="w-5 h-5"
                  fallbackColor="text-slate-400"
                />
                Session Management
                {(isCheckingSession || isLoading) && (
                  <div className="ml-2 w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={checkSession}
                  disabled={isLoading || isCheckingSession}
                  className={`${
                    hasSession 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <ConfiguredIcon
                    iconName="RefreshCcw"
                    iconConfig={iconConfigs['RefreshCcw']}
                    size="w-4 h-4"
                    fallbackColor={hasSession ? "text-white" : "text-slate-500"}
                    className="mr-2"
                  />
                  {hasSession ? 'Check Session' : 'No Session'}
                </Button>
                <Button
                  onClick={logout}
                  disabled={!hasSession || isLoading || isCheckingSession}
                  className={`${
                    hasSession 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <ConfiguredIcon
                    iconName="LogOut"
                    iconConfig={iconConfigs['LogOut']}
                    size="w-4 h-4"
                    fallbackColor={hasSession ? "text-white" : "text-slate-500"}
                    className="mr-2"
                  />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Authentication Progress */}
        {(authStep === 'requesting_challenge' || authStep === 'signing_event' || authStep === 'verifying') && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">
                    Authentication Progress
                  </span>
                  <span className="text-sm text-slate-400">
                    {getProgressPercentage()}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${getProgressPercentage()}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {authStep === 'requesting_challenge' && 'Preparing authentication event...'}
                  {authStep === 'signing_event' && 'Signing authentication event... (check your wallet/extension)'}
                  {authStep === 'verifying' && 'Verifying signature with coherosphere API...'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Method Selection */}
          {authStep === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ConfiguredIcon
                      iconName="UserCircle"
                      iconConfig={iconConfigs['UserCircle']}
                      size="w-5 h-5"
                      fallbackColor="text-orange-500"
                    />
                    Choose Authentication Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT COLUMN: NIP-07 Browser Extension */}
                    <button
                      onClick={signWithNIP07}
                      disabled={!hasNIP07}
                      className={`group p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl transition-all duration-300 text-left relative ${
                        hasNIP07
                          ? 'hover:border-purple-500/50 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3">
                        {hasNIP07 ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50 flex items-center gap-1">
                            <ConfiguredIcon
                              iconName="CheckCircle"
                              iconConfig={iconConfigs['CheckCircle']}
                              size="w-3 h-3"
                              fallbackColor="text-green-400"
                            />
                            Available
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/50 flex items-center gap-1">
                            <ConfiguredIcon
                              iconName="XCircle"
                              iconConfig={iconConfigs['XCircle']}
                              size="w-3 h-3"
                              fallbackColor="text-red-400"
                            />
                            Not Found
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                          hasNIP07 ? 'group-hover:scale-110' : ''
                        }`}>
                          <ConfiguredIcon
                            iconName="Zap"
                            iconConfig={iconConfigs['Zap']}
                            size="w-6 h-6"
                            fallbackColor="text-purple-400"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-white font-semibold mb-1">Browser Extension</h3>
                          <p className="text-slate-400 text-sm mb-2">
                            Sign in with nos2x or Alby extension
                          </p>
                          <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                            NIP-07
                          </Badge>
                        </div>
                      </div>
                    </button>

                    {/* RIGHT COLUMN: Local Keypair Management */}
                    <div className="space-y-4">
                      {/* Local Keypair */}
                      <button
                        onClick={openLocalKeypairModal}
                        disabled={!hasLocalKeypair}
                        className={`w-full group p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-xl transition-all duration-300 text-left relative ${
                          hasLocalKeypair
                            ? 'hover:border-blue-500/50 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                          {hasLocalKeypair ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50 flex items-center gap-1">
                              <ConfiguredIcon
                                iconName="CheckCircle"
                                iconConfig={iconConfigs['CheckCircle']}
                                size="w-3 h-3"
                                fallbackColor="text-green-400"
                              />
                              Stored
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 flex items-center gap-1">
                              <ConfiguredIcon
                                iconName="AlertCircle"
                                iconConfig={iconConfigs['AlertCircle']}
                                size="w-3 h-3"
                                fallbackColor="text-orange-400"
                              />
                              Not Stored
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                            hasLocalKeypair ? 'group-hover:scale-110' : ''
                          }`}>
                            <ConfiguredIcon
                              iconName="Key"
                              iconConfig={iconConfigs['Key']}
                              size="w-6 h-6"
                              fallbackColor="text-blue-400"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">Local Keypair</h3>
                            <p className="text-slate-400 text-sm mb-2">
                              Sign in with your nsec key
                            </p>
                            {hasLocalKeypair && localKeypairNpub ? (
                              <div className="mb-2">
                                <code className="text-xs text-blue-300 bg-blue-500/10 px-2 py-1 rounded">
                                  {localKeypairNpub.substring(0, 12)}...{localKeypairNpub.substring(localKeypairNpub.length - 6)}
                                </code>
                              </div>
                            ) : null}
                            <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                              Secure
                            </Badge>
                          </div>
                        </div>
                      </button>

                      {/* Generate New Keys */}
                      <button
                        onClick={() => setShowGenerateModal(true)}
                        className="w-full group p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl hover:border-green-500/50 transition-all duration-300 text-left"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <ConfiguredIcon
                              iconName="Sparkles"
                              iconConfig={iconConfigs['Sparkles']}
                              size="w-6 h-6"
                              fallbackColor="text-green-400"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">Generate New Keys</h3>
                            <p className="text-slate-400 text-sm mb-2">
                              Create a new Nostr identity
                            </p>
                            <Badge variant="outline" className="border-green-500/50 text-green-400">
                              New User
                            </Badge>
                          </div>
                        </div>
                      </button>

                      {/* Import Keys */}
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="w-full group p-6 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-2 border-orange-500/30 rounded-xl hover:border-orange-500/50 transition-all duration-300 text-left"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <ConfiguredIcon
                              iconName="Download"
                              iconConfig={iconConfigs['Download']}
                              size="w-6 h-6"
                              fallbackColor="text-orange-400"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">Import Keys</h3>
                            <p className="text-slate-400 text-sm mb-2">
                              Import existing Nostr keys
                            </p>
                            <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                              Advanced
                            </Badge>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <ConfiguredIcon
                      iconName="Info"
                      iconConfig={iconConfigs['Info']}
                      size="w-5 h-5"
                      fallbackColor="text-blue-400"
                      className="flex-shrink-0 mt-0.5"
                    />
                    <div className="text-sm text-slate-300 space-y-1">
                      <p><strong className="text-white">About Nostr Authentication:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Nostr is a decentralized protocol for social networking</li>
                        <li>Your keys are your identity - keep your nsec safe!</li>
                        <li>Browser extensions provide the most secure signing method</li>
                        <li>Never share your private key (nsec) with anyone</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Loading States */}
          {(authStep === 'requesting_challenge' || authStep === 'signing_event' || authStep === 'verifying') && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-6">
                <CardContent className="p-8 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <ConfiguredIcon
                      iconName={authStep === 'verifying' ? 'Shield' : 'Edit'}
                      iconConfig={iconConfigs[authStep === 'verifying' ? 'Shield' : 'Edit']}
                      size="w-8 h-8"
                      fallbackColor="text-orange-400"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-slate-300 mb-2">
                    {authStep === 'requesting_challenge' && 'Preparing Authentication Event...'}
                    {authStep === 'signing_event' && 'Signing Event...'}
                    {authStep === 'verifying' && 'Verifying Signature...'}
                  </h3>
                  <p className="text-slate-400 text-center max-w-md">
                    {authStep === 'requesting_challenge' && 'Building the event payload for signing...'}
                    {authStep === 'signing_event' && 'Please confirm the signature request in your wallet or extension'}
                    {authStep === 'verifying' && 'Verifying your signature with the coherosphere API'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Success State */}
          {authStep === 'success' && authResult && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-6">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
                      <ConfiguredIcon
                        iconName="CheckCircle"
                        iconConfig={iconConfigs['CheckCircle']}
                        size="w-10 h-10"
                        fallbackColor="text-white"
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-300 mb-2">
                      Authentication Successful!
                    </h3>
                    <p className="text-slate-400 mb-6 max-w-md">
                      You have been successfully authenticated with Nostr
                    </p>

                    <Button
                      onClick={() => navigate('/NostrProfile')}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    >
                      <ConfiguredIcon
                        iconName="UserCircle"
                        iconConfig={iconConfigs['UserCircle']}
                        size="w-4 h-4"
                        fallbackColor="text-white"
                        className="mr-2"
                      />
                      Go to my Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Error State */}
          {authStep === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-red-500/10 border-red-500/30 mb-6">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                      <ConfiguredIcon
                        iconName="AlertCircle"
                        iconConfig={iconConfigs['AlertCircle']}
                        size="w-10 h-10"
                        fallbackColor="text-red-400"
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Authentication Failed
                    </h3>
                    <p className="text-red-400 mb-6 max-w-md">
                      {errorMessage}
                    </p>

                    <div className="flex gap-3">
                      <Button
                        onClick={resetFlow}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                      >
                        <ConfiguredIcon
                          iconName="RotateCcw"
                          iconConfig={iconConfigs['RotateCcw']}
                          size="w-4 h-4"
                          fallbackColor="text-white"
                          className="mr-2"
                        />
                        Try Again
                      </Button>
                      <Button
                        onClick={() => window.location.href = '/FAQ'}
                        className="btn-secondary-coherosphere"
                      >
                        Get Help
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Protocol Info - Always visible at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 mb-6"
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <ConfiguredIcon
                  iconName="BookOpen"
                  iconConfig={iconConfigs['BookOpen']}
                  size="w-5 h-5"
                  fallbackColor="text-orange-500"
                />
                Protocol Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* NIP-07 */}
              <div className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 flex-shrink-0 text-sm">
                  NIP-07
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm">Browser extension signing interface</p>
                </div>
              </div>

              {/* NIP-98 */}
              <div className="flex items-center gap-3 p-3 bg-pink-500/5 border border-pink-500/20 rounded-lg">
                <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 flex-shrink-0 text-sm">
                  NIP-98
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm">HTTP Auth using Nostr signatures (kind 27235)</p>
                </div>
              </div>

              {/* Direct API */}
              <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 flex-shrink-0 text-sm">
                  Direct API
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm">No relay - direct HTTPS authentication</p>
                </div>
              </div>

              {/* API Endpoint */}
              {nostrApiUrl && (
                <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex-shrink-0 text-sm">
                    API
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <code className="text-green-300 text-sm break-all">{nostrApiUrl}</code>
                  </div>
                </div>
              )}
            </CardContent>
            </Card>
        </motion.div>

        {/* Output Terminal - ALWAYS VISIBLE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ConfiguredIcon
                  iconName="Terminal"
                  iconConfig={iconConfigs['Terminal']}
                  size="w-5 h-5"
                  fallbackColor="text-green-500"
                />
                Debug Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-950 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
                {output}
              </pre>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modals */}
      <NostrKeyGeneratorModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onKeysGenerated={handleGenerateKeys}
      />

      <LocalKeypairSignInModal
        isOpen={showLocalSignInModal}
        onClose={() => setShowLocalSignInModal(false)}
        onSignIn={handleLocalKeypairSignIn}
      />

      <ImportKeypairModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportKeys}
      />
    </div>
  );
}
