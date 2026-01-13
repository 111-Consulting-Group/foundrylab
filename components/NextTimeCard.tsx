/**
 * NextTimeCard Component
 *
 * Full "Next Time" card for post-workout summary.
 * Shows last performance, recommended progression, reasoning, and alerts.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Colors } from '@/constants/Colors';
import type { NextTimeSuggestion, PerformanceTrend } from '@/types/database';

interface NextTimeCardProps {
  suggestion: NextTimeSuggestion;
  onDismiss?: () => void;
}

export function NextTimeCard({ suggestion, onDismiss }: NextTimeCardProps) {
  const trendConfig = getTrendConfig(suggestion.trend);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: Colors.graphite[100] }}>
            {suggestion.exercise_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: trendConfig.bg,
              }}
            >
              <Ionicons name={trendConfig.icon as any} size={12} color={trendConfig.iconColor} />
              <Text style={{ fontSize: 12, marginLeft: 4, fontWeight: '500', color: trendConfig.textColor }}>
                {trendConfig.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: 16 }}>
        {/* Last Performance Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Ionicons name="time-outline" size={16} color={Colors.graphite[400]} />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Last time</Text>
            <Text style={{ fontWeight: '600', color: Colors.graphite[200] }}>
              {formatPerformance(suggestion.last_performance)}
            </Text>
          </View>
        </View>

        {/* Suggestion Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <Ionicons name="arrow-forward" size={16} color={Colors.signal[500]} />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Next time</Text>
              <View style={{ marginLeft: 8 }}>
                <ConfidenceBadge level={suggestion.confidence} exposureCount={suggestion.exposure_count} size="sm" />
              </View>
            </View>
            <Text style={{ fontWeight: '700', fontSize: 18, color: Colors.graphite[100] }}>
              {suggestion.recommendation.weight} lbs x {suggestion.recommendation.reps}
            </Text>
          </View>
        </View>

        {/* Reasoning */}
        <View
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <Text style={{ fontSize: 14, color: Colors.graphite[300] }}>
            {suggestion.reasoning}
          </Text>
        </View>

        {/* Alerts */}
        {suggestion.alerts && suggestion.alerts.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {suggestion.alerts.map((alert, index) => (
              <AlertBadge key={index} alert={alert} />
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <StatItem label="Sessions" value={suggestion.exposure_count.toString()} />
          {suggestion.pr_e1rm && (
            <StatItem label="E1RM PR" value={`${Math.round(suggestion.pr_e1rm)} lbs`} />
          )}
          {suggestion.last_performance.rpe && (
            <StatItem label="Last RPE" value={suggestion.last_performance.rpe.toString()} />
          )}
        </View>
      </View>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>{label}</Text>
      <Text style={{ fontWeight: '600', color: Colors.graphite[200] }}>{value}</Text>
    </View>
  );
}

function AlertBadge({ alert }: { alert: NextTimeSuggestion['alerts'][0] }) {
  const isWarning = alert.type === 'regression' || alert.type === 'missed_session';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 8,
        borderRadius: 8,
        marginBottom: 4,
        backgroundColor: isWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
      }}
    >
      <Ionicons
        name={isWarning ? 'warning' : 'information-circle'}
        size={14}
        color={isWarning ? '#ef4444' : '#f59e0b'}
        style={{ marginTop: 1 }}
      />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: isWarning ? '#ef4444' : '#f59e0b' }}>
          {alert.message}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
          {alert.suggested_action}
        </Text>
      </View>
    </View>
  );
}

function formatPerformance(perf: NextTimeSuggestion['last_performance']): string {
  const parts: string[] = [];

  if (perf.weight !== null) {
    if (perf.weight === 0) {
      parts.push('BW');
    } else {
      parts.push(`${perf.weight} lbs`);
    }
  }

  if (perf.reps !== null) {
    parts.push(`x ${perf.reps}`);
  }

  if (perf.rpe !== null) {
    parts.push(`@ RPE ${perf.rpe}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'No data';
}

function getTrendConfig(trend: PerformanceTrend) {
  switch (trend) {
    case 'progressing':
      return {
        icon: 'trending-up',
        iconColor: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.2)',
        textColor: '#22c55e',
        label: 'Progressing',
      };
    case 'regressing':
      return {
        icon: 'trending-down',
        iconColor: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.2)',
        textColor: '#ef4444',
        label: 'Regressing',
      };
    default:
      return {
        icon: 'remove',
        iconColor: Colors.graphite[400],
        bg: 'rgba(255, 255, 255, 0.1)',
        textColor: Colors.graphite[400],
        label: 'Stable',
      };
  }
}

/**
 * Compact list item version for summary lists
 */
export function NextTimeListItem({ suggestion }: { suggestion: NextTimeSuggestion }) {
  const trendConfig = getTrendConfig(suggestion.trend);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Trend Indicator */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: trendConfig.bg,
        }}
      >
        <Ionicons name={trendConfig.icon as any} size={14} color={trendConfig.iconColor} />
      </View>

      {/* Exercise Info */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontWeight: '600', color: Colors.graphite[100] }}>
          {suggestion.exercise_name}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
          {formatPerformance(suggestion.last_performance)}
        </Text>
      </View>

      {/* Suggestion */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: '700', color: Colors.signal[500] }}>
          {suggestion.recommendation.weight} x {suggestion.recommendation.reps}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginRight: 4,
              backgroundColor:
                suggestion.confidence === 'high'
                  ? '#22c55e'
                  : suggestion.confidence === 'medium'
                  ? '#fbbf24'
                  : Colors.graphite[500],
            }}
          />
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
            {suggestion.confidence === 'high'
              ? 'Recommended'
              : suggestion.confidence === 'medium'
              ? 'Suggested'
              : 'Limited data'}
          </Text>
        </View>
      </View>
    </View>
  );
}
