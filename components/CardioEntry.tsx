// Cardio-specific entry component
// Segment picker, distance presets, pace input, logged intervals list

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { formatDistance, formatPace, type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSetInsert, SegmentType } from '@/types/database';

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
}

export function CardioEntry({
  exercise,
  sets,
  workoutId,
  onSaveSet,
  onDeleteSet,
  onAddSet,
}: CardioEntryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Form state
  const [segmentType, setSegmentType] = useState<SegmentType>('work');
  const [selectedDistance, setSelectedDistance] = useState<number | null>(400);
  const [customDistance, setCustomDistance] = useState('');
  const [pace, setPace] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'meters' | 'miles' | 'km'>('meters');
  const [paceUnit, setPaceUnit] = useState<'/mi' | '/km' | '/m'>('/mi');

  // Get logged segments (sets that have data)
  const loggedSegments = sets.filter(
    (s) => s.distance_meters || s.duration_seconds || s.avg_pace
  );

  // Get next set order
  const nextSetOrder = Math.max(0, ...sets.map((s) => s.set_order)) + 1;

  // Handle logging a segment
  const handleLogSegment = useCallback(async () => {
    let distanceMeters: number | null = null;
    
    if (selectedDistance) {
      distanceMeters = selectedDistance; // Already in meters
    } else if (customDistance) {
      const customValue = parseFloat(customDistance);
      if (!isNaN(customValue)) {
        // Convert to meters based on unit
        if (distanceUnit === 'miles') {
          distanceMeters = milesToMeters(customValue);
        } else if (distanceUnit === 'km') {
          distanceMeters = kmToMeters(customValue);
        } else {
          distanceMeters = customValue; // Already meters
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
  }, [exercise.id, nextSetOrder, selectedDistance, customDistance, pace, paceUnit, distanceUnit, segmentType, onSaveSet]);

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
      {/* Segment Type Picker */}
      <View className="mb-4">
        <Text
          className={`text-sm font-semibold mb-2 ${
            isDark ? 'text-graphite-300' : 'text-graphite-600'
          }`}
        >
          Segment Type
        </Text>
        <View className="flex-row gap-2">
          {SEGMENT_TYPES.map((seg) => (
            <Pressable
              key={seg.type}
              onPress={() => setSegmentType(seg.type)}
              className={`flex-1 py-2 px-3 rounded-lg items-center ${
                segmentType === seg.type ? '' : isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
              style={
                segmentType === seg.type
                  ? { backgroundColor: seg.bgColor, borderWidth: 2, borderColor: seg.color }
                  : undefined
              }
            >
              <Text
                className={`text-sm font-semibold ${
                  segmentType === seg.type
                    ? ''
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-500'
                }`}
                style={segmentType === seg.type ? { color: seg.color } : undefined}
              >
                {seg.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Distance Presets */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text
            className={`text-sm font-semibold ${
              isDark ? 'text-graphite-300' : 'text-graphite-600'
            }`}
          >
            Distance
          </Text>
          {/* Unit Toggle */}
          <View className="flex-row gap-1">
            {(['meters', 'miles', 'km'] as const).map((unit) => (
              <Pressable
                key={unit}
                onPress={() => {
                  setDistanceUnit(unit);
                  setSelectedDistance(null);
                  setCustomDistance('');
                }}
                className={`px-2 py-1 rounded ${
                  distanceUnit === unit
                    ? 'bg-signal-500'
                    : isDark
                    ? 'bg-graphite-800'
                    : 'bg-graphite-100'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    distanceUnit === unit
                      ? 'text-white'
                      : isDark
                      ? 'text-graphite-400'
                      : 'text-graphite-500'
                  }`}
                >
                  {unit === 'meters' ? 'm' : unit === 'miles' ? 'mi' : 'km'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="flex-row gap-2 mb-2">
          {getDistancePresets(distanceUnit).map((preset) => (
            <Pressable
              key={preset.meters}
              onPress={() => {
                setSelectedDistance(preset.meters);
                setCustomDistance('');
              }}
              className={`flex-1 py-3 rounded-lg items-center border ${
                selectedDistance === preset.meters
                  ? 'border-signal-500 bg-signal-500/10'
                  : isDark
                  ? 'border-graphite-700 bg-graphite-800'
                  : 'border-graphite-200 bg-white'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedDistance === preset.meters
                    ? 'text-signal-500'
                    : isDark
                    ? 'text-graphite-100'
                    : 'text-graphite-900'
                }`}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Custom distance input */}
        <View className="flex-row items-center">
          <Text
            className={`text-sm mr-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
          >
            Custom:
          </Text>
          <TextInput
            className={`flex-1 px-3 py-2 rounded-lg text-center ${
              isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-white text-graphite-900'
            } border ${
              customDistance
                ? 'border-signal-500'
                : isDark
                ? 'border-graphite-700'
                : 'border-graphite-200'
            }`}
            value={customDistance}
            onChangeText={(text) => {
              setCustomDistance(text);
              if (text) setSelectedDistance(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={isDark ? '#607296' : '#808fb0'}
          />
          <Text
            className={`ml-2 text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
          >
            {distanceUnit === 'meters' ? 'meters' : distanceUnit === 'miles' ? 'miles' : 'km'}
          </Text>
        </View>
      </View>

      {/* Pace Input */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text
            className={`text-sm font-semibold ${
              isDark ? 'text-graphite-300' : 'text-graphite-600'
            }`}
          >
            Pace
          </Text>
          {/* Pace Unit Toggle */}
          <View className="flex-row gap-1">
            {(['/mi', '/km', '/m'] as const).map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setPaceUnit(unit)}
                className={`px-2 py-1 rounded ${
                  paceUnit === unit
                    ? 'bg-signal-500'
                    : isDark
                    ? 'bg-graphite-800'
                    : 'bg-graphite-100'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    paceUnit === unit
                      ? 'text-white'
                      : isDark
                      ? 'text-graphite-400'
                      : 'text-graphite-500'
                  }`}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="flex-row items-center">
          <TextInput
            className={`flex-1 px-4 py-3 rounded-lg text-center text-lg font-semibold ${
              isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-white text-graphite-900'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
            value={pace}
            onChangeText={setPace}
            placeholder="8:45"
            placeholderTextColor={isDark ? '#607296' : '#808fb0'}
            keyboardType="numbers-and-punctuation"
          />
          <Text
            className={`ml-3 text-lg ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
          >
            {paceUnit}
          </Text>
        </View>
      </View>

      {/* Log Button */}
      <Pressable
        onPress={handleLogSegment}
        disabled={isLogging}
        className={`py-4 rounded-xl items-center mb-6 ${
          isLogging ? 'opacity-50' : ''
        }`}
        style={{ backgroundColor: currentConfig.color }}
      >
        <Text className="text-white font-semibold text-lg">
          {isLogging ? 'Logging...' : 'Log Interval'}
        </Text>
      </Pressable>

      {/* Logged Segments */}
      {loggedSegments.length > 0 && (
        <View>
          <Text
            className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-graphite-300' : 'text-graphite-600'
            }`}
          >
            Logged ({loggedSegments.length})
          </Text>

          {loggedSegments.map((segment, index) => {
            const config = getSegmentConfig(segment.segment_type || 'work');
            const distanceStr = segment.distance_meters
              ? formatDistance(segment.distance_meters)
              : '';
            const paceStr = segment.avg_pace ? formatPace(segment.avg_pace) : '';

            return (
              <View
                key={segment.id || index}
                className="flex-row items-center p-3 rounded-xl mb-2"
                style={{ backgroundColor: config.bgColor }}
              >
                <View className="flex-1">
                  <Text
                    className="font-semibold"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </Text>
                  <Text
                    className={`text-sm mt-0.5 ${
                      isDark ? 'text-graphite-300' : 'text-graphite-700'
                    }`}
                  >
                    {distanceStr}
                    {distanceStr && paceStr ? ' @ ' : ''}
                    {paceStr}
                  </Text>
                </View>

                {/* Delete button */}
                {segment.id && (
                  <Pressable
                    onPress={() => handleDeleteSegment(segment.id)}
                    className="p-2"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Duplicate button */}
          <Pressable
            onPress={handleDuplicate}
            disabled={isLogging}
            className={`flex-row items-center justify-center py-3 rounded-xl border border-dashed mt-2 ${
              isDark ? 'border-graphite-600' : 'border-graphite-300'
            }`}
          >
            <Ionicons
              name="copy-outline"
              size={18}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <Text
              className={`ml-2 font-medium ${
                isDark ? 'text-graphite-400' : 'text-graphite-500'
              }`}
            >
              + Duplicate Last
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
