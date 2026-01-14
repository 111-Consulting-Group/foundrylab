import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FoundryLabLogoProps {
  size?: number;
  style?: any;
}

export function FoundryLabLogo({ size = 200, style }: FoundryLabLogoProps) {
  // Use a simple icon-based fallback for now to avoid SVG library dependencies
  // This prevents crashes on web where react-native-svg may not be properly configured
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: '#2d2d2d',
          borderRadius: size / 8,
          borderWidth: 3,
          borderColor: '#404040',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#3b82f6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }}
      >
        <View
          style={{
            width: size * 0.5,
            height: size * 0.6,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: size * 0.05,
            borderWidth: 2,
            borderColor: '#475569',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: size * 0.1,
            position: 'relative',
          }}
        >
          <View
            style={{
              width: size * 0.3,
              height: size * 0.35,
              backgroundColor: 'rgba(59, 130, 246, 0.6)',
              borderTopLeftRadius: size * 0.05,
              borderTopRightRadius: size * 0.05,
            }}
          />
          {/* Small bubbles effect */}
          <View
            style={{
              position: 'absolute',
              top: size * 0.15,
              left: size * 0.1,
              width: size * 0.08,
              height: size * 0.08,
              borderRadius: size * 0.04,
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.25,
              right: size * 0.12,
              width: size * 0.06,
              height: size * 0.06,
              borderRadius: size * 0.03,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
