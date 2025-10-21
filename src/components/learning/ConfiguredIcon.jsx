import React from 'react';
import { iconMap } from '@/components/config/iconMap';

/**
 * Renders an icon with configuration from IconAdmin
 * Falls back to default color if no config is provided
 */
export default function ConfiguredIcon({ 
  iconName, 
  iconConfig, 
  className = '', 
  size = 'w-6 h-6',
  fallbackColor = 'text-slate-400',
  ...props 
}) {
  const IconComponent = iconMap[iconName];
  
  if (!IconComponent) {
    return null;
  }

  const colorClass = iconConfig?.color_hint || fallbackColor;
  const finalClassName = `${size} ${colorClass} ${className}`.trim();

  return <IconComponent className={finalClassName} {...props} />;
}