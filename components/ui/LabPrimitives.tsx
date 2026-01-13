import React from 'react';
import { View, Text, Pressable, ViewProps, TextProps, PressableProps } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * LabCard
 * Standard container for the industrial lab theme.
 * Dark: bg-graphite-900 border-graphite-700
 * Light: bg-white border-graphite-200
 */
interface LabCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'subtle';
  noPadding?: boolean;
}

export function LabCard({ children, className = '', variant = 'default', noPadding = false, ...props }: LabCardProps) {
  // Force dark mode - always use dark styles
  const baseStyles = 'bg-graphite-900 border-graphite-700';
  const subtleStyles = 'bg-graphite-800 border-graphite-700';

  const padding = noPadding ? '' : 'p-4';
  
  const bgColor = variant === 'default' ? '#1A1F2E' : '#1A1F2E'; // graphite-900
  const borderColor = '#353D4B'; // graphite-700

  return (
    <View 
      className={`rounded-xl border ${variant === 'default' ? baseStyles : subtleStyles} ${padding} ${className}`}
      style={{ backgroundColor: bgColor, borderColor }}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * LabStat
 * A label + mono-value pair for displaying technical data.
 */
interface LabStatProps {
  label: string;
  value: string | number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function LabStat({ label, value, unit, size = 'md', trend, className = '' }: LabStatProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sizeStyles = {
    sm: { label: 'text-xs', value: 'text-sm' },
    md: { label: 'text-xs', value: 'text-lg' },
    lg: { label: 'text-sm', value: 'text-2xl' },
  };

  // Force dark mode - always use light text
  const trendColor = trend === 'up' 
    ? 'text-progress-500' 
    : trend === 'down' 
      ? 'text-regression-500' 
      : 'text-graphite-100';

  return (
    <View className={className}>
      <Text className={`${sizeStyles[size].label} font-sans mb-0.5 text-graphite-400`} style={{ color: '#6B7485' }}>
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text className={`${sizeStyles[size].value} font-lab-mono font-bold ${trendColor}`} style={trend === 'neutral' ? { color: '#E6E8EB' } : undefined}>
          {value}
        </Text>
        {unit && (
          <Text className="ml-1 text-xs font-lab-mono text-graphite-400" style={{ color: '#6B7485' }}>
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * LabButton
 * Industrial style button.
 */
interface LabButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function LabButton({ 
  label, 
  variant = 'primary', 
  size = 'md', 
  icon, 
  loading,
  className = '',
  disabled,
  ...props 
}: LabButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const variants = {
    primary: 'bg-signal-500 active:bg-signal-600',
    secondary: isDark ? 'bg-graphite-700 active:bg-graphite-600' : 'bg-graphite-200 active:bg-graphite-300',
    outline: `border ${isDark ? 'border-graphite-600' : 'border-graphite-300'} bg-transparent`,
    ghost: 'bg-transparent',
  };

  const textColors = {
    primary: 'text-white',
    secondary: isDark ? 'text-graphite-100' : 'text-graphite-900',
    outline: isDark ? 'text-graphite-200' : 'text-graphite-700',
    ghost: isDark ? 'text-graphite-300' : 'text-graphite-600',
  };

  // Force dark mode text colors with explicit styles
  const textColorStyles = {
    primary: { color: '#FFFFFF' },
    secondary: isDark ? { color: '#E6E8EB' } : { color: '#0F172A' },
    outline: isDark ? { color: '#D4D7DC' } : { color: '#374151' },
    ghost: isDark ? { color: '#C4C8D0' } : { color: '#4B5563' },
  };

  const sizes = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <Pressable
      className={`flex-row items-center justify-center rounded-lg ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {icon && <View className="mr-2">{icon}</View>}
      <Text 
        className={`${textColors[variant]} ${textSizes[size]} font-semibold font-sans uppercase tracking-wide`}
        style={textColorStyles[variant]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * StatusIndicator
 * Small colored dots/bars for Progress/Regression.
 */
interface StatusIndicatorProps {
  status: 'progress' | 'regression' | 'maintenance' | 'neutral';
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const colors = {
    progress: 'bg-progress-500',
    regression: 'bg-regression-500',
    maintenance: 'bg-graphite-400',
    neutral: 'bg-graphite-600',
  };

  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  return (
    <View className={`${sizes[size]} rounded-full ${colors[status]}`} />
  );
}
