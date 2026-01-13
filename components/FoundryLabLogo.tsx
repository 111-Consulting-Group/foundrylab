import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Try to import react-native-svg (works on both web and native)
let Svg: any, Defs: any, LinearGradient: any, Stop: any, Path: any, Circle: any;

try {
  const RNSSvg = require('react-native-svg');
  Svg = RNSSvg.Svg;
  Defs = RNSSvg.Defs;
  LinearGradient = RNSSvg.LinearGradient;
  Stop = RNSSvg.Stop;
  Path = RNSSvg.Path;
  Circle = RNSSvg.Circle;
} catch (e) {
  // SVG library not available - use fallback
}

interface FoundryLabLogoProps {
  size?: number;
  style?: any;
}

export function FoundryLabLogo({ size = 200, style }: FoundryLabLogoProps) {
  // If react-native-svg is available, use it
  if (Svg && Defs) {
    return (
      <View style={[styles.container, style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id={`glass-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.05" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </LinearGradient>
            <LinearGradient id={`liquid-${size}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#3b82f6" />
              <Stop offset="100%" stopColor="#06b6d4" />
            </LinearGradient>
            <LinearGradient id={`plate-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#2d2d2d" />
              <Stop offset="100%" stopColor="#1a1a1a" />
            </LinearGradient>
          </Defs>
          <Path
            d="M65 15 L135 15 L185 65 L185 135 L135 185 L65 185 L15 135 L15 65 Z"
            fill={`url(#plate-${size})`}
            stroke="#404040"
            strokeWidth="3"
          />
          <Path
            d="M70 25 L130 25 L175 70 L175 130 L130 175 L70 175 L25 130 L25 70 Z"
            fill="none"
            stroke="#111"
            strokeWidth="2"
            opacity="0.5"
          />
          <Path
            d="M100 40 L120 40 L120 70 L145 110 C155 125 145 150 125 150 H75 C55 150 45 125 55 110 L80 70 V40 L100 40"
            fill={`url(#glass-${size})`}
            stroke="#475569"
            strokeWidth="2"
          />
          <Path
            d="M80 80 L120 80 L142 115 C148 125 140 145 125 145 H75 C60 145 52 125 58 115 L80 80Z"
            fill={`url(#liquid-${size})`}
            opacity="0.8"
          />
          <Circle cx="85" cy="140" r="1.5" fill="white" opacity="0.4" />
          <Circle cx="100" cy="142" r="1" fill="white" opacity="0.3" />
          <Circle cx="115" cy="138" r="2" fill="white" opacity="0.4" />
          <Circle cx="92" cy="125" r="2.5" fill="white" opacity="0.5" />
          <Circle cx="108" cy="120" r="2" fill="white" opacity="0.5" />
          <Circle cx="78" cy="115" r="1.5" fill="white" opacity="0.3" />
          <Circle cx="98" cy="95" r="3.5" fill="white" opacity="0.6" />
          <Circle cx="112" cy="105" r="2.5" fill="white" opacity="0.5" />
          <Circle cx="88" cy="85" r="1" fill="white" opacity="0.4" />
        </Svg>
      </View>
    );
  }

  // Fallback: Simple octagonal placeholder with icon
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
        }}
      >
        <View
          style={{
            width: size * 0.5,
            height: size * 0.6,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderRadius: size * 0.05,
            borderWidth: 2,
            borderColor: '#475569',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: size * 0.1,
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
