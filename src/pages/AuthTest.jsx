import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

export default function AuthTest() {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Nostr Auth State
  const [apiUrl, setApiUrl] = useState('https://api.coherosphere.io/api/auth/session');
  const [nostrOutput, setNostrOutput] = useState('–');

  const addResult = (test, success, message, data = null) => {
    setTestResults(prev => [...prev, {
      test,
      success,
      message,
      data,
      timestamp: new Date().toISOString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testAuthMe = async () => {
    setIsRunning(true);
    try {
      const user = await base44.auth.me();
      addResult('base44.auth.me()', true, 'User fetched successfully', user);
    } catch (error) {
      addResult('base44.auth.me()', false, `Error: ${error.message}`, { error: error.message });
    }
    setIsRunning(false);
  };

  const testIsAuthenticated = async () => {
    setIsRunning(true);
    try {
      const isAuth = await base44.auth.isAuthenticated();
      addResult('base44.auth.isAuthenticated()', true, `Result: ${isAuth}`, { isAuthenticated: isAuth });
    } catch (error) {
      addResult('base44.auth.isAuthenticated()', false, `Error: ${error.message}`, { error: error.message });
    }
    setIsRunning(false);
  };

  const testSessionStorage = () => {
    try {
      const userCache = sessionStorage.getItem('coherosphere_user_cache');
      const authStatus = sessionStorage.getItem('coherosphere_auth_status');
      
      addResult('SessionStorage Check', true, 'Cache checked', {
        hasUserCache: !!userCache,
        authStatus,
        userCache: userCache ? JSON.parse(userCache) : null
      });
    } catch (error) {
      addResult('SessionStorage Check', false, `Error: ${error.message}`, { error: error.message });
    }
  };

  const testLogout = async () => {
    setIsRunning(true);
    try {
      await base44.auth.logout();
      addResult('base44.auth.logout()', true, 'Logout triggered');
    } catch (error) {
      addResult('base44.auth.logout()', false, `Error: ${error.message}`, { error: error.message });
    }
    setIsRunning(false);
  };

  const testRedirectToLogin = () => {
    try {
      base44.auth.redirectToLogin('/AuthTest');
      addResult('base44.auth.redirectToLogin()', true, 'Redirect triggered');
    } catch (error) {
      addResult('base44.auth.redirectToLogin()', false, `Error: ${error.message}`, { error: error.message });
    }
  };

  const runAllTests = async () => {
    clearResults();
    await testIsAuthenticated();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testAuthMe();
    await new Promise(resolve => setTimeout(resolve, 500));
    testSessionStorage();
  };

  // Nostr Auth Functions (NIP-07 + NIP-98)
  const logNostr = (obj) => {
    setNostrOutput(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
  };

  const sha256Hex = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const nostrSignIn = async () => {
    const url = apiUrl;
    const method = "POST";
    const body = JSON.stringify({ ts: Date.now() });

    if (!window.nostr || !window.nostr.signEvent) {
      logNostr("Kein NIP-07 Signer gefunden. Bitte z.B. nos2x oder Alby aktivieren.");
      return;
    }

    try {
      const payload = await sha256Hex(body);
      const event = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["u", url],
          ["method", method],
          ["payload", payload],
        ],
        content: "",
      };

      const signed = await window.nostr.signEvent(event);
      const authHeader = "Nostr " + btoa(JSON.stringify(signed));

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
      logNostr({ status: resp.status, data });
    } catch (error) {
      logNostr({ error: error.message });
    }
  };

  const nostrGetSession = async () => {
    const url = apiUrl;
    try {
      const resp = await fetch(url, { method: "GET", credentials: "include" });
      const data = await resp.json().catch(() => ({}));
      logNostr({ status: resp.status, data });
    } catch (error) {
      logNostr({ error: error.message });
    }
  };

  const nostrLogout = async () => {
    const url = apiUrl;
    try {
      const resp = await fetch(url, { method: "DELETE", credentials: "include" });
      const data = await resp.json().catch(() => ({}));
      logNostr({ status: resp.status, data });
    } catch (error) {
      logNostr({ error: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Authentication Test Suite
          </h1>
          <p className="text-slate-400">
            Test base44 SDK auth + Nostr Sign-In (NIP-07 + NIP-98)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Base44 SDK Tests */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Base44 SDK Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={runAllTests}
                    disabled={isRunning}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Run All
                  </Button>
                  
                  <Button
                    onClick={testIsAuthenticated}
                    disabled={isRunning}
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                  >
                    isAuthenticated()
                  </Button>

                  <Button
                    onClick={testAuthMe}
                    disabled={isRunning}
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                  >
                    auth.me()
                  </Button>

                  <Button
                    onClick={testSessionStorage}
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                  >
                    SessionStorage
                  </Button>

                  <Button
                    onClick={testLogout}
                    disabled={isRunning}
                    variant="outline"
                    className="border-red-600 text-red-400"
                  >
                    Logout
                  </Button>

                  <Button
                    onClick={testRedirectToLogin}
                    variant="outline"
                    className="border-blue-600 text-blue-400"
                  >
                    Redirect Login
                  </Button>

                  <Button
                    onClick={clearResults}
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Test Results */}
            {testResults.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Results ({testResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {testResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          result.success
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {result.success ? '✅' : '❌'}
                            </span>
                            <span className="font-bold text-white">{result.test}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <div className="text-slate-300 mb-2">{result.message}</div>
                        
                        {result.data && (
                          <details className="mt-3">
                            <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                              Show Data
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-300 overflow-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Nostr Auth Tests */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Nostr Sign-In (NIP-07 + NIP-98)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">API URL:</label>
                  <Input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={nostrSignIn}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Sign in with Nostr
                  </Button>

                  <Button
                    onClick={nostrGetSession}
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                  >
                    Session prüfen (GET)
                  </Button>

                  <Button
                    onClick={nostrLogout}
                    variant="outline"
                    className="border-red-600 text-red-400"
                  >
                    Logout (DELETE)
                  </Button>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <strong className="text-blue-400">Hinweis:</strong>
                  <ul className="text-slate-300 text-sm mt-2 space-y-1 list-disc list-inside">
                    <li>Ein NIP-07 Signer (z.B. <em>nos2x</em>, <em>Alby</em>) muss im Browser aktiv sein.</li>
                    <li>Diese Seite sollte unter <code className="bg-slate-900/50 px-1 py-0.5 rounded">http://localhost:5173</code> laufen, damit CORS mit <code className="bg-slate-900/50 px-1 py-0.5 rounded">APP_ORIGIN</code> passt.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-bold mb-2">Output</h3>
                  <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-auto text-xs max-h-[400px]">
                    {nostrOutput}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-blue-400 font-bold mb-2">ℹ️ Info</h3>
          <p className="text-slate-300 text-sm">
            This page bypasses all authentication layers (UserContext, AuthGuard) 
            and directly tests authentication methods. Left: base44 SDK tests. Right: Nostr NIP-07 + NIP-98 tests.
          </p>
        </div>
      </div>
    </div>
  );
}