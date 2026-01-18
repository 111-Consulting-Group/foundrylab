// Cardio-specific entry component
// Adaptive UI based on exercise type (running, biking, rowing, etc.)
// Segment picker, distance presets, pace input, logged intervals list

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';

import { Colors } from '@/constants/Colors';
import { formatDistance, formatPace, getCompletionStatus, type SetWithExercise } from '@/lib/workoutSummary';
import { useCardioMemory, useAnyCardioHistory } from '@/hooks/useMovementMemory';
import type { Exercise, WorkoutSetInsert, SegmentType, PrimaryMetric } from '@/types/database';

// ============================================================================
// Prescription Parsing
// ============================================================================

interface ParsedPrescription {
  isIntervals: boolean;
  intervalCount: number | null;
  targetDistanceMeters: number | null;
  targetPace: string | null;
  targetDuration: number | null; // in minutes
}

/**
 * Parse exercise name to extract interval prescription
 * Examples:
 * - "Intervals: 10×200m @ mile pace" -> { isIntervals: true, intervalCount: 10, targetDistanceMeters: 200, targetPace: "mile pace" }
 * - "6 x 400m @ 5K pace" -> { isIntervals: true, intervalCount: 6, targetDistanceMeters: 400, targetPace: "5K pace" }
 * - "Easy Run" -> { isIntervals: false, ... }
 */
function parsePrescription(exerciseName: string): ParsedPrescription {
  const name = exerciseName.toLowerCase();
  const result: ParsedPrescription = {
    isIntervals: false,
    intervalCount: null,
    targetDistanceMeters: null,
    targetPace: null,
    targetDuration: null,
  };

  // Check if it's an interval workout
  if (name.includes('interval') || name.includes('repeat') || /\d+\s*[x×]\s*\d+/.test(name)) {
    result.isIntervals = true;
  }

  // Parse pattern: "10×200m" or "10x200m" or "10 x 200m"
  const intervalMatch = exerciseName.match(/(\d+)\s*[x×]\s*(\d+)\s*(m|mi|km|k)?/i);
  if (intervalMatch) {
    result.isIntervals = true;
    result.intervalCount = parseInt(intervalMatch[1], 10);
    let distance = parseInt(intervalMatch[2], 10);
    const unit = (intervalMatch[3] || 'm').toLowerCase();

    // Convert to meters
    if (unit === 'mi') {
      distance = Math.round(distance * 1609.34);
    } else if (unit === 'km' || unit === 'k') {
      distance = distance * 1000;
    }
    // Otherwise assume meters
    result.targetDistanceMeters = distance;
  }

  // Parse pace: "@ mile pace" or "@ 5K pace" or "@ 10K pace"
  const paceMatch = exerciseName.match(/@\s*(.+?pace)/i);
  if (paceMatch) {
    result.targetPace = paceMatch[1].trim();
  } else {
    // Also check for standalone pace references without @
    const standalonePaceMatch = exerciseName.match(/(mile\s+pace|5k\s+pace|10k\s+pace|tempo\s+pace|marathon\s+pace)/i);
    if (standalonePaceMatch) {
      result.targetPace = standalonePaceMatch[1].trim();
    }
  }

  return result;
}

// ============================================================================
// Activity Type Detection
// ============================================================================

type CardioActivityType = 'run' | 'bike' | 'row' | 'swim' | 'other';

interface ActivityConfig {
  type: CardioActivityType;
  label: string;
  continuousLabel: string;
  intervalLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  usesWatts: boolean;
  usesPace: boolean;
  defaultDistanceUnit: 'meters' | 'miles' | 'km';
  defaultPaceUnit: '/mi' | '/km' | '/m' | '/500m';
}

const ACTIVITY_CONFIGS: Record<CardioActivityType, ActivityConfig> = {
  run: {
    type: 'run',
    label: 'Running',
    continuousLabel: 'Continuous Run',
    intervalLabel: 'Run Intervals',
    icon: 'walk-outline',
    color: Colors.emerald[500],
    usesWatts: false,
    usesPace: true,
    defaultDistanceUnit: 'miles',
    defaultPaceUnit: '/mi',
  },
  bike: {
    type: 'bike',
    label: 'Cycling',
    continuousLabel: 'Continuous Ride',
    intervalLabel: 'Bike Intervals',
    icon: 'bicycle-outline',
    color: '#F59E0B',
    usesWatts: true,
    usesPace: false,
    defaultDistanceUnit: 'miles',
    defaultPaceUnit: '/mi',
  },
  row: {
    type: 'row',
    label: 'Rowing',
    continuousLabel: 'Continuous Row',
    intervalLabel: 'Row Intervals',
    icon: 'boat-outline',
    color: '#3B82F6',
    usesWatts: true,
    usesPace: true,
    defaultDistanceUnit: 'meters',
    defaultPaceUnit: '/500m',
  },
  swim: {
    type: 'swim',
    label: 'Swimming',
    continuousLabel: 'Continuous Swim',
    intervalLabel: 'Swim Intervals',
    icon: 'water-outline',
    color: '#06B6D4',
    usesWatts: false,
    usesPace: true,
    defaultDistanceUnit: 'meters',
    defaultPaceUnit: '/m',
  },
  other: {
    type: 'other',
    label: 'Cardio',
    continuousLabel: 'Continuous Session',
    intervalLabel: 'Intervals',
    icon: 'fitness-outline',
    color: Colors.emerald[500],
    usesWatts: false,
    usesPace: true,
    defaultDistanceUnit: 'miles',
    defaultPaceUnit: '/mi',
  },
};

function detectActivityType(exercise: Exercise): CardioActivityType {
  const name = exercise.name.toLowerCase();

  // Check for biking
  if (name.includes('bike') || name.includes('cycling') || name.includes('bicycle') ||
      name.includes('spin') || name.includes('peloton')) {
    return 'bike';
  }

  // Check for rowing
  if (name.includes('row') || name.includes('erg') || name.includes('concept2') ||
      name.includes('c2')) {
    return 'row';
  }

  // Check for swimming
  if (name.includes('swim') || name.includes('pool') || name.includes('lap')) {
    return 'swim';
  }

  // Check for running (including walking, jogging)
  if (name.includes('run') || name.includes('jog') || name.includes('walk') ||
      name.includes('treadmill') || name.includes('sprint')) {
    return 'run';
  }

  // Default based on primary metric
  if (exercise.primary_metric === 'Watts') {
    return 'bike';
  }

  return 'other';
}

// Distance presets in meters
const DISTANCE_PRESETS_METERS = [
  { label: '200m', meters: 200 },
  { label: '400m', meters: 400 },
  { label: '800m', meters: 800 },
  { label: '1mi', meters: 1609 },
];

// Conversion functions
function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

function metersToKm(meters: number): number {
  return meters / 1000;
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function kmToMeters(km: number): number {
  return km * 1000;
}

// Get distance presets for current unit
function getDistancePresets(unit: 'meters' | 'miles' | 'km') {
  if (unit === 'meters') {
    return DISTANCE_PRESETS_METERS;
  } else if (unit === 'miles') {
    return [
      { label: '0.25mi', meters: 402 },
      { label: '0.5mi', meters: 805 },
      { label: '1mi', meters: 1609 },
      { label: '2mi', meters: 3219 },
    ];
  } else {
    return [
      { label: '0.5km', meters: 500 },
      { label: '1km', meters: 1000 },
      { label: '2km', meters: 2000 },
      { label: '5km', meters: 5000 },
    ];
  }
}

// Segment types with display config
const SEGMENT_TYPES: { type: SegmentType; label: string; color: string; bgColor: string }[] = [
  { type: 'warmup', label: 'Warm-up', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
  { type: 'work', label: 'Work', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { type: 'recovery', label: 'Recovery', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  { type: 'cooldown', label: 'Cool-down', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
];

interface CardioEntryProps {
  exercise: Exercise;
  sets: SetWithExercise[];
  workoutId: string;
  onSaveSet: (
    exerciseId: string,
    setOrder: number,
    data: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
  ) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onAddSet: () => void;
  onClose?: () => void; // Optional callback to close the modal after logging
}

type CardioMode = 'intervals' | 'continuous';

export function CardioEntry({
  exercise,
  sets,
  workoutId,
  onSaveSet,
  onDeleteSet,
  onAddSet,
  onClose,
}: CardioEntryProps) {
  // Detect activity type from exercise
  const activityType = useMemo(() => detectActivityType(exercise), [exercise]);
  const activityConfig = ACTIVITY_CONFIGS[activityType];

  // Parse prescription from exercise name (e.g., "Intervals: 10×200m @ mile pace")
  const prescription = useMemo(() => parsePrescription(exercise.name), [exercise.name]);

  // Fetch last session data for this exercise
  const { data: lastSession, isLoading: lastSessionLoading } = useCardioMemory(exercise.id, workoutId);

  // Check if user has ANY cardio history (not just this exercise)
  const { hasHistory: hasAnyCardioHistory, isLoading: loadingAnyCardioHistory } = useAnyCardioHistory();

  // Mode: intervals (segment-by-segment) or continuous (single entry for entire run)
  // Initialize based on prescription if available
  const [mode, setMode] = useState<CardioMode>(() =>
    prescription.isIntervals ? 'intervals' : 'continuous'
  );

  // Form state - Intervals mode
  const [segmentType, setSegmentType] = useState<SegmentType>('work');
  // Initialize distance from prescription if available
  const [selectedDistance, setSelectedDistance] = useState<number | null>(() =>
    prescription.targetDistanceMeters || 400
  );
  const [customDistance, setCustomDistance] = useState('');
  const [pace, setPace] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  // Default based on activity type, but use meters for intervals with known distance
  const [distanceUnit, setDistanceUnit] = useState<'meters' | 'miles' | 'km'>(() => {
    if (prescription.targetDistanceMeters && prescription.targetDistanceMeters < 1609) {
      return 'meters'; // Use meters for short intervals
    }
    return activityConfig.defaultDistanceUnit;
  });
  const [paceUnit, setPaceUnit] = useState<'/mi' | '/km' | '/m' | '/500m'>(activityConfig.defaultPaceUnit);

  // Batch interval logging state
  const [batchMode, setBatchMode] = useState<boolean>(() =>
    prescription.isIntervals && prescription.intervalCount !== null && prescription.intervalCount > 1
  );
  const [intervalPaces, setIntervalPaces] = useState<string[]>(() => {
    const count = prescription.intervalCount || 0;
    return new Array(count).fill('');
  });

  // Update form when prescription changes (e.g., when switching exercises)
  useEffect(() => {
    if (prescription.isIntervals) {
      setMode('intervals');
      if (prescription.targetDistanceMeters) {
        setSelectedDistance(prescription.targetDistanceMeters);
        if (prescription.targetDistanceMeters < 1609) {
          setDistanceUnit('meters');
        }
      }
      if (prescription.intervalCount && prescription.intervalCount > 1) {
        setBatchMode(true);
        setIntervalPaces(new Array(prescription.intervalCount).fill(''));
      }
    }
  }, [prescription]);

  // Watts mode state (for bikes/rowers)
  const [avgWatts, setAvgWatts] = useState('');
  const [cadence, setCadence] = useState('');

  // Switch distance unit when mode changes
  const handleModeChange = (newMode: CardioMode) => {
    setMode(newMode);
    // Set sensible defaults for each mode based on activity
    if (newMode === 'continuous') {
      setDistanceUnit(activityConfig.defaultDistanceUnit);
    } else {
      setDistanceUnit(activityType === 'row' ? 'meters' : 'meters');
    }
  };

  // Form state - Continuous mode
  const [totalDistance, setTotalDistance] = useState('');
  const [avgPace, setAvgPace] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  // Get logged segments (sets that have data)
  const loggedSegments = sets.filter(
    (s) => s.distance_meters || s.duration_seconds || s.avg_pace
  );

  // Get completion status
  const completionStatus = getCompletionStatus(loggedSegments, true, undefined);
  const isComplete = completionStatus === 'completed';

  // Get next set order
  const nextSetOrder = Math.max(0, ...sets.map((s) => s.set_order)) + 1;

  // Handle logging a segment (intervals mode) or continuous run
  const handleLogSegment = useCallback(async () => {
    if (mode === 'continuous') {
      // Continuous mode: log based on activity type
      let distanceMeters: number | null = null;

      if (totalDistance) {
        const distanceValue = parseFloat(totalDistance);
        if (!isNaN(distanceValue)) {
          // Convert to meters based on unit and round to integer (DB expects integer)
          if (distanceUnit === 'miles') {
            distanceMeters = Math.round(milesToMeters(distanceValue));
          } else if (distanceUnit === 'km') {
            distanceMeters = Math.round(kmToMeters(distanceValue));
          } else {
            distanceMeters = Math.round(distanceValue); // Already meters
          }
        }
      }

      // Validation based on activity type
      if (activityConfig.usesWatts) {
        // Watts-based activities need duration OR watts
        if (!durationMinutes && !avgWatts) {
          Alert.alert('Missing Info', 'Please enter at least duration or average watts.');
          return;
        }
      } else {
        // Pace-based activities need distance, pace, or duration
        if (!distanceMeters && !avgPace && !durationMinutes) {
          Alert.alert('Missing Info', 'Please enter at least distance, pace, or duration.');
          return;
        }
      }

      // Format pace with unit (for pace-based activities)
      const paceWithUnit = avgPace ? `${avgPace}${paceUnit}` : null;

      // Calculate duration from distance and pace if not provided
      let durationSeconds: number | null = null;
      if (durationMinutes) {
        durationSeconds = Math.round(parseFloat(durationMinutes) * 60);
      } else if (distanceMeters && avgPace && !activityConfig.usesWatts) {
        // Calculate duration from distance and pace
        // Parse pace (format: "8:45" or "8.75")
        const paceParts = avgPace.split(':');
        let paceValue: number;
        if (paceParts.length === 2) {
          // Format: "8:45" = 8 minutes 45 seconds = 8.75 minutes
          paceValue = parseFloat(paceParts[0]) + parseFloat(paceParts[1]) / 60;
        } else {
          paceValue = parseFloat(avgPace);
        }

        if (!isNaN(paceValue) && paceValue > 0) {
          let totalMinutes = 0;
          if (paceUnit === '/mi') {
            const miles = metersToMiles(distanceMeters);
            totalMinutes = miles * paceValue;
          } else if (paceUnit === '/km') {
            const km = metersToKm(distanceMeters);
            totalMinutes = km * paceValue;
          }
          durationSeconds = Math.round(totalMinutes * 60);
        }
      }

      // Format watts info into avg_pace field for watts-based activities
      // (since there's no dedicated watts column, we store it with notation)
      const paceOrWatts = activityConfig.usesWatts && avgWatts
        ? `${avgWatts}w`
        : paceWithUnit;

      console.log('[CardioEntry] Starting save...');
      setIsLogging(true);

      const setData = {
        distance_meters: distanceMeters,
        avg_pace: paceOrWatts,
        avg_hr: avgHeartRate ? parseInt(avgHeartRate, 10) : null,
        duration_seconds: durationSeconds,
        segment_type: 'work' as const,
        is_warmup: false,
        is_pr: false,
      };

      console.log('[CardioEntry] Saving continuous session:', {
        exerciseId: exercise.id,
        activityType,
        setOrder: nextSetOrder,
        setData,
      });

      try {
        await onSaveSet(exercise.id, nextSetOrder, setData);
        console.log('[CardioEntry] Session saved successfully');

        // Reset form
        setTotalDistance('');
        setAvgPace('');
        setAvgWatts('');
        setAvgHeartRate('');
        setDurationMinutes('');

        // Auto-close the modal after successful save
        if (onClose) {
          setTimeout(() => {
            onClose();
          }, 100);
        }
      } catch (error: any) {
        console.error('[CardioEntry] Error saving session:', error);
        console.error('[CardioEntry] Error details:', {
          message: error?.message,
          code: error?.code,
          status: error?.status,
        });
        Alert.alert(
          'Error',
          `Failed to log workout: ${error?.message || 'Unknown error'}. Please try again.`
        );
      } finally {
        setIsLogging(false);
        console.log('[CardioEntry] Save operation complete');
      }
      return;
    }

    // Intervals mode (original logic)
    let distanceMeters: number | null = null;
    
    if (selectedDistance) {
      distanceMeters = Math.round(selectedDistance); // Already in meters, round for DB
    } else if (customDistance) {
      const customValue = parseFloat(customDistance);
      if (!isNaN(customValue)) {
        // Convert to meters based on unit and round to integer (DB expects integer)
        if (distanceUnit === 'miles') {
          distanceMeters = Math.round(milesToMeters(customValue));
        } else if (distanceUnit === 'km') {
          distanceMeters = Math.round(kmToMeters(customValue));
        } else {
          distanceMeters = Math.round(customValue); // Already meters
        }
      }
    }
    
    if (!distanceMeters && !pace) {
      Alert.alert('Missing Info', 'Please enter a distance or pace.');
      return;
    }

    // Format pace with unit
    const paceWithUnit = pace ? `${pace}${paceUnit}` : null;

    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, nextSetOrder, {
        distance_meters: distanceMeters,
        avg_pace: paceWithUnit,
        segment_type: segmentType,
        is_warmup: segmentType === 'warmup',
        is_pr: false,
      });

      // Reset form for next entry (keep segment type)
      setPace('');
      
      // If work segment, keep distance for quick duplicate
      if (segmentType !== 'work') {
        setSelectedDistance(400);
        setCustomDistance('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log segment. Please try again.');
    } finally {
      setIsLogging(false);
    }
  }, [mode, exercise.id, nextSetOrder, selectedDistance, customDistance, pace, paceUnit, distanceUnit, segmentType, totalDistance, avgPace, avgWatts, avgHeartRate, durationMinutes, onSaveSet, activityConfig, activityType, onClose]);

  // Handle duplicate (copy last segment)
  const handleDuplicate = useCallback(async () => {
    if (loggedSegments.length === 0) return;

    const lastSegment = loggedSegments[loggedSegments.length - 1];
    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, nextSetOrder, {
        distance_meters: lastSegment.distance_meters,
        avg_pace: lastSegment.avg_pace,
        segment_type: lastSegment.segment_type,
        is_warmup: lastSegment.segment_type === 'warmup',
        is_pr: false,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate segment.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, nextSetOrder, loggedSegments, onSaveSet]);

  // Handle delete segment
  const handleDeleteSegment = useCallback(
    async (setId: string) => {
      const confirmDelete = () => {
        if (Platform.OS === 'web') {
          return window.confirm('Delete this segment?');
        }
        return new Promise<boolean>((resolve) => {
          Alert.alert('Delete Segment', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
      };

      const confirmed = await confirmDelete();
      if (confirmed) {
        await onDeleteSet(setId);
      }
    },
    [onDeleteSet]
  );

  // Get segment config for display
  const getSegmentConfig = (type: SegmentType) =>
    SEGMENT_TYPES.find((s) => s.type === type) || SEGMENT_TYPES[1];

  const currentConfig = getSegmentConfig(segmentType);

  return (
    <View className="px-4 pt-4">
      {/* Completion Status Indicator */}
      {isComplete && (
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.3)',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.emerald[400]} />
          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.emerald[400] }}>
            Exercise Complete
          </Text>
        </View>
      )}

      {/* Last Session Context - Shows previous workout data */}
      {lastSession && (
        <View style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="time-outline" size={16} color={Colors.graphite[400]} />
            <Text style={{ marginLeft: 6, fontSize: 12, color: Colors.graphite[400] }}>
              Last session {lastSession.lastDateRelative}
            </Text>
            {lastSession.exposureCount > 1 && (
              <View style={{
                marginLeft: 'auto',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
              }}>
                <Text style={{ fontSize: 10, color: Colors.signal[400] }}>
                  {lastSession.exposureCount} sessions
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
            {lastSession.displayText}
          </Text>
          {lastSession.exposureCount >= 3 && (
            <Text style={{ marginTop: 6, fontSize: 12, color: Colors.graphite[500] }}>
              Avg session: {lastSession.avgDuration ? `${Math.round(lastSession.avgDuration / 60)} min` : 'N/A'}
              {lastSession.longestDistance && ` • Best: ${(lastSession.longestDistance / 1609.34).toFixed(1)} mi`}
            </Text>
          )}

          {/* Progressive Suggestion */}
          {lastSession.exposureCount >= 2 && (
            <View style={{
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.06)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bulb-outline" size={14} color={Colors.emerald[400]} />
                <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', color: Colors.emerald[400] }}>
                  Suggestion
                </Text>
              </View>
              <Text style={{ marginTop: 4, fontSize: 12, color: Colors.graphite[300] }}>
                {(() => {
                  // Generate suggestion based on last session
                  if (lastSession.daysSinceLast && lastSession.daysSinceLast > 14) {
                    return `It's been ${lastSession.daysSinceLast} days. Start with an easy session to rebuild.`;
                  }

                  if (activityConfig.usesWatts && lastSession.lastPace?.endsWith('w')) {
                    const watts = parseInt(lastSession.lastPace);
                    if (!isNaN(watts)) {
                      return `Try ${Math.round(watts * 1.02)}w for the same duration, or add 5 min at ${watts}w.`;
                    }
                  }

                  if (lastSession.lastDuration && lastSession.lastDistance) {
                    const durationMins = Math.round(lastSession.lastDuration / 60);
                    const miles = (lastSession.lastDistance / 1609.34).toFixed(1);
                    if (durationMins < 30) {
                      return `Try adding 5 minutes to your session today (${durationMins + 5} min).`;
                    }
                    return `Maintain ${durationMins} min or push for ${(parseFloat(miles) + 0.5).toFixed(1)} mi.`;
                  }

                  if (lastSession.lastDuration) {
                    const durationMins = Math.round(lastSession.lastDuration / 60);
                    return `Match your ${durationMins} min session or try ${durationMins + 5} min.`;
                  }

                  return 'Keep building consistency. Log today\'s session!';
                })()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* First time prompt - only show if NO cardio history anywhere */}
      {!hasAnyCardioHistory && !loadingAnyCardioHistory && !lastSessionLoading && loggedSegments.length === 0 && (
        <View style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.2)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="sparkles" size={18} color={Colors.signal[400]} />
            <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '500', color: Colors.signal[400] }}>
              First time logging cardio!
            </Text>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, color: Colors.graphite[400] }}>
            After a few sessions, we'll show your history and suggest targets based on your progress.
          </Text>
        </View>
      )}

      {/* New exercise prompt - show when user has cardio history but not for this specific exercise */}
      {hasAnyCardioHistory && !lastSession && !lastSessionLoading && loggedSegments.length === 0 && (
        <View style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="footsteps-outline" size={18} color={Colors.graphite[400]} />
            <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '500', color: Colors.graphite[300] }}>
              First time logging this exercise
            </Text>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, color: Colors.graphite[500] }}>
            Log a few sessions and we'll track your progress for {exercise.name}.
          </Text>
        </View>
      )}

      {/* Activity Type Indicator */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: `${activityConfig.color}15`,
      }}>
        <Ionicons name={activityConfig.icon} size={20} color={activityConfig.color} />
        <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: activityConfig.color }}>
          {activityConfig.label}
        </Text>
        {activityConfig.usesWatts && (
          <View style={{
            marginLeft: 'auto',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}>
            <Text style={{ fontSize: 11, color: Colors.graphite[400] }}>Power-based</Text>
          </View>
        )}
      </View>

      {/* Prescription Info Banner - shows when intervals are detected from exercise name */}
      {prescription.isIntervals && prescription.intervalCount && (
        <View style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.2)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="flash" size={18} color={Colors.signal[400]} />
              <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.signal[400] }}>
                Today's Target
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', fontFamily: 'monospace', color: Colors.signal[400] }}>
                {prescription.intervalCount} intervals
              </Text>
            </View>
          </View>
          <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
            {prescription.intervalCount} × {prescription.targetDistanceMeters ? formatDistance(prescription.targetDistanceMeters) : '?'}
            {prescription.targetPace ? ` @ ${prescription.targetPace}` : ''}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: Colors.graphite[400] }}>
            {loggedSegments.filter(s => s.segment_type === 'work' || !s.segment_type).length} of {prescription.intervalCount} logged
          </Text>
        </View>
      )}

      {/* Mode Toggle: Continuous vs Intervals */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
          Logging Mode
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => handleModeChange('continuous')}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: mode === 'continuous' ? `${activityConfig.color}20` : 'rgba(255, 255, 255, 0.05)',
              borderWidth: mode === 'continuous' ? 2 : 1,
              borderColor: mode === 'continuous' ? activityConfig.color : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: mode === 'continuous' ? activityConfig.color : Colors.graphite[400],
              }}
            >
              {activityConfig.continuousLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeChange('intervals')}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: mode === 'intervals' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              borderWidth: mode === 'intervals' ? 2 : 1,
              borderColor: mode === 'intervals' ? Colors.signal[400] : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: mode === 'intervals' ? Colors.signal[400] : Colors.graphite[400],
              }}
            >
              {activityConfig.intervalLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === 'continuous' ? (
        // Continuous Mode - Adaptive UI based on activity type
        <>
          {activityConfig.usesWatts ? (
            // WATTS-BASED UI (Bike, Rower)
            <>
              {/* Duration (primary for watts-based) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Duration (minutes)
                </Text>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  keyboardType="decimal-pad"
                  placeholder="30"
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              {/* Average Watts */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Average Watts
                </Text>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={avgWatts}
                  onChangeText={setAvgWatts}
                  keyboardType="number-pad"
                  placeholder="180"
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              {/* Distance (optional for bikes) */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                    Distance (optional)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(['meters', 'miles', 'km'] as const).map((unit) => (
                      <Pressable
                        key={unit}
                        onPress={() => {
                          setDistanceUnit(unit);
                          setTotalDistance('');
                        }}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 4,
                          backgroundColor: distanceUnit === unit ? activityConfig.color : 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: distanceUnit === unit ? '#fff' : Colors.graphite[400],
                          }}
                        >
                          {unit === 'meters' ? 'm' : unit === 'miles' ? 'mi' : 'km'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={totalDistance}
                  onChangeText={setTotalDistance}
                  keyboardType="decimal-pad"
                  placeholder={activityType === 'row' ? '2000' : '10'}
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              {/* Average Heart Rate */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Average Heart Rate (bpm)
                </Text>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={avgHeartRate}
                  onChangeText={setAvgHeartRate}
                  keyboardType="number-pad"
                  placeholder="145"
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>
            </>
          ) : (
            // PACE-BASED UI (Running, Swimming, etc.)
            <>
              {/* Total Distance */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                    Total Distance
                  </Text>
                  {/* Unit Toggle */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(['meters', 'miles', 'km'] as const).map((unit) => (
                      <Pressable
                        key={unit}
                        onPress={() => {
                          setDistanceUnit(unit);
                          setTotalDistance('');
                        }}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 4,
                          backgroundColor: distanceUnit === unit ? activityConfig.color : 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: distanceUnit === unit ? '#fff' : Colors.graphite[400],
                          }}
                        >
                          {unit === 'meters' ? 'm' : unit === 'miles' ? 'mi' : 'km'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={totalDistance}
                  onChangeText={setTotalDistance}
                  keyboardType="decimal-pad"
                  placeholder={activityType === 'swim' ? '1000' : '5.0'}
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              {/* Average Pace */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                    Average Pace
                  </Text>
                  {/* Pace Unit Toggle */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(activityType === 'swim' ? ['/m', '/100m'] as const : ['/mi', '/km'] as const).map((unit) => (
                      <Pressable
                        key={unit}
                        onPress={() => setPaceUnit(unit as any)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 4,
                          backgroundColor: paceUnit === unit ? activityConfig.color : 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: paceUnit === unit ? '#fff' : Colors.graphite[400],
                          }}
                        >
                          {unit}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 8,
                      textAlign: 'center',
                      fontSize: 18,
                      fontWeight: '600',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: Colors.graphite[100],
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                    value={avgPace}
                    onChangeText={setAvgPace}
                    placeholder={activityType === 'swim' ? '1:45' : '8:45'}
                    placeholderTextColor={Colors.graphite[500]}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={{ marginLeft: 12, fontSize: 18, color: Colors.graphite[400] }}>
                    {paceUnit}
                  </Text>
                </View>
              </View>

              {/* Average Heart Rate */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Average Heart Rate (bpm)
                </Text>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={avgHeartRate}
                  onChangeText={setAvgHeartRate}
                  keyboardType="number-pad"
                  placeholder="145"
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              {/* Duration (optional) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Duration (minutes) - Optional
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[500], marginBottom: 8 }}>
                  Leave empty to calculate from distance and pace
                </Text>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[100],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  keyboardType="decimal-pad"
                  placeholder="60"
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>
            </>
          )}

          {/* Save & Done Button */}
          <Pressable
            onPress={handleLogSegment}
            disabled={isLogging}
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: isLogging ? `${activityConfig.color}80` : activityConfig.color,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {isLogging ? 'Saving...' : 'Save & Done'}
            </Text>
          </Pressable>
        </>
      ) : batchMode && prescription.intervalCount && prescription.intervalCount > 1 ? (
        // Batch Interval Logging Mode - for prescribed workouts like "10×200m"
        <>
          {/* Batch Entry Header */}
          <View style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                Distance per interval
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'monospace', color: Colors.signal[400] }}>
                {prescription.targetDistanceMeters ? formatDistance(prescription.targetDistanceMeters) : '?'}
              </Text>
            </View>
            {prescription.targetPace && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                  Target pace
                </Text>
                <Text style={{ fontSize: 14, fontFamily: 'monospace', color: Colors.graphite[400] }}>
                  {prescription.targetPace}
                </Text>
              </View>
            )}
          </View>

          {/* Pace Unit Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
              Enter your actual paces
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['/mi', '/km'] as const).map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setPaceUnit(unit as any)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                    backgroundColor: paceUnit === unit ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: paceUnit === unit ? '#fff' : Colors.graphite[400],
                    }}
                  >
                    {unit}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Interval Pace Inputs */}
          <View style={{ gap: 8, marginBottom: 16 }}>
            {intervalPaces.map((paceValue, index) => {
              // Check if this interval was already logged
              const existingInterval = loggedSegments.find(
                (s, i) => i === index && (s.segment_type === 'work' || !s.segment_type)
              );
              const isLogged = !!existingInterval;

              return (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: isLogged ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    borderWidth: 1,
                    borderColor: isLogged ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {/* Interval Number */}
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isLogged ? Colors.emerald[500] : 'rgba(59, 130, 246, 0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {isLogged ? (
                      <Ionicons name="checkmark" size={18} color="white" />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.signal[400] }}>
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  {/* Distance Label */}
                  <Text style={{ fontSize: 14, color: Colors.graphite[400], width: 50 }}>
                    {prescription.targetDistanceMeters ? formatDistance(prescription.targetDistanceMeters) : '?'}
                  </Text>

                  {/* Pace Input or Logged Value */}
                  {isLogged ? (
                    <Text style={{ flex: 1, textAlign: 'right', fontSize: 16, fontFamily: 'monospace', color: Colors.emerald[400] }}>
                      {existingInterval.avg_pace || '—'}
                    </Text>
                  ) : (
                    <TextInput
                      style={{
                        flex: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        textAlign: 'center',
                        fontSize: 16,
                        fontWeight: '600',
                        fontFamily: 'monospace',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: Colors.graphite[100],
                        borderWidth: 1,
                        borderColor: paceValue ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
                      }}
                      value={paceValue}
                      onChangeText={(text) => {
                        const newPaces = [...intervalPaces];
                        newPaces[index] = text;
                        setIntervalPaces(newPaces);
                      }}
                      placeholder="0:00"
                      placeholderTextColor={Colors.graphite[500]}
                      keyboardType="numbers-and-punctuation"
                    />
                  )}

                  {/* Pace unit label */}
                  <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.graphite[500] }}>
                    {paceUnit}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Log All Intervals Button */}
          <Pressable
            onPress={async () => {
              setIsLogging(true);
              try {
                // Log all intervals that have paces entered
                let setOrder = nextSetOrder;
                for (let i = 0; i < intervalPaces.length; i++) {
                  const paceValue = intervalPaces[i];
                  // Skip already-logged intervals or empty paces
                  if (!paceValue || paceValue.trim() === '') continue;

                  await onSaveSet(exercise.id, setOrder++, {
                    distance_meters: prescription.targetDistanceMeters,
                    avg_pace: `${paceValue}${paceUnit}`,
                    segment_type: 'work',
                    is_warmup: false,
                    is_pr: false,
                  });
                }
                // Reset entered paces after logging
                setIntervalPaces(new Array(prescription.intervalCount || 0).fill(''));

                // Close modal if all intervals logged
                const loggedCount = loggedSegments.filter(s => s.segment_type === 'work' || !s.segment_type).length;
                const newlyLoggedCount = intervalPaces.filter(p => p && p.trim() !== '').length;
                if (loggedCount + newlyLoggedCount >= (prescription.intervalCount || 0)) {
                  if (onClose) setTimeout(onClose, 100);
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to log intervals. Please try again.');
              } finally {
                setIsLogging(false);
              }
            }}
            disabled={isLogging || intervalPaces.every(p => !p || p.trim() === '')}
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: isLogging || intervalPaces.every(p => !p || p.trim() === '')
                ? 'rgba(59, 130, 246, 0.3)'
                : Colors.signal[600],
            }}
          >
            <Ionicons name="flash" size={20} color="white" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {isLogging ? 'Logging...' : `Log ${intervalPaces.filter(p => p && p.trim() !== '').length} Interval${intervalPaces.filter(p => p && p.trim() !== '').length !== 1 ? 's' : ''}`}
            </Text>
          </Pressable>

          {/* Toggle to single-interval mode */}
          <Pressable
            onPress={() => setBatchMode(false)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
            }}
          >
            <Ionicons name="list-outline" size={16} color={Colors.graphite[500]} />
            <Text style={{ marginLeft: 6, fontSize: 12, color: Colors.graphite[500] }}>
              Switch to single-interval logging
            </Text>
          </Pressable>
        </>
      ) : (
        // Single Interval Mode (original UI)
        <>
          {/* Toggle to batch mode if prescription available */}
          {prescription.isIntervals && prescription.intervalCount && prescription.intervalCount > 1 && (
            <Pressable
              onPress={() => setBatchMode(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                marginBottom: 16,
                borderRadius: 12,
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.2)',
              }}
            >
              <Ionicons name="grid-outline" size={18} color={Colors.signal[400]} />
              <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '500', color: Colors.signal[400] }}>
                Switch to batch entry ({prescription.intervalCount} intervals)
              </Text>
            </Pressable>
          )}

          {/* Segment Type Picker */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
              Segment Type
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SEGMENT_TYPES.map((seg) => (
                <Pressable
                  key={seg.type}
                  onPress={() => setSegmentType(seg.type)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: segmentType === seg.type ? seg.bgColor : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: segmentType === seg.type ? 2 : 1,
                    borderColor: segmentType === seg.type ? seg.color : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: segmentType === seg.type ? seg.color : Colors.graphite[400],
                    }}
                  >
                    {seg.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Distance Presets */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                Distance
              </Text>
              {/* Unit Toggle */}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {(['meters', 'miles', 'km'] as const).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => {
                      setDistanceUnit(unit);
                      setSelectedDistance(null);
                      setCustomDistance('');
                    }}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                      backgroundColor: distanceUnit === unit ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: distanceUnit === unit ? '#fff' : Colors.graphite[400],
                      }}
                    >
                      {unit === 'meters' ? 'm' : unit === 'miles' ? 'mi' : 'km'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {getDistancePresets(distanceUnit).map((preset) => (
                <Pressable
                  key={preset.meters}
                  onPress={() => {
                    setSelectedDistance(preset.meters);
                    setCustomDistance('');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    borderWidth: 1,
                    backgroundColor: selectedDistance === preset.meters ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: selectedDistance === preset.meters ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      color: selectedDistance === preset.meters ? Colors.signal[500] : Colors.graphite[100],
                    }}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Custom distance input */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, marginRight: 8, color: Colors.graphite[400] }}>
                Custom:
              </Text>
              <TextInput
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: Colors.graphite[100],
                  borderWidth: 1,
                  borderColor: customDistance ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
                }}
                value={customDistance}
                onChangeText={(text) => {
                  setCustomDistance(text);
                  if (text) setSelectedDistance(null);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.graphite[500]}
              />
              <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.graphite[400] }}>
                {distanceUnit === 'meters' ? 'meters' : distanceUnit === 'miles' ? 'miles' : 'km'}
              </Text>
            </View>
          </View>

          {/* Pace Input */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
                Pace
              </Text>
              {/* Pace Unit Toggle */}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {(['/mi', '/km', '/m'] as const).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => setPaceUnit(unit)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                      backgroundColor: paceUnit === unit ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: paceUnit === unit ? '#fff' : Colors.graphite[400],
                      }}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{
                  flex: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: Colors.graphite[100],
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                value={pace}
                onChangeText={setPace}
                placeholder="8:45"
                placeholderTextColor={Colors.graphite[500]}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={{ marginLeft: 12, fontSize: 18, color: Colors.graphite[400] }}>
                {paceUnit}
              </Text>
            </View>
          </View>

          {/* Log Button */}
          <Pressable
            onPress={handleLogSegment}
            disabled={isLogging}
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 16,
              backgroundColor: isLogging ? 'rgba(59, 130, 246, 0.5)' : currentConfig.color,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {isLogging ? 'Logging...' : 'Log Interval'}
            </Text>
          </Pressable>
        </>
      )}

      {/* Logged Segments */}
      {loggedSegments.length > 0 && (
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12, color: Colors.graphite[300] }}>
            Logged ({loggedSegments.length})
          </Text>

          {loggedSegments.map((segment, index) => {
            const config = getSegmentConfig(segment.segment_type || 'work');
            const distanceStr = segment.distance_meters
              ? formatDistance(segment.distance_meters)
              : '';

            // Check if pace contains watts (ends with 'w')
            const isWattsValue = segment.avg_pace?.endsWith('w');
            const paceStr = segment.avg_pace
              ? isWattsValue
                ? segment.avg_pace  // Display watts as-is (e.g., "180w")
                : formatPace(segment.avg_pace)
              : '';
            const hrStr = segment.avg_hr ? `${segment.avg_hr} bpm` : '';
            const durationStr = segment.duration_seconds
              ? `${Math.round(segment.duration_seconds / 60)} min`
              : '';

            // Determine if this is a continuous session (has duration or heart rate but no segment type)
            const isContinuous = segment.duration_seconds && !segment.segment_type;

            return (
              <View
                key={segment.id || index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                  backgroundColor: isContinuous ? `${activityConfig.color}15` : config.bgColor,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isContinuous && (
                      <Ionicons name={activityConfig.icon} size={16} color={activityConfig.color} style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ fontWeight: '600', color: isContinuous ? activityConfig.color : config.color }}>
                      {isContinuous ? activityConfig.continuousLabel : config.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, marginTop: 2, color: Colors.graphite[300] }}>
                    {durationStr}
                    {durationStr && (paceStr || distanceStr) ? ' • ' : ''}
                    {paceStr}
                    {paceStr && distanceStr ? ' • ' : ''}
                    {distanceStr}
                    {hrStr && (distanceStr || paceStr || durationStr) ? ' • ' : ''}
                    {hrStr}
                  </Text>
                </View>

                {/* Delete button */}
                {segment.id && (
                  <Pressable
                    onPress={() => handleDeleteSegment(segment.id)}
                    style={{ padding: 8 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Duplicate button - only show in intervals mode */}
          {mode === 'intervals' && (
            <Pressable
              onPress={handleDuplicate}
              disabled={isLogging}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                marginTop: 8,
                borderColor: 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.graphite[400]} />
              <Text style={{ marginLeft: 8, fontWeight: '500', color: Colors.graphite[400] }}>
                + Duplicate Last
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Done button for intervals mode (continuous mode has Save & Done) */}
      {mode === 'intervals' && onClose && (
        <Pressable
          onPress={onClose}
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 16,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: Colors.signal[600],
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            Done
          </Text>
        </Pressable>
      )}
    </View>
  );
}
