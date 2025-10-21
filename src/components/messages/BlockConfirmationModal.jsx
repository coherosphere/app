import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

export default function BlockConfirmationModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    userName,
    isUnblocking = false,
    iconConfigs
}) {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md"
                >
                    <Card className="bg-slate-800/95 backdrop-blur-sm border-slate-700">
                        <CardHeader className="border-b border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    isUnblocking 
                                        ? 'bg-green-500/20' 
                                        : 'bg-red-500/20'
                                }`}>
                                    <ConfiguredIcon 
                                        iconName="AlertTriangle" 
                                        iconConfig={iconConfigs?.['AlertTriangle']}
                                        size="w-5 h-5"
                                        fallbackColor={isUnblocking ? 'text-green-400' : 'text-red-400'}
                                    />
                                </div>
                                <CardTitle className="text-xl font-bold text-white">
                                    {isUnblocking ? 'Unblock User' : 'Block User'}
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="ml-auto text-slate-400 hover:text-white"
                                >
                                    <ConfiguredIcon 
                                        iconName="X" 
                                        iconConfig={iconConfigs?.['X']}
                                        size="w-5 h-5"
                                        fallbackColor="text-current"
                                    />
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6">
                            {isUnblocking ? (
                                <p className="text-slate-300 leading-relaxed">
                                    Are you sure you want to unblock <span className="font-semibold text-white">{userName}</span>? 
                                    They will be able to send you messages again.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-slate-300 leading-relaxed">
                                        Are you sure you want to block <span className="font-semibold text-white">{userName}</span>?
                                    </p>
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-sm text-red-200 leading-relaxed">
                                            Blocking will prevent them from sending you messages and hide the conversation 
                                            from your inbox.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        <div className="flex gap-3 p-6 border-t border-slate-700">
                            <Button
                                onClick={onClose}
                                variant="outline"
                                className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                className={`flex-1 ${
                                    isUnblocking
                                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                                } text-white`}
                            >
                                {isUnblocking ? 'Unblock' : 'Block User'}
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}