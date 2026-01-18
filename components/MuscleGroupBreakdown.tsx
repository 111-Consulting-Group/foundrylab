/**
 * Muscle Group Breakdown Component
 *
 * Shows weekly volume and sets per muscle group with visual progress bars.
 * Highlights gaps where muscles haven't been trained this week.
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

import { Colors } from '@/constants/Colors';
import { GlassCard } from '@/components/ui/LabPrimitives';

interface MuscleGroupData {
  name: string;
  sets: number;
  volume: number;
}

interface MuscleGroupBreakdownProps {
  muscleGroups: MuscleGroupData[];
  compact?: boolean;
  showTitle?: boolean;
}

// Standard muscle groups to always show (even if 0 sets)
const STANDARD_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Biceps',
  'Triceps',
  'Core',
];

// Combine similar muscle groups for cleaner display
const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  'Quads': 'Quadriceps',
  'Legs': 'Quadriceps',
  'Abs': 'Core',
  'Abdominals': 'Core',
  'Rear Delts': 'Shoulders',
  'Front Delts': 'Shoulders',
  'Lats': 'Back',
  'Traps': 'Back',
  'Calves': 'Legs (Other)',
};

function formatVolume(volume: number): string {
  if (volume >= 10000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toLocaleString();
}

export function MuscleGroupBreakdown({
  muscleGroups,
  compact = false,
  showTitle = true,
}: MuscleGroupBreakdownProps) {
  // Normalize and merge muscle groups
  const normalizedGroups = new Map<string, { sets: number; volume: number }>();

  // Initialize standard groups with 0
  STANDARD_MUSCLE_GROUPS.forEach((group) => {
    normalizedGroups.set(group, { sets: 0, volume: 0 });
  });

  // Merge incoming data
  muscleGroups.forEach((group) => {
    const normalizedName = MUSCLE_GROUP_ALIASES[group.name] || group.name;
    const existing = normalizedGroups.get(normalizedName) || { sets: 0, volume: 0 };
    normalizedGroups.set(normalizedName, {
      sets: existing.sets + group.sets,
      volume: existing.volume + group.volume,
    });
  });

  // Convert to array and sort by volume (trained muscles first, then alphabetically)
  const sortedGroups = Array.from(normalizedGroups.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => {
      // Trained muscles first
      if (a.sets > 0 && b.sets === 0) return -1;
      if (a.sets === 0 && b.sets > 0) return 1;
      // Then by volume
      return b.volume - a.volume;
    });

  // Find max volume for scaling bars
  const maxVolume = Math.max(...sortedGroups.map((g) => g.volume), 1);

  // Calculate totals
  const totalSets = sortedGroups.reduce((sum, g) => sum + g.sets, 0);
  const totalVolume = sortedGroups.reduce((sum, g) => sum + g.volume, 0);
  const trainedCount = sortedGroups.filter((g) => g.sets > 0).length;
  const gapCount = sortedGroups.filter((g) => g.sets === 0).length;

  // In compact mode, only show top groups + gaps
  const displayGroups = compact
    ? sortedGroups.filter((g) => g.sets > 0).slice(0, 5)
    : sortedGroups;

  const gapsInCompact = compact
    ? sortedGroups.filter((g) => g.sets === 0).slice(0, 3)
    : [];

  if (totalSets === 0) {
    return (
      <GlassCard variant="subtle">
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Ionicons name="barbell-outline" size={32} color={Colors.graphite[600]} />
          <Text style={{ marginTop: 8, color: Colors.graphite[400], fontSize: 14 }}>
            No workouts logged this week
          </Text>
          <Text style={{ marginTop: 4, color: Colors.graphite[500], fontSize: 12 }}>
            Start training to see your muscle group breakdown
          </Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="subtle">
      {showTitle && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="body-outline" size={18} color={Colors.signal[400]} />
            <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '700', color: Colors.graphite[50] }}>
              This Week's Volume
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
            {totalSets} sets · {formatVolume(totalVolume)} lbs
          </Text>
        </View>
      )}

      {/* Muscle Group Bars */}
      <View style={{ gap: compact ? 8 : 10 }}>
        {displayGroups.map((group) => {
          const barWidth = maxVolume > 0 ? (group.volume / maxVolume) * 100 : 0;
          const isGap = group.sets === 0;

          return (
            <View key={group.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: isGap ? Colors.graphite[500] : Colors.graphite[200],
                  }}
                >
                  {group.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: isGap ? Colors.graphite[600] : Colors.graphite[400],
                    }}
                  >
                    {group.sets} sets
                  </Text>
                  {!compact && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: isGap ? Colors.graphite[600] : Colors.graphite[300],
                        minWidth: 50,
                        textAlign: 'right',
                      }}
                    >
                      {isGap ? '—' : `${formatVolume(group.volume)}`}
                    </Text>
                  )}
                </View>
              </View>

              {/* Progress Bar */}
              <View
                style={{
                  height: compact ? 4 : 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                }}
              >
                {!isGap && (
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.max(barWidth, 2)}%`,
                      borderRadius: 3,
                      backgroundColor: Colors.signal[500],
                    }}
                  />
                )}
              </View>
            </View>
          );
        })}

        {/* Show gaps in compact mode */}
        {compact && gapsInCompact.length > 0 && (
          <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>
                Not hit:
              </Text>
              {gapsInCompact.map((group) => (
                <View
                  key={group.name}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Text style={{ fontSize: 11, color: Colors.graphite[400] }}>
                    {group.name}
                  </Text>
                </View>
              ))}
              {gapCount > 3 && (
                <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>
                  +{gapCount - 3} more
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Summary footer for non-compact */}
      {!compact && gapCount > 0 && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="information-circle-outline" size={14} color={Colors.oxide[500]} />
          <Text style={{ marginLeft: 6, fontSize: 12, color: Colors.graphite[400] }}>
            {gapCount} muscle group{gapCount !== 1 ? 's' : ''} not trained this week
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

/**
 * Compact inline version for dashboard
 */
export function MuscleGroupSummary({
  muscleGroups,
}: {
  muscleGroups: MuscleGroupData[];
}) {
  const trained = muscleGroups.filter((g) => g.sets > 0);
  const totalSets = trained.reduce((sum, g) => sum + g.sets, 0);

  if (trained.length === 0) {
    return null;
  }

  // Show top 3 muscle groups as pills
  const topGroups = trained
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {topGroups.map((group) => (
        <View
          key={group.name}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.signal[400] }}>
            {group.name} · {group.sets}
          </Text>
        </View>
      ))}
      {trained.length > 3 && (
        <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>
          +{trained.length - 3} more
        </Text>
      )}
    </View>
  );
}
