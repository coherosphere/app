
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Key, 
    Lock,
    X,
    Eye,
    EyeOff,
    Loader2,
    AlertTriangle
} from 'lucide-react';

// Import bech32 codec (vendored)
import { decode as bech32Decode, fromWords } from '../lib/codec/bech32.js';

// Decryption utilities
async function decryptNsec(encryptedData, password) {
    try {
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new Uint8Array(encryptedData.salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: new Uint8Array(encryptedData.iv)
            },
            derivedKey,
            new Uint8Array(encryptedData.encrypted)
        );
        
        return new TextDecoder().decode(decryptedData);
    } catch (error) {
        console.log('[LocalKeypairSignIn] Decryption failed (likely wrong password)');
        throw new Error('Failed to decrypt. Wrong password?');
    }
}

// Load encrypted data from IndexedDB
async function loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CoherosphereNostrKeys', 2);
        
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (event.oldVersion === 1) {
                if (db.objectStoreNames.contains('keys')) {
                    db.deleteObjectStore('keys');
                }
            }
            
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('keys')) {
                db.close();
                reject(new Error('No keys stored locally'));
                return;
            }
            
            const transaction = db.transaction(['keys'], 'readonly');
            const store = transaction.objectStore('keys');
            const getRequest = store.get('current');
            
            getRequest.onsuccess = () => {
                const key = getRequest.result;
                db.close();
                
                if (!key) {
                    reject(new Error('No keys stored locally'));
                    return;
                }
                
                resolve(key);
            };
            
            getRequest.onerror = () => {
                db.close();
                reject(new Error('Failed to load keys'));
            };
        };
    });
}

// Convert bytes to hex
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export default function LocalKeypairSignInModal({ isOpen, onClose, onSignIn }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignIn = async () => {
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Load encrypted data from IndexedDB
            const encryptedData = await loadFromIndexedDB();
            
            // Decrypt nsec with password
            const nsec = await decryptNsec(encryptedData, password);
            
            // Decode nsec using bech32
            const decoded = bech32Decode(nsec, 'bech32');
            
            if (!decoded || decoded.hrp !== 'nsec') {
                throw new Error('Invalid nsec format');
            }
            
            // Convert 5-bit words to 8-bit bytes (private key)
            const privateKeyArray = fromWords(decoded.data);
            
            if (!privateKeyArray || privateKeyArray.length !== 32) {
                throw new Error('Invalid private key length');
            }
            
            // Convert to Uint8Array if needed
            const privateKeyBytes = privateKeyArray instanceof Uint8Array 
                ? privateKeyArray 
                : new Uint8Array(privateKeyArray);
            
            // Convert to hex for backend
            const privateKeyHex = bytesToHex(privateKeyBytes);
            
            // Call parent sign-in handler with hex private key
            onSignIn(privateKeyHex);
            
        } catch (err) {
            if (err.message?.includes('Wrong password') || err.message?.includes('decrypt')) {
                setError('Wrong password. Please try again.');
            } else if (err.message?.includes('No keys stored')) {
                setError('No keys found. Please generate or import keys first.');
            } else {
                setError(err.message || 'Failed to sign in. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Card className="bg-slate-800/95 backdrop-blur-sm border-slate-700">
                        <CardHeader className="relative pb-6 border-b border-slate-700">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-700"
                                onClick={onClose}
                            >
                                <X className="w-5 h-5 text-white" />
                            </Button>
                            
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                    <Key className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl text-white leading-tight">
                                        Sign In with Local Keypair
                                    </CardTitle>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Enter your password to unlock your locally stored Nostr keypair
                            </p>
                        </CardHeader>
                        
                        <CardContent className="p-6 space-y-6">
                            {/* Password Input */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-white" />
                                    Password
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isLoading) {
                                                handleSignIn();
                                            }
                                        }}
                                        placeholder="Enter your password"
                                        className="pl-4 pr-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white hover:text-white hover:bg-slate-700"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={isLoading}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3"
                                >
                                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-red-400 text-sm leading-relaxed">{error}</p>
                                </motion.div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button
                                    onClick={onClose}
                                    variant="outline"
                                    disabled={isLoading}
                                    className="flex-1 btn-secondary-coherosphere"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSignIn}
                                    disabled={isLoading || !password}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                                            Signing In...
                                        </>
                                    ) : (
                                        <>
                                            <Key className="w-4 h-4 mr-2 text-white" />
                                            Sign In
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Security Note */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-200 leading-relaxed">
                                        Your private key is decrypted locally and used to sign the authentication request. It never leaves your device.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
