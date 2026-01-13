import React from 'react';
import { View, Text, Pressable, ViewProps, TextProps, PressableProps, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';

/**
 * GlassCard
 * Glass-morphic container with optional active glow state.
 * Features: backdrop blur effect, edge reflection, and blue glow on active.
 */
interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'subtle';
  active?: boolean;
  noPadding?: boolean;
}

export function GlassCard({
  children,
  className = '',
  variant = 'default',
  active = false,
  noPadding = false,
  style,
  ...props
}: GlassCardProps) {
  const padding = noPadding ? 0 : 20;

  // Base styles for each variant
  const variantStyles = {
    default: {
      backgroundColor: active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(18, 18, 18, 0.8)',
      borderColor: active ? 'rgba(96, 165, 250, 0.5)' : 'rgba(255, 255, 255, 0.1)',
    },
    elevated: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    subtle: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.05)',
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <View
      className={`rounded-3xl border overflow-hidden ${className}`}
      style={[
        {
          backgroundColor: currentStyle.backgroundColor,
          borderColor: currentStyle.borderColor,
          borderWidth: 1,
          padding,
          // Glow effect when active
          ...(active && {
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }),
        },
        style,
      ]}
      {...props}
    >
      {/* Top edge reflection - "liquid" glass effect */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
      />
      {children}
    </View>
  );
}

/**
 * LabCard (Legacy alias for GlassCard)
 * Maintains backward compatibility
 */
interface LabCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'subtle';
  noPadding?: boolean;
}

export function LabCard({ children, className = '', variant = 'default', noPadding = false, ...props }: LabCardProps) {
  return (
    <GlassCard
      variant={variant === 'subtle' ? 'subtle' : 'default'}
      noPadding={noPadding}
      className={className}
      {...props}
    >
      {children}
    </GlassCard>
  );
}

/**
 * LabStat
 * A label + mono-value pair for displaying technical data.
 * Industrial typography with uppercase labels.
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
  const sizeStyles = {
    sm: { label: 9, value: 14 },
    md: { label: 9, value: 18 },
    lg: { label: 10, value: 24 },
  };

  const trendColors = {
    up: Colors.emerald[400],
    down: Colors.regression[400],
    neutral: Colors.graphite[50],
  };

  const valueColor = trend ? trendColors[trend] : Colors.graphite[50];

  return (
    <View className={className}>
      <Text
        style={{
          fontSize: sizeStyles[size].label,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: Colors.graphite[500],
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            fontSize: sizeStyles[size].value,
            fontFamily: 'monospace',
            fontWeight: '700',
            color: valueColor,
          }}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: Colors.graphite[500],
              marginLeft: 2,
            }}
          >
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * StatPill
 * Compact stat display for dashboard summaries.
 */
interface StatPillProps {
  label: string;
  value: string | number;
  unit?: string;
}

export function StatPill({ label, value, unit }: StatPillProps) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: Colors.graphite[500],
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text style={{ flexDirection: 'row' }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: Colors.graphite[50],
          }}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={{
              fontSize: 10,
              color: Colors.graphite[500],
              marginLeft: 2,
            }}
          >
            {unit}
          </Text>
        )}
      </Text>
    </View>
  );
}

/**
 * LabButton
 * Industrial style button with multiple variants.
 */
interface LabButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'emerald';
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
  style,
  ...props
}: LabButtonProps) {
  const variantStyles = {
    primary: {
      backgroundColor: Colors.signal[600],
      borderColor: 'transparent',
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: Colors.graphite[700],
      borderColor: 'transparent',
      textColor: Colors.graphite[100],
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textColor: Colors.graphite[200],
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: Colors.graphite[300],
    },
    emerald: {
      backgroundColor: Colors.emerald[500],
      borderColor: 'transparent',
      textColor: '#000000',
    },
  };

  const sizeStyles = {
    sm: { paddingH: 12, paddingV: 8, fontSize: 10, borderRadius: 8 },
    md: { paddingH: 16, paddingV: 12, fontSize: 12, borderRadius: 10 },
    lg: { paddingH: 24, paddingV: 16, fontSize: 14, borderRadius: 12 },
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  return (
    <Pressable
      className={className}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: currentVariant.backgroundColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: currentVariant.borderColor,
          borderRadius: currentSize.borderRadius,
          paddingHorizontal: currentSize.paddingH,
          paddingVertical: currentSize.paddingV,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
      <Text
        style={{
          color: currentVariant.textColor,
          fontSize: currentSize.fontSize,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * StatusIndicator
 * Small colored dots with optional pulse animation.
 */
interface StatusIndicatorProps {
  status: 'progress' | 'regression' | 'maintenance' | 'neutral' | 'live';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function StatusIndicator({ status, size = 'md', pulse = false }: StatusIndicatorProps) {
  const colors = {
    progress: Colors.emerald[500],
    regression: Colors.regression[500],
    maintenance: Colors.graphite[400],
    neutral: Colors.graphite[600],
    live: Colors.signal[500],
  };

  const sizes = {
    sm: 6,
    md: 8,
  };

  return (
    <View
      style={{
        width: sizes[size],
        height: sizes[size],
        borderRadius: sizes[size] / 2,
        backgroundColor: colors[status],
        // Note: For pulse animation, use Animated.View in actual implementation
      }}
    />
  );
}

/**
 * SectionLabel
 * Uppercase section header for grouping content.
 */
interface SectionLabelProps {
  children: string;
  icon?: React.ReactNode;
}

export function SectionLabel({ children, icon }: SectionLabelProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: Colors.signal[400],
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * LiveIndicator
 * Animated live session indicator.
 */
export function LiveIndicator() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: Colors.signal[500],
          // Add animation in actual usage
        }}
      />
      <Text
        style={{
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: 2,
          color: Colors.graphite[500],
          textTransform: 'uppercase',
        }}
      >
        LIVE SESSION
      </Text>
    </View>
  );
}

/**
 * InputField
 * Glass-styled input field for set entry.
 */
interface InputFieldProps {
  value?: string;
  placeholder?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  onChange?: (text: string) => void;
}

export function InputField({ value, placeholder = '-', isActive, isCompleted }: InputFieldProps) {
  let borderColor = 'rgba(255, 255, 255, 0.1)';
  let textColor = Colors.graphite[50];

  if (isActive) {
    borderColor = 'rgba(59, 130, 246, 0.5)';
  }
  if (isCompleted && value) {
    borderColor = 'rgba(52, 211, 153, 0.3)';
    textColor = Colors.emerald[100] || '#D1FAE5';
  }

  return (
    <View
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 1,
        borderColor,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontFamily: 'monospace',
          color: value ? textColor : Colors.graphite[700],
          textAlign: 'center',
        }}
      >
        {value || placeholder}
      </Text>
    </View>
  );
}
