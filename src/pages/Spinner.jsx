
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CoherosphereNetworkSpinner from '@/components/spinners/CoherosphereNetworkSpinner';
import ConfiguredIcon from '@/components/ui/configured-icon'; // Assuming this import path for ConfiguredIcon

// Define icon configurations as needed by ConfiguredIcon
const iconConfigs = {
  Loader2: {
    // Potentially add specific config properties for Loader2 if ConfiguredIcon expects them
    // For now, an empty object is a safe default if no specific config is required beyond name and size
  },
};

export default function Spinner() {
  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <ConfiguredIcon 
              iconName="Loader2" 
              iconConfig={iconConfigs['Loader2']}
              size="w-12 h-12"
              className="flex-shrink-0 animate-spin"
            />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                Spinner Test Page
              </h1>
              <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
            </div>
          </div>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
            Test different loading spinner configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Existing Simple Spinner */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Simple Spinner</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
              <p className="text-slate-400 text-sm">Basic Lucide React spinner</p>
            </CardContent>
          </Card>

          {/* Existing Pulsing Circle */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pulsing Circle</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-pulse" />
              <p className="text-slate-400 text-sm">CSS pulse animation</p>
            </CardContent>
          </Card>

          {/* Existing Rotating Border */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Rotating Border</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Border rotation spinner</p>
            </CardContent>
          </Card>

          {/* New: Small Network Spinner */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Network Spinner - Small</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <CoherosphereNetworkSpinner 
                size={80}
                lineWidth={1.5}
                dotRadius={3}
                interval={1200}
                maxConcurrent={3}
              />
              <p className="text-slate-400 text-sm">80px - For inline loading</p>
            </CardContent>
          </Card>

          {/* New: Medium Network Spinner */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Network Spinner - Medium</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <CoherosphereNetworkSpinner 
                size={120}
                lineWidth={2}
                dotRadius={4}
                interval={1100}
                maxConcurrent={4}
              />
              <p className="text-slate-400 text-sm">120px - Standard size</p>
            </CardContent>
          </Card>

          {/* New: Large Network Spinner */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Network Spinner - Large</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <CoherosphereNetworkSpinner 
                size={160}
                lineWidth={2.5}
                dotRadius={5}
                interval={1000}
                maxConcurrent={5}
              />
              <p className="text-slate-400 text-sm">160px - For full-page loading</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Examples */}
        <Card className="mt-8 bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Usage Examples</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-orange-400 mb-2">Network Spinner Component</h3>
              <p className="text-sm mb-2">Import and use the new coherosphere network spinner:</p>
              <pre className="bg-slate-900 p-4 rounded-lg text-xs overflow-x-auto">
{`import CoherosphereNetworkSpinner from '@/components/spinners/CoherosphereNetworkSpinner';

// Small size for inline loading
<CoherosphereNetworkSpinner size={80} />

// Medium size (default)
<CoherosphereNetworkSpinner size={120} />

// Large size for full-page loading
<CoherosphereNetworkSpinner size={160} />

// Customized
<CoherosphereNetworkSpinner 
  size={140}
  color="#FF6600"
  lineWidth={2}
  dotRadius={5}
  interval={1100}
  glowIntensity={0.9}
  maxConcurrent={4}
/>`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
