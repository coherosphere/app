
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NewChatModal from '@/components/messages/NewChatModal';
import BlockConfirmationModal from '@/components/messages/BlockConfirmationModal';
import { useChatContext } from '@/components/chat/ChatContext';
import { useLoading } from '@/components/loading/LoadingContext';
import { User, Conversation, NostrMessage } from '@/api/entities';
import { useCachedData } from '@/components/caching/useCachedData';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';
import StatCard from '@/components/StatCard';

export default function MessagesPage() {
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [activeTab, setActiveTab] = useState('trusted');
    const [isSending, setIsSending] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [userJustSentMessage, setUserJustSentMessage] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const { refreshUnreadCount } = useChatContext();
    const { setLoading } = useLoading();
    const queryClient = useQueryClient();
    const { iconConfigs } = useAllIconConfigs();

    const [sectionsReady, setSectionsReady] = useState({
        stats: false,
        conversationList: false,
        messageView: false
    });

    const [conversations, setConversations] = useState([]);
    const lastConversationHashRef = useRef(null);
    const hasInitializedConversationsRef = useRef(false);

    const lastMessageHashRef = useRef(null);
    const hasInitializedMessagesRef = useRef(false);

    const [stats, setStats] = useState({
        conversations: 0,
        messages: 0,
        muted: 0,
        blocked: 0
    });

    const getMessagesLimit = () => {
        return 10;
    };

    const [messagesLimit, setMessagesLimit] = useState(getMessagesLimit());

    useEffect(() => {
        const handleResize = () => {
            const newLimit = getMessagesLimit();
            if (newLimit !== messagesLimit) {
                setMessagesLimit(newLimit);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [messagesLimit]);

    const loadUser = async () => {
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);
            return user;
        } catch (error) {
            console.error('Error loading user:', error);
            return null;
        }
    };

    // Funktion zum Aktualisieren der Stats
    const updateStatsCounts = useCallback(async () => {
        if (!currentUser || !currentUser.nostr_pubkey) return;
        
        try {
            console.log('[updateStatsCounts] Loading stats for user:', currentUser.nostr_pubkey);
            
            // Direkt aus der DB laden statt über Function (um Cache zu umgehen)
            const [allConversationsRaw, allMessagesResponse] = await Promise.all([
                base44.entities.Conversation.list(),
                base44.entities.NostrMessage.list()
            ]);
            
            // Nur Conversations des Users
            const userConversations = allConversationsRaw.filter(conv => 
                conv.user_a_npub === currentUser.nostr_pubkey || 
                conv.user_b_npub === currentUser.nostr_pubkey
            );
            
            // Filter Messages: nur die, wo User Sender ODER Empfänger ist
            const allMessages = allMessagesResponse || [];
            const userMessages = allMessages.filter(msg => 
                msg.sender_npub === currentUser.nostr_pubkey || 
                msg.recipient_npub === currentUser.nostr_pubkey
            );
            
            const isUserA = (conv) => conv.user_a_npub === currentUser.nostr_pubkey;
            
            const mutedCount = userConversations.filter(conv => 
                isUserA(conv) ? conv.muted_by_a : conv.muted_by_b
            ).length;
            
            const blockedCount = userConversations.filter(conv => 
                isUserA(conv) ? conv.blocked_by_a : conv.blocked_by_b
            ).length;

            const newStats = {
                conversations: userConversations.length,
                messages: userMessages.length,
                muted: mutedCount,
                blocked: blockedCount
            };
            
            console.log('[updateStatsCounts] New stats:', newStats);
            setStats(newStats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }, [currentUser]);

    const {
        data: conversationsData,
        isLoading: isLoadingConversations,
        error: conversationsError,
        refetch: refetchConversations
    } = useCachedData(
        ['messages', 'conversations', activeTab, currentUser?.nostr_pubkey],
        async () => {
            if (!currentUser) {
                console.log('[useCachedData] currentUser not available, skipping conversation fetch.');
                return null;
            }
            console.log('[useCachedData] Fetching conversations for tab:', activeTab, 'user:', currentUser.nostr_pubkey);
            const response = await base44.functions.invoke('getConversations', {
                tab: activeTab,
                q: ''
            });
            return response.data;
        },
        'messages',
        {
            enabled: !!currentUser,
            refetchInterval: 30000,
        }
    );

    const {
        data: messagesData,
        isLoading: isLoadingMessages,
        error: messagesError,
        refetch: refetchMessages
    } = useCachedData(
        ['messages', 'content', selectedConversation?.id, messagesLimit],
        async () => {
            if (!selectedConversation) {
                console.log('[useCachedData] No selectedConversation, skipping message fetch.');
                return null;
            }
            console.log('[useCachedData] Fetching messages for conversation:', selectedConversation.id, 'limit:', messagesLimit);
            const response = await base44.functions.invoke('getMessages', {
                conversationId: selectedConversation.id,
                limit: messagesLimit,
                before: null
            });
            return response.data;
        },
        'messages',
        {
            enabled: !!selectedConversation,
        }
    );

    const isLoading = (isLoadingConversations && !conversationsData) || (isLoadingMessages && !messagesData && selectedConversation);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await loadUser();
            } catch (error) {
                console.error('Error initializing messages:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [setLoading]);

    useEffect(() => {
        if (!conversationsData) {
            console.log('[pages/Messages.js] No conversations data in conversationsData yet, or still loading.');
            if (hasInitializedConversationsRef.current && !conversationsData) {
                hasInitializedConversationsRef.current = false;
                lastConversationHashRef.current = null;
                setConversations([]);
                setSelectedConversation(null);
                setMessages([]);
            }
            return;
        }

        console.log('[pages/Messages.js] Processing conversations data for tab:', activeTab);
        const fetchedConversations = conversationsData.conversations || [];

        const conversationHash = fetchedConversations
            .map(conv => `${conv.id}:${conv.lastAt}:${conv.unreadCount}:${conv.muted}:${conv.blocked}`)
            .join('|');

        if (!hasInitializedConversationsRef.current || fetchedConversations.length === 0) {
            console.log('[pages/Messages.js] Initial conversations load/reset for tab:', {
                count: fetchedConversations.length,
                tab: activeTab,
                hash: conversationHash.substring(0, Math.min(conversationHash.length, 50)) + (conversationHash.length > 50 ? '...' : '')
            });
            lastConversationHashRef.current = conversationHash;
            hasInitializedConversationsRef.current = true;
            setConversations(fetchedConversations);

            if (selectedConversation) {
                const stillExists = fetchedConversations.find(c => c.id === selectedConversation.id);
                if (!stillExists) {
                    console.log('[pages/Messages.js] Selected conversation not in current tab, deselecting');
                    setSelectedConversation(null);
                    setMessages([]);
                } else if (stillExists.id === selectedConversation.id && (stillExists.muted !== selectedConversation.muted || stillExists.blocked !== selectedConversation.blocked)) {
                    console.log('[pages/Messages.js] Updating selected conversation status.');
                    setSelectedConversation(stillExists);
                }
            }
            return;
        }

        if (conversationHash !== lastConversationHashRef.current) {
            console.log('[pages/Messages.js] Conversations changed:', {
                oldHash: lastConversationHashRef.current ? lastConversationHashRef.current.substring(0, Math.min(lastConversationHashRef.current.length, 50)) + (lastConversationHashRef.current.length > 50 ? '...' : '') : 'none',
                newHash: conversationHash.substring(0, Math.min(conversationHash.length, 50)) + (conversationHash.length > 50 ? '...' : ''),
                oldCount: conversations.length,
                newCount: fetchedConversations.length,
                tab: activeTab
            });
            lastConversationHashRef.current = conversationHash;
            setConversations(fetchedConversations);

            if (selectedConversation) {
                const stillExists = fetchedConversations.find(c => c.id === selectedConversation.id);
                if (!stillExists) {
                    console.log('[pages/Messages.js] Selected conversation not in current tab, deselecting');
                    setSelectedConversation(null);
                    setMessages([]);
                } else if (
                    stillExists.id === selectedConversation.id &&
                    (stillExists.muted !== selectedConversation.muted ||
                    stillExists.blocked !== selectedConversation.blocked ||
                    stillExists.lastAt !== selectedConversation.lastAt ||
                    stillExists.unreadCount !== selectedConversation.unreadCount ||
                    stillExists.lastSnippet !== selectedConversation.lastSnippet)
                ) {
                    console.log('[pages/Messages.js] Updating selected conversation details.');
                    setSelectedConversation(stillExists);
                }
            }
        } else {
            console.log('[pages/Messages.js] No conversation changes detected for tab:', activeTab, ', skipping update.');
        }
    }, [conversationsData, activeTab, selectedConversation?.id, selectedConversation?.muted, selectedConversation?.blocked, selectedConversation?.lastAt, selectedConversation?.unreadCount, selectedConversation?.lastSnippet, conversations.length]);

    useEffect(() => {
        if (selectedConversation) {
            console.log('[Messages] Conversation changed to:', selectedConversation.id);

            setMessages([]);
            setHasMoreMessages(false);
            setIsInitialLoad(true);

            hasInitializedMessagesRef.current = false;
            lastMessageHashRef.current = null;

            queryClient.invalidateQueries({
                queryKey: ['messages', 'content', selectedConversation.id]
            });
        } else {
            setMessages([]);
            setHasMoreMessages(false);
            hasInitializedMessagesRef.current = false;
            lastMessageHashRef.current = null;
        }
    }, [selectedConversation?.id, queryClient]);

    useEffect(() => {
        if (!messagesData) {
            console.log('[Messages] No messages data yet or still loading.');
            if (hasInitializedMessagesRef.current && !messagesData) {
                hasInitializedMessagesRef.current = false;
                lastMessageHashRef.current = null;
                setMessages([]);
                setHasMoreMessages(false);
            }
            return;
        }

        if (!selectedConversation) {
             console.log('[Messages] Messages data exists but no conversation is selected, ignoring.');
             return;
        }

        console.log('[Messages] Processing messages data for conversation:', selectedConversation.id, 'Count:', messagesData.messages?.length || 0);
        const fetchedMessages = messagesData.messages || [];
        const fetchedHasMore = messagesData.hasMore || false;

        const messageHash = fetchedMessages
            .map(msg => `${msg.id}:${msg.content}:${msg.createdAt}:${msg.from}`)
            .join('|');

        if (!hasInitializedMessagesRef.current) {
            console.log('[Messages] Initial messages load/reset for conversation:', {
                count: fetchedMessages.length,
                conversationId: selectedConversation.id,
                hash: messageHash.substring(0, Math.min(messageHash.length, 50)) + (messageHash.length > 50 ? '...' : '')
            });
            lastMessageHashRef.current = messageHash;
            hasInitializedMessagesRef.current = true;
            setMessages(fetchedMessages);
            setHasMoreMessages(fetchedHasMore);
            setIsInitialLoad(true);

            refreshUnreadCount();
            return;
        }

        if (messageHash !== lastMessageHashRef.current) {
            console.log('[Messages] Messages changed:', {
                oldHash: lastMessageHashRef.current ? lastMessageHashRef.current.substring(0, Math.min(lastMessageHashRef.current.length, 50)) + (lastMessageHashRef.current.length > 50 ? '...' : '') : 'none',
                newHash: messageHash.substring(0, Math.min(messageHash.length, 50)) + (messageHash.length > 50 ? '...' : ''),
                oldCount: messages.length,
                newCount: fetchedMessages.length,
                conversationId: selectedConversation.id
            });
            lastMessageHashRef.current = messageHash;
            setMessages(fetchedMessages);
            setHasMoreMessages(fetchedHasMore);
        } else {
            console.log('[Messages] No message changes detected, skipping update.');
        }
    }, [messagesData, selectedConversation?.id, refreshUnreadCount]);
    
    useEffect(() => {
        if (!currentUser || conversations.length === 0 || selectedConversation) return;

        const urlParams = new URLSearchParams(window.location.search);
        const conversationId = urlParams.get('conversationId');

        if (conversationId) {
            const targetConv = conversations.find(c => c.id === conversationId);
            if (targetConv) {
                console.log('[pages/Messages.js] Auto-selecting conversation from URL:', conversationId);
                setSelectedConversation(targetConv);
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, [currentUser, conversations, selectedConversation]);

    // Stats beim Laden und bei User-Änderungen aktualisieren
    useEffect(() => {
        if (currentUser && currentUser.nostr_pubkey) {
            console.log('[useEffect] Updating stats for user:', currentUser.nostr_pubkey);
            updateStatsCounts();
        }
    }, [currentUser, updateStatsCounts]);

    // Stats AUCH aktualisieren wenn sich Conversations ändern
    useEffect(() => {
        if (conversationsData && currentUser) {
            console.log('[useEffect] Conversations changed, updating stats');
            updateStatsCounts();
        }
    }, [conversationsData, currentUser, updateStatsCounts]);

    useEffect(() => {
        if (stats.conversations > 0 || stats.messages > 0 || stats.muted >= 0 || stats.blocked >= 0) {
            setSectionsReady(prev => ({ ...prev, stats: true }));
        }
    }, [stats]);

    useEffect(() => {
        if (!isLoadingConversations && conversationsData) {
            setSectionsReady(prev => ({ ...prev, conversationList: true }));
        }
    }, [isLoadingConversations, conversationsData]);

    useEffect(() => {
        if (!selectedConversation || (!isLoadingMessages && messagesData)) {
            setSectionsReady(prev => ({ ...prev, messageView: true }));
        }
    }, [selectedConversation, isLoadingMessages, messagesData]);

    const handleLoadOlderMessages = async () => {
        if (messages.length === 0 || isLoadingOlder || !hasMoreMessages || !selectedConversation) return;

        const container = messagesContainerRef.current;
        if (!container) return;

        const oldScrollHeight = container.scrollHeight;
        const oldScrollTop = container.scrollTop;

        const oldestMessageId = messages[0].id;
        
        setIsLoadingOlder(true);
        try {
            const response = await base44.functions.invoke('getMessages', {
                conversationId: selectedConversation.id,
                limit: messagesLimit,
                before: oldestMessageId
            });

            const olderMessages = response.data.messages || [];
            setMessages(prev => [...olderMessages, ...prev]);
            setHasMoreMessages(response.data.hasMore || false);

            setTimeout(() => {
                if (container) {
                    const newScrollHeight = container.scrollHeight;
                    const scrollDifference = newScrollHeight - oldScrollHeight;
                    container.scrollTop = oldScrollTop + scrollDifference;
                }
            }, 50);
        } catch (error) {
            console.error('Error loading older messages:', error);
        } finally {
            setIsLoadingOlder(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation || isSending) return;

        const userMessageContent = newMessage.trim();

        const tempMessageId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempMessageId,
            from: currentUser.nostr_pubkey,
            content: userMessageContent,
            createdAt: new Date().toISOString(),
            status: 'pending',
        };

        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        setNewMessage('');
        inputRef.current?.focus();

        setUserJustSentMessage(true);

        setIsSending(true);

        try {
            await base44.functions.invoke('sendNostrMessage', {
                conversationId: selectedConversation.id,
                content: userMessageContent,
                links: []
            });

            await refetchMessages();
            await refetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message: ' + error.message);
            setMessages(prevMessages => prevMessages.map(msg =>
                msg.id === tempMessageId ? { ...msg, status: 'failed' } : msg
            ));
        } finally {
            setIsSending(false);
        }
    };

    const handleMuteConversation = async () => {
        if (!selectedConversation) return;
        try {
            await base44.functions.invoke('toggleMuteConversation', {
                conversationId: selectedConversation.id
            });
            
            await refetchConversations();
            await refreshUnreadCount();
            await updateStatsCounts();
        } catch (error) {
            console.error('Error toggling mute:', error);
        }
    };

    const handleBlockConversation = async () => {
        if (!selectedConversation) return;

        if (selectedConversation.blocked) { // Unblocking
            try {
                await base44.functions.invoke('toggleBlockConversation', {
                    conversationId: selectedConversation.id
                });
                
                await refetchConversations();
                await refreshUnreadCount();
                await updateStatsCounts();
            } catch (error) {
                console.error('Error toggling block:', error);
            }
        } else { // Blocking, show confirmation modal
            setShowBlockModal(true);
        }
    };

    const handleConfirmBlock = async () => {
        setShowBlockModal(false);
        if (!selectedConversation) return;

        try {
            await base44.functions.invoke('toggleBlockConversation', {
                conversationId: selectedConversation.id
            });
            
            await refetchConversations();
            await refreshUnreadCount();
            await updateStatsCounts();
        } catch (error) {
            console.error('Error toggling block:', error);
        }
    };

    const handleConversationCreated = async (conversationId) => {
        setShowNewChatModal(false);
        await refetchConversations();

        const reloadedConversationsResponse = await base44.functions.invoke('getConversations', {
            tab: activeTab,
            q: ''
        });
        const newConv = reloadedConversationsResponse.data.conversations.find(c => c.id === conversationId);
        if (newConv) {
            setSelectedConversation(newConv);
        }

        await refreshUnreadCount();
        await updateStatsCounts(); // Update stats after a new conversation is created
    };

    const scrollToBottom = (behavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        }
    };

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

        setShowScrollButton(!isNearBottom);
    };

    const handleTabChange = (tab) => {
        console.log('[pages/Messages.js] Tab changed from', activeTab, 'to', tab);
        setActiveTab(tab);
        hasInitializedConversationsRef.current = false;
        lastConversationHashRef.current = null;
        setSelectedConversation(null);
        setMessages([]);
        
        // Query-Cache invalidieren und neu laden
        queryClient.invalidateQueries({
            queryKey: ['messages', 'conversations']
        });
        
        // Explizit refetch auslösen
        setTimeout(() => {
            refetchConversations();
        }, 100);
    };

    useEffect(() => {
        if (isInitialLoad && messages.length > 0) {
            setTimeout(() => {
                scrollToBottom('instant');
                setIsInitialLoad(false);
            }, 100);
        }
    }, [isInitialLoad, messages]);

    useEffect(() => {
        if (!messagesContainerRef.current || messages.length === 0 || isInitialLoad) return;

        if (userJustSentMessage) {
            console.log('[Messages] User sent message, auto-scrolling to bottom');
            setTimeout(() => {
                requestAnimationFrame(() => {
                    scrollToBottom('smooth');
                    setUserJustSentMessage(false);
                });
            }, 150);
        }
    }, [messages, userJustSentMessage, isInitialLoad]);

    const formatTime = (dateString) => {
        if (!dateString) return '';

        let isoString = dateString;
        if (typeof dateString === 'string' &&
            !dateString.endsWith('Z') &&
            !dateString.includes('+') &&
            !dateString.includes('-', 10)) {
            isoString = dateString + 'Z';
        }

        const date = new Date(isoString);

        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return '';
        }

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderMessageContent = (content) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);

        return parts.map((part, index) => {
            if (part.match(urlRegex)) {
                const isInternal = part.includes('coherosphere') ||
                    part.includes(window.location.hostname);

                return (
                    <a
                        key={index}
                        href={part}
                        target={isInternal ? '_self' : '_blank'}
                        rel={isInternal ? undefined : 'noopener noreferrer'}
                        className="underline hover:text-orange-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    const getAvatarUrl = (avatarUrl, seed) => {
        if (avatarUrl && avatarUrl.startsWith('http')) {
            return avatarUrl;
        }
        return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=FF6A00,FF8C42&size=120`;
    };

    return (
        <div className="flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-[calc(100vh-80px)] lg:min-h-screen">
            {/* Header */}
            <div className="p-4 lg:p-8 flex-shrink-0">
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <ConfiguredIcon 
                                iconName="MessageSquare" 
                                iconConfig={iconConfigs['MessageSquare']}
                                size="w-12 h-12"
                                className="flex-shrink-0"
                            />
                            <div>
                                <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                                    Messages
                                </h1>
                                <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
                            </div>
                        </div>
                        
                    </div>
                    <p className="text-lg text-slate-400 leading-relaxed mt-3">
                        Your secure, decentralized conversations via Nostr.
                    </p>
                </div>

                {/* Stats Cards */}
                {!sectionsReady.stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                                <CardContent className="p-4 text-center">
                                    <div className="flex justify-center mb-2">
                                        <div className="w-8 h-8 bg-slate-700/30 animate-pulse rounded" />
                                    </div>
                                    <div className="h-8 w-20 mx-auto bg-slate-700/30 animate-pulse rounded mb-1" />
                                    <div className="h-4 w-24 mx-auto bg-slate-700/30 animate-pulse rounded" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <StatCard
                            iconName="MessageSquare"
                            iconConfig={iconConfigs['MessageSquare']}
                            value={stats.messages}
                            label="Messages"
                        />
                        <StatCard
                            iconName="MessagesSquare"
                            iconConfig={iconConfigs['MessagesSquare']}
                            value={stats.conversations}
                            label="Conversations"
                        />
                        <StatCard
                            iconName="BellOff"
                            iconConfig={iconConfigs['BellOff']}
                            value={stats.muted}
                            label="Muted"
                        />
                        <StatCard
                            iconName="Ban"
                            iconConfig={iconConfigs['Ban']}
                            value={stats.blocked}
                            label="Blocked"
                        />
                    </motion.div>
                )}
            </div>

            {/* Main Content Area with Cards */}
            <div className="flex-1 px-4 lg:px-8 pb-8 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden min-h-0">
                {/* Conversation List Card */}
                <div className={`md:col-span-4 lg:col-span-3 flex flex-col overflow-hidden ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 flex flex-col h-full overflow-hidden">
                        <CardHeader className="border-b border-slate-700 flex-shrink-0 min-h-[90px] flex items-center justify-center">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex gap-2">
                                    {['trusted', 'muted', 'blocked'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => handleTabChange(tab)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                                                activeTab === tab
                                                    ? 'bg-orange-500 text-white shadow-lg'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <Button
                                    onClick={() => setShowNewChatModal(true)}
                                    size="icon"
                                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full w-9 h-9"
                                >
                                    <ConfiguredIcon 
                                        iconName="Plus" 
                                        iconConfig={iconConfigs['Plus']}
                                        size="w-5 h-5"
                                    />
                                </Button>
                            </div>
                        </CardHeader>

                        {!sectionsReady.conversationList ? (
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-slate-700/30">
                                        <div className="w-10 h-10 bg-slate-700 animate-pulse rounded-full flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-5 bg-slate-700 animate-pulse rounded w-32" />
                                            <div className="h-4 bg-slate-700 animate-pulse rounded w-full" />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        ) : (
                            <CardContent className="flex-1 overflow-y-auto p-0">
                                {conversations.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <ConfiguredIcon 
                                            iconName="MessageSquare" 
                                            iconConfig={iconConfigs['MessageSquare']}
                                            size="w-12 h-12"
                                            className="mx-auto mb-3"
                                        />
                                        <p className="text-slate-400 text-sm">
                                            {activeTab === 'trusted'
                                                ? 'No conversations yet. Start a new chat!'
                                                : activeTab === 'muted'
                                                ? 'No muted conversations.'
                                                : 'No blocked conversations.'}
                                        </p>
                                    </div>
                                ) : (
                                    conversations.map((conv, index) => (
                                        <motion.button
                                            key={conv.id}
                                            onClick={() => setSelectedConversation(conv)}
                                            className={`w-full p-4 border-b border-slate-700 hover:bg-slate-700/50 transition-colors text-left ${
                                                selectedConversation?.id === conv.id ? 'bg-slate-700/50' : ''
                                            }`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.18, delay: index * 0.05 }}
                                            whileHover={{ x: 4 }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={getAvatarUrl(conv.peerAvatar, conv.peerNpub || conv.peerEmail)}
                                                    alt={conv.peerName}
                                                    className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-slate-600"
                                                    onError={(e) => {
                                                        e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.peerNpub || conv.peerEmail || 'fallback'}&backgroundColor=FF6A00,FF8C42&size=120`;
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-semibold text-white truncate">
                                                            {conv.peerName}
                                                        </h3>
                                                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                                            {formatTime(conv.lastAt)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm text-slate-400 truncate">
                                                            {conv.lastSnippet || 'No messages yet'}
                                                        </p>
                                                        {conv.unreadCount > 0 && (
                                                            <Badge className="bg-orange-500 text-white ml-2 flex-shrink-0">
                                                                {conv.unreadCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))
                                )}
                            </CardContent>
                        )}
                    </Card>
                </div>

                {/* Message View Card */}
                <div className={`md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 flex flex-col h-full overflow-hidden">
                        {!selectedConversation ? (
                            <CardContent className="flex-1 flex items-center justify-center p-8">
                                <div className="text-center max-w-md">
                                    <ConfiguredIcon 
                                        iconName="MessageSquare" 
                                        iconConfig={iconConfigs['MessageSquare']}
                                        size="w-16 h-16"
                                        className="mx-auto mb-4"
                                    />
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Select a conversation
                                    </h3>
                                    <p className="text-slate-400 leading-relaxed">
                                        Choose a conversation from the list or start a new one.
                                    </p>
                                    <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                                        Messages use <span className="text-orange-400 font-medium">Nostr Kind 4 (NIP-04)</span> for end-to-end encryption — private, decentralized, and only visible to you and your chat partner.
                                    </p>
                                </div>
                            </CardContent>
                        ) : selectedConversation.blocked ? (
                            <>
                                <CardHeader className="border-b border-slate-700 min-h-[90px] flex items-center justify-center">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSelectedConversation(null)}
                                                className="md:hidden text-white hover:text-orange-400"
                                            >
                                                <ConfiguredIcon 
                                                    iconName="ArrowLeft" 
                                                    iconConfig={iconConfigs['ArrowLeft']}
                                                    size="w-5 h-5"
                                                />
                                            </Button>
                                            <img
                                                src={getAvatarUrl(selectedConversation.peerAvatar, selectedConversation.peerNpub || selectedConversation.peerEmail)}
                                                alt={selectedConversation.peerName}
                                                className="w-10 h-10 rounded-full border-2 border-slate-600"
                                                onError={(e) => {
                                                    e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedConversation.peerNpub || selectedConversation.peerEmail || 'fallback'}&backgroundColor=FF6A00,FF8C42&size=120`;
                                                }}
                                            />
                                            <div>
                                                <h3 className="font-semibold text-white">
                                                    {selectedConversation.peerName}
                                                </h3>
                                                <p className="text-xs text-slate-400 truncate max-w-[200px]">
                                                    {selectedConversation.peerNpub}
                                                </p>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-white hover:text-orange-400 hover:bg-slate-700">
                                                    <ConfiguredIcon 
                                                        iconName="MoreVertical" 
                                                        iconConfig={iconConfigs['MoreVertical']}
                                                        size="w-5 h-5"
                                                    />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                                <DropdownMenuItem
                                                    onClick={handleMuteConversation}
                                                    className="text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                                                >
                                                    <ConfiguredIcon 
                                                        iconName="BellOff" 
                                                        iconConfig={iconConfigs['BellOff']}
                                                        size="w-4 h-4"
                                                        className="mr-2"
                                                    />
                                                    {selectedConversation.muted ? 'Unmute' : 'Mute'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={handleBlockConversation}
                                                    className="text-red-400 hover:text-red-300 hover:bg-slate-700 cursor-pointer"
                                                >
                                                    <ConfiguredIcon 
                                                        iconName="Ban" 
                                                        iconConfig={iconConfigs['Ban']}
                                                        size="w-4 h-4"
                                                        className="mr-2"
                                                    />
                                                    {selectedConversation.blocked ? 'Unblock' : 'Block'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 flex items-center justify-center p-8">
                                    <div className="text-center max-w-md">
                                        <ConfiguredIcon 
                                            iconName="Ban" 
                                            iconConfig={iconConfigs['Ban']}
                                            size="w-16 h-16"
                                            className="mx-auto mb-4"
                                        />
                                        <h3 className="text-xl font-semibold text-white mb-2">
                                            User Blocked
                                        </h3>
                                        <p className="text-slate-400 leading-relaxed mb-4">
                                            You have blocked this user. Unblock them to send and receive messages.
                                        </p>
                                        <Button
                                            onClick={handleBlockConversation}
                                            variant="outline"
                                            className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                                        >
                                            Unblock User
                                        </Button>
                                    </div>
                                </CardContent>
                            </>
                        ) : (
                            <>
                                <CardHeader className="border-b border-slate-700 min-h-[90px] flex items-center justify-center">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSelectedConversation(null)}
                                                className="md:hidden text-white hover:text-orange-400"
                                            >
                                                <ConfiguredIcon 
                                                    iconName="ArrowLeft" 
                                                    iconConfig={iconConfigs['ArrowLeft']}
                                                    size="w-5 h-5"
                                                />
                                            </Button>
                                            <img
                                                src={getAvatarUrl(selectedConversation.peerAvatar, selectedConversation.peerNpub || selectedConversation.peerEmail)}
                                                alt={selectedConversation.peerName}
                                                className="w-10 h-10 rounded-full border-2 border-slate-600"
                                                onError={(e) => {
                                                    e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedConversation.peerNpub || selectedConversation.peerEmail || 'fallback'}&backgroundColor=FF6A00,FF8C42&size=120`;
                                                }}
                                            />
                                            <div>
                                                <h3 className="font-semibold text-white">
                                                    {selectedConversation.peerName}
                                                </h3>
                                                <p className="text-xs text-slate-400 truncate max-w-[200px]">
                                                    {selectedConversation.peerNpub}
                                                </p>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-white hover:text-orange-400 hover:bg-slate-700">
                                                    <ConfiguredIcon 
                                                        iconName="MoreVertical" 
                                                        iconConfig={iconConfigs['MoreVertical']}
                                                        size="w-5 h-5"
                                                    />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                                <DropdownMenuItem
                                                    onClick={handleMuteConversation}
                                                    className="text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                                                >
                                                    <ConfiguredIcon 
                                                        iconName="BellOff" 
                                                        iconConfig={iconConfigs['BellOff']}
                                                        size="w-4 h-4"
                                                        className="mr-2"
                                                    />
                                                    {selectedConversation.muted ? 'Unmute' : 'Mute'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={handleBlockConversation}
                                                    className="text-red-400 hover:text-red-300 hover:bg-slate-700 cursor-pointer"
                                                >
                                                    <ConfiguredIcon 
                                                        iconName="Ban" 
                                                        iconConfig={iconConfigs['Ban']}
                                                        size="w-4 h-4"
                                                        className="mr-2"
                                                    />
                                                    {selectedConversation.blocked ? 'Unblock' : 'Block'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>

                                {selectedConversation.muted && (
                                    <div className="flex-shrink-0 bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <ConfiguredIcon 
                                                    iconName="BellOff" 
                                                    iconConfig={iconConfigs['BellOff']}
                                                    size="w-5 h-5"
                                                    className="flex-shrink-0"
                                                />
                                                <p className="text-sm text-yellow-200">
                                                    This conversation is muted. You won't receive notifications for new messages.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={handleMuteConversation}
                                                variant="ghost"
                                                size="sm"
                                                className="text-yellow-200 hover:text-yellow-100 hover:bg-yellow-500/20 flex-shrink-0"
                                            >
                                                Unmute
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {!sectionsReady.messageView ? (
                                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                                    i % 2 === 0 ? 'bg-slate-700/50' : 'bg-slate-700/30'
                                                }`}>
                                                    <div className="h-4 bg-slate-600 animate-pulse rounded w-32 mb-2" />
                                                    <div className="h-3 bg-slate-600 animate-pulse rounded w-16" />
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                ) : (
                                    <CardContent
                                        ref={messagesContainerRef}
                                        onScroll={handleScroll}
                                        className="flex-1 overflow-y-auto p-4 space-y-4"
                                    >
                                        {hasMoreMessages && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex justify-center mb-4"
                                            >
                                                <Button
                                                    onClick={handleLoadOlderMessages}
                                                    disabled={isLoadingOlder}
                                                    variant="outline"
                                                    className="bg-slate-700/50 hover:bg-slate-600/50 border-slate-600 text-slate-300"
                                                >
                                                    {isLoadingOlder ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2" />
                                                            Loading...
                                                        </>
                                                    ) : (
                                                        'Load older messages'
                                                    )}
                                                </Button>
                                            </motion.div>
                                        )}

                                        {messages.length === 0 ? (
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-slate-400 text-sm">
                                                    No messages yet. Start the conversation!
                                                </p>
                                            </div>
                                        ) : (
                                            messages.map((msg, index) => {
                                                const isOwn = msg.from === currentUser.nostr_pubkey;
                                                return (
                                                    <motion.div
                                                        key={msg.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.15, delay: index * 0.02 }}
                                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                                                isOwn
                                                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                                                                    : 'bg-slate-700 text-slate-100'
                                                            }`}
                                                        >
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {renderMessageContent(msg.content)}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${isOwn ? 'text-orange-100' : 'text-slate-400'}`}>
                                                                {formatTime(msg.createdAt)}
                                                            </p>
                                                            {msg.status === 'pending' && (
                                                                <p className="text-xs text-orange-200 mt-1">Sending...</p>
                                                            )}
                                                            {msg.status === 'failed' && (
                                                                <p className="text-xs text-red-300 mt-1">Failed to send</p>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })
                                        )}
                                        <div ref={messagesEndRef} />
                                    </CardContent>
                                )}

                                <AnimatePresence>
                                    {showScrollButton && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 20 }}
                                            className="absolute bottom-24 right-8 z-10"
                                        >
                                            <Button
                                                onClick={() => scrollToBottom('smooth')}
                                                className="rounded-full w-12 h-12 bg-orange-500 hover:bg-orange-600 shadow-lg"
                                                size="icon"
                                            >
                                                <ConfiguredIcon 
                                                    iconName="ArrowLeft" 
                                                    iconConfig={iconConfigs['ArrowLeft']}
                                                    size="w-5 h-5"
                                                    className="rotate-[-90deg]"
                                                />
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex-shrink-0 p-4 border-t border-slate-700">
                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <Input
                                            ref={inputRef}
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            disabled={!currentUser || isSending}
                                            className="w-[80%] bg-slate-900/50 border-slate-600 text-white"
                                            maxLength={2000}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!newMessage.trim() || isSending || !currentUser}
                                            className="bg-orange-500 hover:bg-orange-600 flex-shrink-0"
                                        >
                                            {isSending ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <ConfiguredIcon 
                                                    iconName="Send" 
                                                    iconConfig={iconConfigs['Send']}
                                                    size="w-5 h-5"
                                                />
                                            )}
                                        </Button>
                                    </form>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>

            <NewChatModal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                onConversationCreated={handleConversationCreated}
                currentUser={currentUser}
                iconConfigs={iconConfigs}
            />

            <BlockConfirmationModal
                isOpen={showBlockModal}
                onClose={() => setShowBlockModal(false)}
                onConfirm={handleConfirmBlock}
                userName={selectedConversation?.peerName || 'this user'}
                isUnblocking={selectedConversation?.blocked || false}
                iconConfigs={iconConfigs}
            />
        </div>
    );
}
