
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react'; // Keep Loader2
import { Palette, CheckCircle, AlertTriangle } from 'lucide-react'; // Add specific icons if not using ConfiguredIcon for all
import { motion } from 'framer-motion';
import ConfiguredIcon from '@/components/ConfiguredIcon'; // Assuming this component exists
import iconConfigs from '@/config/iconConfigs'; // Assuming iconConfigs object exists

export default function UpdateIconColors() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setResult(null);
    setError(null);

    try {
      const response = await base44.functions.invoke('updateAllIconColors');
      setResult(response.data);
    } catch (err) {
      setError(err.message || 'Failed to update icon colors');
      console.error('Error updating icon colors:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <ConfiguredIcon
            iconName="Palette"
            iconConfig={iconConfigs['Palette']}
            size="w-12 h-12"
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
              Update Icon Colors
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
          </div>
        </div>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
          Bulk update icon color configurations across the application.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-white">Batch Update Icon Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-slate-300 space-y-2">
              <p>This will update all icon configurations to use <code className="bg-slate-900 px-2 py-1 rounded text-orange-400">text-white</code> as their default color.</p>
              <p className="text-sm text-slate-400">
                Note: Icons with context-specific colors in page code will remain unchanged.
              </p>
            </div>

            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Icons...
                </>
              ) : (
                <>
                  <Palette className="w-4 h-4 mr-2" />
                  Update All Icons to White
                </>
              )}
            </Button>

            {result && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  <div className="space-y-1">
                    <p className="font-semibold">{result.message}</p>
                    <div className="text-sm space-y-1">
                      <p>✓ Updated: {result.updated} icons</p>
                      <p>✓ Total: {result.total} icons</p>
                      {result.errors > 0 && (
                        <p className="text-orange-400">⚠ Errors: {result.errors}</p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="bg-red-500/10 border-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
